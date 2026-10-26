import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { FuncaoDesignacao, Prisma, StatusEntrega } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx } from '../../common/contexto';
import { dataCivil, hojeCivil } from '../../common/datas';
import { D, quantidade, valorMonetario } from '../../common/dinheiro';
import { EscopoService } from '../../common/escopo.service';
import { ParametrosService } from '../../common/parametros.service';
import { AtestoDto, EntregaDto, MedicaoDto, MotivoExecDto, NotaFiscalDto, RecebimentoDto, RegistroExecucaoDto } from './execucao.dto';

@Injectable()
export class ExecucaoService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
    private escopo: EscopoService,
    private params: ParametrosService,
  ) {}

  private bloquearComandante(ctx: Ctx) {
    if (ctx.perfil === 'COMANDANTE') throw new ForbiddenException('Perfil somente leitura');
  }

  async painel(ctx: Ctx, contratoId: string) {
    await this.escopo.assertContrato(ctx, contratoId);
    const [entregas, medicoes, registros, notas] = await Promise.all([
      this.prisma.entrega.findMany({ where: { contratoId }, include: { recebimentos: { orderBy: { criadoEm: 'asc' } } }, orderBy: { prazo: 'asc' } }),
      this.prisma.medicao.findMany({ where: { contratoId }, include: { recebimentos: true }, orderBy: { competencia: 'desc' } }),
      this.prisma.registroExecucao.findMany({ where: { contratoId }, orderBy: { data: 'desc' } }),
      this.prisma.notaFiscal.findMany({ where: { contratoId }, include: { atestos: true }, orderBy: { dataEmissao: 'desc' } }),
    ]);
    const hoje = hojeCivil();
    return {
      entregas: entregas.map((e) => ({
        ...e,
        atrasada: e.prazo < hoje && !['RECEBIDA_DEFINITIVA', 'CANCELADA'].includes(e.status) && D(e.quantidadeEntregue).lt(e.quantidadePrevista),
      })),
      medicoes,
      registros,
      notas,
    };
  }

  async criarEntrega(ctx: Ctx, contratoId: string, dto: EntregaDto) {
    this.bloquearComandante(ctx);
    await this.escopo.assertContrato(ctx, contratoId);
    return this.prisma.$transaction(async (tx) => {
      const e = await tx.entrega.create({
        data: {
          unidadeId: ctx.unidadeId, contratoId, descricao: dto.descricao, local: dto.local, quantidadePrevista: quantidade(dto.quantidadePrevista),
          prazo: dataCivil(dto.prazo), criadoPor: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'ENTREGA_CRIADA', entidade: 'ContratoInstrumento', entidadeId: contratoId, depois: e });
      return e;
    });
  }

  private async funcoesCompetentes(ctx: Ctx, chave: string) {
    return this.params.valor<FuncaoDesignacao[]>(chave, ctx.unidadeId);
  }

  /** Recebimento formal: exige designação ATIVA com função competente (parâmetro versionado). */
  async receberEntrega(ctx: Ctx, entregaId: string, dto: RecebimentoDto) {
    const e = await this.prisma.entrega.findFirst({ where: { id: entregaId, unidadeId: ctx.unidadeId } });
    if (!e) throw new NotFoundException('Entrega não encontrada');
    await this.escopo.assertContrato(ctx, e.contratoId);
    if (['RECEBIDA_DEFINITIVA', 'CANCELADA'].includes(e.status)) throw new UnprocessableEntityException('Entrega já encerrada');
    const chave = dto.tipo === 'DEFINITIVO' ? 'competencia.recebimento.definitivo' : 'competencia.recebimento.provisorio';
    const designacao = await this.escopo.designacaoCompetente(ctx, e.contratoId, await this.funcoesCompetentes(ctx, chave));
    const q = dto.quantidade ? quantidade(dto.quantidade) : null;
    let status: StatusEntrega = e.status;
    let entregue = D(e.quantidadeEntregue);
    if (dto.tipo === 'PROVISORIO') {
      if (!q || q.lte(0)) throw new BadRequestException('Informe a quantidade recebida');
      entregue = entregue.plus(q);
      if (entregue.gt(e.quantidadePrevista)) throw new UnprocessableEntityException('Quantidade recebida excede a prevista');
      status = entregue.lt(e.quantidadePrevista) ? 'ENTREGUE_PARCIAL' : 'RECEBIDA_PROVISORIA';
    } else if (dto.tipo === 'DEFINITIVO') {
      if (entregue.lt(e.quantidadePrevista)) throw new UnprocessableEntityException('Recebimento definitivo exige quantidade integral recebida provisoriamente');
      status = 'RECEBIDA_DEFINITIVA';
    } else {
      if (!dto.observacao) throw new BadRequestException('Rejeição exige observação');
      status = 'REJEITADA';
      if (q) entregue = entregue.minus(q).lt(0) ? D(0) : entregue.minus(q);
    }
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.recebimento.create({
        data: {
          unidadeId: ctx.unidadeId, entregaId, tipo: dto.tipo, quantidade: q, data: dataCivil(dto.data), observacao: dto.observacao,
          responsavelId: ctx.usuarioId, designacaoId: designacao.id,
        },
      });
      await tx.entrega.update({ where: { id: entregaId }, data: { status, quantidadeEntregue: entregue } });
      await this.auditoria.registrar(tx, ctx, {
        acao: `RECEBIMENTO_${dto.tipo}`, entidade: 'ContratoInstrumento', entidadeId: e.contratoId,
        antes: { entrega: e.descricao, status: e.status }, depois: { status, recebimento: r, competencia: designacao.funcao },
      });
      return r;
    });
  }

  async criarMedicao(ctx: Ctx, contratoId: string, dto: MedicaoDto) {
    this.bloquearComandante(ctx);
    await this.escopo.assertContrato(ctx, contratoId);
    return this.prisma.$transaction(async (tx) => {
      const m = await tx.medicao.create({
        data: {
          unidadeId: ctx.unidadeId, contratoId, competencia: dto.competencia, descricao: dto.descricao, percentualFisico: new Prisma.Decimal(dto.percentualFisico),
          valor: valorMonetario(dto.valor, 'valor', true), inconformidades: dto.inconformidades, criadoPor: ctx.usuarioId, status: 'ENVIADA',
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'MEDICAO_REGISTRADA', entidade: 'ContratoInstrumento', entidadeId: contratoId, depois: m });
      return m;
    });
  }

  async receberMedicao(ctx: Ctx, medicaoId: string, dto: RecebimentoDto) {
    const m = await this.prisma.medicao.findFirst({ where: { id: medicaoId, unidadeId: ctx.unidadeId } });
    if (!m) throw new NotFoundException('Medição não encontrada');
    await this.escopo.assertContrato(ctx, m.contratoId);
    if (m.status === 'APROVADA') throw new UnprocessableEntityException('Medição já aprovada');
    const chave = dto.tipo === 'DEFINITIVO' ? 'competencia.recebimento.definitivo' : 'competencia.recebimento.provisorio';
    const designacao = await this.escopo.designacaoCompetente(ctx, m.contratoId, await this.funcoesCompetentes(ctx, chave));
    if (dto.tipo === 'REJEICAO' && !dto.observacao) throw new BadRequestException('Glosa/rejeição exige observação');
    const status = dto.tipo === 'DEFINITIVO' ? 'APROVADA' : dto.tipo === 'REJEICAO' ? 'GLOSADA' : 'ENVIADA';
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.recebimento.create({
        data: { unidadeId: ctx.unidadeId, medicaoId, tipo: dto.tipo, data: dataCivil(dto.data), observacao: dto.observacao, responsavelId: ctx.usuarioId, designacaoId: designacao.id },
      });
      await tx.medicao.update({ where: { id: medicaoId }, data: { status } });
      await this.auditoria.registrar(tx, ctx, {
        acao: `MEDICAO_${dto.tipo}`, entidade: 'ContratoInstrumento', entidadeId: m.contratoId, antes: { competencia: m.competencia, status: m.status }, depois: { status },
      });
      return r;
    });
  }

  async registrar(ctx: Ctx, contratoId: string, dto: RegistroExecucaoDto) {
    this.bloquearComandante(ctx);
    await this.escopo.assertContrato(ctx, contratoId);
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.registroExecucao.create({
        data: { unidadeId: ctx.unidadeId, contratoId, tipo: dto.tipo, titulo: dto.titulo, texto: dto.texto, data: dataCivil(dto.data), autorId: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, { acao: `EXECUCAO_${dto.tipo}`, entidade: 'ContratoInstrumento', entidadeId: contratoId, depois: { titulo: r.titulo, data: dto.data } });
      return r;
    });
  }

  async registrarNota(ctx: Ctx, contratoId: string, dto: NotaFiscalDto) {
    this.bloquearComandante(ctx);
    await this.escopo.assertContrato(ctx, contratoId);
    const emissao = dataCivil(dto.dataEmissao);
    const receb = dataCivil(dto.dataRecebimento);
    if (receb < emissao) throw new BadRequestException('Recebimento anterior à emissão');
    return this.prisma.$transaction(async (tx) => {
      const n = await tx.notaFiscal.create({
        data: {
          unidadeId: ctx.unidadeId, contratoId, numero: dto.numero.trim(), serie: dto.serie?.trim() ?? '', chaveAcesso: dto.chaveAcesso,
          dataEmissao: emissao, dataRecebimento: receb, valor: valorMonetario(dto.valor), criadoPor: ctx.usuarioId,
        },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'NOTA_FISCAL_RECEBIDA', entidade: 'ContratoInstrumento', entidadeId: contratoId, depois: n });
      return n;
    });
  }

  /** Atesto: competência por designação ATIVA (não apenas perfil). */
  async atestar(ctx: Ctx, notaId: string, dto: AtestoDto) {
    const n = await this.prisma.notaFiscal.findFirst({ where: { id: notaId, unidadeId: ctx.unidadeId } });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada');
    await this.escopo.assertContrato(ctx, n.contratoId);
    if (n.status !== 'RECEBIDA') throw new UnprocessableEntityException(`Nota em situação ${n.status} não pode ser atestada`);
    const funcoes = await this.funcoesCompetentes(ctx, 'competencia.atesto');
    const d = await this.escopo.designacaoCompetente(ctx, n.contratoId, funcoes);
    const data = dataCivil(dto.data);
    if (data < n.dataRecebimento) throw new BadRequestException('Atesto anterior ao recebimento da nota');
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.notaFiscal.updateMany({ where: { id: notaId, status: 'RECEBIDA' }, data: { status: 'ATESTADA' } });
      if (r.count !== 1) throw new UnprocessableEntityException('Nota alterada concorrentemente');
      const a = await tx.atesto.create({
        data: { notaFiscalId: notaId, usuarioId: ctx.usuarioId, designacaoId: d.id, competencia: `${d.funcao} — ${d.documentoDesignacao ?? ''}`, data, observacao: dto.observacao },
      });
      await this.auditoria.registrar(tx, ctx, { acao: 'NOTA_FISCAL_ATESTADA', entidade: 'ContratoInstrumento', entidadeId: n.contratoId, depois: { nota: n.numero, atesto: a } });
      return a;
    });
  }

  async rejeitarNota(ctx: Ctx, notaId: string, dto: MotivoExecDto, cancelar = false) {
    this.bloquearComandante(ctx);
    const n = await this.prisma.notaFiscal.findFirst({ where: { id: notaId, unidadeId: ctx.unidadeId } });
    if (!n) throw new NotFoundException('Nota fiscal não encontrada');
    await this.escopo.assertContrato(ctx, n.contratoId);
    if (cancelar && ctx.perfil === 'GESTOR') throw new ForbiddenException('Cancelamento de nota cabe à secretaria');
    const movs = await this.prisma.movimentoEmpenho.count({ where: { notaFiscalId: notaId } });
    if (movs) throw new UnprocessableEntityException('Nota com lançamentos financeiros; estorne-os antes');
    const status = cancelar ? 'CANCELADA' : 'REJEITADA';
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.notaFiscal.update({ where: { id: notaId }, data: { status } });
      await this.auditoria.registrar(tx, ctx, {
        acao: `NOTA_FISCAL_${status}`, entidade: 'ContratoInstrumento', entidadeId: n.contratoId, antes: { nota: n.numero, status: n.status }, depois: { status }, motivo: dto.motivo,
      });
      return d;
    });
  }
}
