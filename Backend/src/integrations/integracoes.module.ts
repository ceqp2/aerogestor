import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, UnprocessableEntityException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { AuditoriaService, serializar } from '../common/auditoria.service';
import { C, Ctx, LEITURA_UNIDADE, Perfis, SECRETARIA } from '../common/contexto';
import { sha256 } from '../common/crypto';
import { dataCivil, isoData } from '../common/datas';
import { IsDataCivil, IsDinheiro, IsQuantidade } from '../common/validadores';
import { env } from '../config/env';
import { AtasModule } from '../modules/atas/atas.module';
import { AtasService } from '../modules/atas/atas.service';
import { ProcessosModule } from '../modules/processos/processos.module';
import { ProcessosService } from '../modules/processos/processos.service';
import { ComprasCatalogoClient } from './compras-catalogo/compras-catalogo.client';
import { HttpExternoService } from './http-externo';
import { AtaPncp, PncpClient } from './pncp/pncp.client';

class BuscaAtasDto {
  @IsDataCivil() dataInicial: string;
  @IsDataCivil() dataFinal: string;
  @IsOptional() @Matches(/^\d{14}$/) cnpj?: string;
  @IsOptional() @Matches(/^\d{1,10}$/) codigoUnidadeAdministrativa?: string;
  @IsOptional() @IsString() @MaxLength(100) textoLocal?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(10) @Max(50) tamanhoPagina: number = 20;
}

class BuscaCatalogoDto {
  @IsIn(['CATMAT', 'CATSER']) tipo: 'CATMAT' | 'CATSER';
  @IsOptional() @Matches(/^\d{1,10}$/) codigo?: string;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100) descricao?: string;
  @IsOptional() @Matches(/^\d{1,10}$/) codigoClasse?: string;
  @IsOptional() @Matches(/^\d{1,10}$/) codigoGrupo?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) pagina: number = 1;
  @Type(() => Number) @IsInt() @Min(10) @Max(100) tamanhoPagina: number = 20;
}

class PreviaAtaDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) chaveCache: string;
  @IsString() @IsNotEmpty() @MaxLength(80) numeroControlePNCPAta: string;
}

class CamposAtaRevisados {
  @IsString() @IsNotEmpty() @MaxLength(60) numero: string;
  @IsString() @IsNotEmpty() @MaxLength(300) orgaoGerenciador: string;
  @IsString() @IsNotEmpty() @MaxLength(3000) objeto: string;
  @IsDataCivil() vigenciaInicio: string;
  @IsDataCivil() vigenciaFim: string;
  @IsOptional() @IsString() @MaxLength(20) uasg?: string;
}

class ConfirmarImportacaoDto {
  @ValidateNested() @Type(() => CamposAtaRevisados) campos: CamposAtaRevisados;
  /** Para atualização de ata já existente: aplica apenas se explicitamente confirmado */
  @IsOptional() @IsBoolean() aplicarAtualizacao?: boolean;
}

class FavoritoDto {
  @IsIn(['CATMAT', 'CATSER', 'PNCP_ATA']) fonte: string;
  @IsString() @IsNotEmpty() @MaxLength(80) identificador: string;
  @IsString() @IsNotEmpty() @MaxLength(500) descricao: string;
}

class VincularCatalogoDto {
  @IsUUID() processoId: string;
  @IsIn(['CATMAT', 'CATSER']) tipo: 'CATMAT' | 'CATSER';
  @Matches(/^\d{1,10}$/) codigo: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) chaveCache: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) especificacao: string;
  @IsString() @IsNotEmpty() @MaxLength(30) unidadeMedida: string;
  @IsQuantidade() quantidade: string;
  @IsOptional() @IsDinheiro() valorUnitarioEstimado?: string;
  @IsBoolean() compatibilidadeVerificada: boolean;
}

@Injectable()
class IntegracoesService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private http: HttpExternoService,
    private pncp: PncpClient,
    private catalogo: ComprasCatalogoClient,
    private atas: AtasService,
    private processos: ProcessosService,
  ) {}

  status() {
    const fontes = [
      { fonte: 'PNCP_ATAS', descricao: 'PNCP — API de consulta: atas de registro de preço (GET /v1/atas)', base: env().pncpBaseUrl },
      { fonte: 'CATMAT', descricao: 'Compras.gov.br — catálogo de materiais (4_consultarItemMaterial)', base: env().comprasBaseUrl },
      { fonte: 'CATSER', descricao: 'Compras.gov.br — catálogo de serviços (6_consultarItemServico)', base: env().comprasBaseUrl },
    ];
    return fontes.map((f) => ({
      ...f,
      endpointVerificadoEm: '2026-10-08',
      ...(this.http.status.get(f.fonte) ?? {}),
      limitacoes:
        f.fonte === 'PNCP_ATAS'
          ? 'Não retorna itens, quantidades nem saldo da ata; filtro textual é local sobre a página retornada.'
          : f.fonte === 'CATSER'
            ? 'Sem filtro por descrição na fonte; busca textual local apenas sobre a página da classe/grupo informado.'
            : 'Descrição é correspondência exata na fonte; busca por palavra requer classe (filtro local). Código de catálogo não substitui especificação nem pesquisa de preços.',
    }));
  }

  async buscarAtas(q: BuscaAtasDto) {
    const ini = dataCivil(q.dataInicial);
    const fim = dataCivil(q.dataFinal);
    if (fim < ini) throw new BadRequestException('Data final anterior à inicial');
    if (fim.getTime() - ini.getTime() > 366 * 86400000) throw new BadRequestException('Período máximo de 1 ano');
    const r = await this.pncp.buscarAtas({ ...q });
    let itens = r.dados.data;
    if (q.textoLocal) {
      const t = q.textoLocal.toLowerCase();
      itens = itens.filter((a) => `${a.objetoContratacao} ${a.nomeOrgao} ${a.numeroAtaRegistroPreco}`.toLowerCase().includes(t));
    }
    return {
      itens, totalRegistros: r.dados.totalRegistros, totalPaginas: r.dados.totalPaginas, pagina: r.dados.numeroPagina,
      fonte: r.fonte, url: r.url, consultadoEm: r.consultadoEm, deCache: r.deCache, avisoCache: r.avisoCache, chaveCache: r.chaveCache,
      filtroLocalAplicado: !!q.textoLocal,
    };
  }

  /** Gera prévia a partir dos dados obtidos PELO SERVIDOR (cache da consulta), nunca do cliente. */
  async previaAta(ctx: Ctx, dto: PreviaAtaDto) {
    const c = await this.http.lerCache<{ data?: AtaPncp[] }>(dto.chaveCache);
    if (!c || c.fonte !== 'PNCP_ATAS') throw new NotFoundException('Consulta expirada; refaça a busca');
    const ata = c.dados.data?.find((a) => a.numeroControlePNCPAta === dto.numeroControlePNCPAta);
    if (!ata) throw new NotFoundException('Ata não encontrada no resultado da consulta');
    const hash = sha256(JSON.stringify(ata));
    const existente = await this.prisma.ata.findFirst({ where: { unidadeId: ctx.unidadeId, idPncp: ata.numeroControlePNCPAta } });
    const mesmaPrevia = await this.prisma.importacaoExterna.findFirst({
      where: { unidadeId: ctx.unidadeId, fonte: 'PNCP_ATA', identificador: ata.numeroControlePNCPAta, hash, status: { in: ['PREVIA', 'ATUALIZACAO_PENDENTE'] } },
    });
    const imp =
      mesmaPrevia ??
      (await this.prisma.importacaoExterna.create({
        data: {
          unidadeId: ctx.unidadeId, fonte: 'PNCP_ATA', identificador: ata.numeroControlePNCPAta, consultadoEm: c.consultadoEm,
          urlConsulta: `${env().pncpBaseUrl}/v1/atas`, hash, dadosOriginais: ata as unknown as Prisma.InputJsonValue,
          status: existente ? 'ATUALIZACAO_PENDENTE' : 'PREVIA', entidadeId: existente?.id,
        },
      }));
    const sugeridos = {
      numero: ata.numeroAtaRegistroPreco,
      orgaoGerenciador: ata.nomeOrgao,
      objeto: ata.objetoContratacao,
      vigenciaInicio: ata.vigenciaInicio?.slice(0, 10),
      vigenciaFim: ata.vigenciaFim?.slice(0, 10),
      uasg: ata.codigoUnidadeOrgao ?? undefined,
    };
    const diferencas = existente
      ? Object.entries({
          numero: existente.numero, orgaoGerenciador: existente.orgaoGerenciador, objeto: existente.objeto,
          vigenciaInicio: isoData(existente.vigenciaInicio), vigenciaFim: isoData(existente.vigenciaFim), uasg: existente.uasg ?? undefined,
        })
          .filter(([k, v]) => (sugeridos as Record<string, unknown>)[k] !== v)
          .map(([campo, interno]) => ({ campo, interno, externo: (sugeridos as Record<string, unknown>)[campo] }))
      : [];
    return {
      importacaoId: imp.id, status: imp.status, sugeridos, original: ata, consultadoEm: c.consultadoEm, hash,
      ataExistente: existente ? { id: existente.id, numero: existente.numero } : null, diferencas,
      avisos: [
        'Importar a ata NÃO autoriza sua utilização: participação/adesão exige registro próprio e documentos.',
        'A API de consulta não informa itens, quantidades ou saldos; cadastre-os a partir dos documentos oficiais.',
        ata.cancelado ? 'Atenção: a ata consta como CANCELADA na fonte.' : null,
      ].filter(Boolean),
    };
  }

  async confirmar(ctx: Ctx, id: string, dto: ConfirmarImportacaoDto) {
    const imp = await this.prisma.importacaoExterna.findFirst({ where: { id, unidadeId: ctx.unidadeId } });
    if (!imp) throw new NotFoundException('Importação não encontrada');
    if (!['PREVIA', 'ATUALIZACAO_PENDENTE'].includes(imp.status)) throw new UnprocessableEntityException('Importação já revisada');
    const original = imp.dadosOriginais as unknown as AtaPncp;
    if (imp.status === 'PREVIA') {
      const dup = await this.prisma.ata.findFirst({ where: { unidadeId: ctx.unidadeId, idPncp: imp.identificador } });
      if (dup) throw new UnprocessableEntityException('Ata já importada (prevenção de duplicata)');
      const ata = await this.atas.criar(
        ctx,
        { ...dto.campos, idPncp: imp.identificador, ano: original.anoAta, cnpjGerenciador: original.cnpjOrgao, processoOrigem: original.numeroControlePNCPCompra },
        imp.id,
      );
      if (original.cancelado) await this.prisma.ata.update({ where: { id: ata.id }, data: { cancelada: true } });
      await this.prisma.importacaoExterna.update({ where: { id }, data: { status: 'IMPORTADA', entidadeId: ata.id, revisadoPor: ctx.usuarioId, revisadoEm: new Date() } });
      return ata;
    }
    // Atualização de ata existente: somente com confirmação explícita; vigência por fluxo próprio.
    if (!dto.aplicarAtualizacao) throw new BadRequestException('Confirme explicitamente a aplicação da atualização');
    const antes = await this.prisma.ata.findFirstOrThrow({ where: { id: imp.entidadeId!, unidadeId: ctx.unidadeId } });
    const depois = await this.prisma.$transaction(async (tx) => {
      const d = await tx.ata.update({
        where: { id: antes.id },
        data: { numero: dto.campos.numero, orgaoGerenciador: dto.campos.orgaoGerenciador, objeto: dto.campos.objeto, uasg: dto.campos.uasg, importacaoId: imp.id },
      });
      await tx.importacaoExterna.update({ where: { id }, data: { status: 'IMPORTADA', revisadoPor: ctx.usuarioId, revisadoEm: new Date() } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'ATA_ATUALIZADA_POR_IMPORTACAO', entidade: 'Ata', entidadeId: antes.id, antes, depois: d,
        motivo: `Revisão humana da importação ${imp.id} (fonte PNCP, consultada em ${imp.consultadoEm.toISOString()})`,
      });
      return d;
    });
    const vigDif = isoData(antes.vigenciaFim) !== dto.campos.vigenciaFim;
    return { ...depois, aviso: vigDif ? 'Vigência difere da fonte: altere pelo fluxo de vigência com documento e fundamento.' : undefined };
  }

  async descartar(ctx: Ctx, id: string) {
    const r = await this.prisma.importacaoExterna.updateMany({
      where: { id, unidadeId: ctx.unidadeId, status: { in: ['PREVIA', 'ATUALIZACAO_PENDENTE'] } },
      data: { status: 'DESCARTADA', revisadoPor: ctx.usuarioId, revisadoEm: new Date() },
    });
    if (!r.count) throw new NotFoundException('Importação não encontrada');
  }

  importacoes(ctx: Ctx) {
    return this.prisma.importacaoExterna.findMany({
      where: { unidadeId: ctx.unidadeId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: { id: true, fonte: true, identificador: true, consultadoEm: true, status: true, entidadeId: true, revisadoEm: true, criadoEm: true, hash: true },
    });
  }

  async buscarCatalogo(q: BuscaCatalogoDto) {
    if (q.tipo === 'CATMAT') {
      if (!q.codigo && !q.descricao && !q.codigoClasse) throw new BadRequestException('Informe código, descrição ou classe');
      const r = await this.catalogo.materiais({ codigo: q.codigo, descricao: q.descricao, codigoClasse: q.codigoClasse, pagina: q.pagina, tamanhoPagina: q.tamanhoPagina });
      return {
        itens: r.itens, total: r.total, paginas: r.paginas, consultadoEm: r.consultadoEm, deCache: r.deCache, avisoCache: r.avisoCache, chaveCache: r.chaveCache, url: r.url,
        filtroLocalAplicado: r.filtroLocalAplicado,
        aviso: r.descricaoExata ? 'A fonte oficial compara a descrição de forma EXATA. Para busca por palavra, informe o código da classe (o texto será filtrado localmente) ou o código do item.' : undefined,
      };
    }
    if (!q.codigo && !q.codigoClasse && !q.codigoGrupo) {
      throw new BadRequestException('CATSER: a fonte oficial não aceita busca por descrição. Informe o código do serviço, da classe ou do grupo.');
    }
    const r = await this.catalogo.servicos({ codigo: q.codigo, codigoClasse: q.codigoClasse, codigoGrupo: q.codigoGrupo, filtroLocal: q.descricao, pagina: q.pagina, tamanhoPagina: q.tamanhoPagina });
    return {
      itens: r.itens, total: r.total, paginas: r.paginas, consultadoEm: r.consultadoEm, deCache: r.deCache, avisoCache: r.avisoCache, chaveCache: r.chaveCache, url: r.url,
      filtroLocalAplicado: r.filtroLocalAplicado,
    };
  }

  /** Vincula código de catálogo a item do processo após verificação humana de compatibilidade. */
  async vincularCatalogo(ctx: Ctx, dto: VincularCatalogoDto) {
    if (!dto.compatibilidadeVerificada) throw new BadRequestException('Confirme a verificação de compatibilidade entre o código e a especificação');
    const c = await this.http.lerCache<{ resultado?: Record<string, unknown>[] }>(dto.chaveCache);
    if (!c || c.fonte !== dto.tipo) throw new NotFoundException('Consulta expirada; refaça a busca');
    const campo = dto.tipo === 'CATMAT' ? 'codigoItem' : 'codigoServico';
    const orig = c.dados.resultado?.find((x) => String(x[campo]) === dto.codigo);
    if (!orig) throw new NotFoundException('Código não encontrado no resultado da consulta');
    const item = await this.processos.adicionarItemProcesso(ctx, dto.processoId, {
      descricao: dto.especificacao, codigoCatalogo: dto.codigo, tipoCatalogo: dto.tipo, unidadeMedida: dto.unidadeMedida,
      quantidade: dto.quantidade, valorUnitarioEstimado: dto.valorUnitarioEstimado,
    });
    await this.prisma.importacaoExterna.create({
      data: {
        unidadeId: ctx.unidadeId, fonte: dto.tipo, identificador: dto.codigo, consultadoEm: c.consultadoEm, urlConsulta: env().comprasBaseUrl,
        hash: sha256(JSON.stringify(orig)), dadosOriginais: serializar(orig) ?? {}, status: 'IMPORTADA', entidadeId: item.id, revisadoPor: ctx.usuarioId, revisadoEm: new Date(),
      },
    });
    return item;
  }

  favoritos(ctx: Ctx) {
    return this.prisma.favorito.findMany({ where: { usuarioId: ctx.usuarioId, unidadeId: ctx.unidadeId }, orderBy: { criadoEm: 'desc' } });
  }

  async favoritar(ctx: Ctx, dto: FavoritoDto) {
    return this.prisma.favorito.upsert({
      where: { usuarioId_fonte_identificador: { usuarioId: ctx.usuarioId, fonte: dto.fonte, identificador: dto.identificador } },
      create: { ...dto, usuarioId: ctx.usuarioId, unidadeId: ctx.unidadeId },
      update: { descricao: dto.descricao },
    });
  }

  async desfavoritar(ctx: Ctx, id: string) {
    await this.prisma.favorito.deleteMany({ where: { id, usuarioId: ctx.usuarioId } });
  }
}

@ApiTags('integracoes')
@Controller('integracoes')
class IntegracoesController {
  constructor(private s: IntegracoesService) {}

  @Perfis(...LEITURA_UNIDADE) @Get('status')
  status() {
    return this.s.status();
  }

  @Perfis(...LEITURA_UNIDADE) @Get('pncp/atas')
  atas(@Query() q: BuscaAtasDto) {
    return this.s.buscarAtas(q);
  }

  @Perfis(...SECRETARIA) @Post('pncp/atas/previa') @HttpCode(200)
  previa(@C() ctx: Ctx, @Body() dto: PreviaAtaDto) {
    return this.s.previaAta(ctx, dto);
  }

  @Perfis(...SECRETARIA) @Get('importacoes')
  importacoes(@C() ctx: Ctx) {
    return this.s.importacoes(ctx);
  }

  @Perfis(...SECRETARIA) @Post('importacoes/:id/confirmar') @HttpCode(200)
  confirmar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmarImportacaoDto) {
    return this.s.confirmar(ctx, id, dto);
  }

  @Perfis(...SECRETARIA) @Post('importacoes/:id/descartar') @HttpCode(200)
  async descartar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.descartar(ctx, id);
    return { ok: true };
  }

  @Perfis(...LEITURA_UNIDADE) @Get('catalogo')
  catalogo(@Query() q: BuscaCatalogoDto) {
    return this.s.buscarCatalogo(q);
  }

  @Perfis(...SECRETARIA) @Post('catalogo/vincular')
  vincular(@C() ctx: Ctx, @Body() dto: VincularCatalogoDto) {
    return this.s.vincularCatalogo(ctx, dto);
  }

  @Perfis(...LEITURA_UNIDADE) @Get('favoritos')
  favoritos(@C() ctx: Ctx) {
    return this.s.favoritos(ctx);
  }

  @Perfis(...LEITURA_UNIDADE) @Post('favoritos')
  favoritar(@C() ctx: Ctx, @Body() dto: FavoritoDto) {
    return this.s.favoritar(ctx, dto);
  }

  @Perfis(...LEITURA_UNIDADE) @Delete('favoritos/:id')
  async desfavoritar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string) {
    await this.s.desfavoritar(ctx, id);
    return { ok: true };
  }
}

@Module({
  imports: [AtasModule, ProcessosModule],
  controllers: [IntegracoesController],
  providers: [IntegracoesService, HttpExternoService, PncpClient, ComprasCatalogoClient],
})
export class IntegracoesModule {}
