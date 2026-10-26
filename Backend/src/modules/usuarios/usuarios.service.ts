import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Perfil, TipoConvite } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { Ctx } from '../../common/contexto';
import { hashToken, novoToken } from '../../common/crypto';
import { env } from '../../config/env';
import { CriarUsuarioDto } from './usuarios.dto';

/**
 * Quem pode criar/desativar/alterar contas de qual perfil (na própria unidade).
 * Auxiliar: somente gestor. Chefe: auxiliar e gestor. Admin: todos.
 * Ninguém altera o próprio perfil nem concede perfil superior a si.
 */
export const PODE_GERIR: Record<Perfil, Perfil[]> = {
  ADMIN: ['ADMIN', 'COMANDANTE', 'CHEFE', 'AUXILIAR', 'GESTOR'],
  CHEFE: ['AUXILIAR', 'GESTOR'],
  AUXILIAR: ['GESTOR'],
  COMANDANTE: [],
  GESTOR: [],
};

export function podeGerir(ator: Perfil, alvo: Perfil) {
  return PODE_GERIR[ator].includes(alvo);
}

const CONVITE_HORAS = 72;
const RECUPERACAO_HORAS = 2;

@Injectable()
export class UsuariosService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  async listar(ctx: Ctx) {
    const vinculos = await this.prisma.vinculoUnidadePerfil.findMany({
      where: { unidadeId: ctx.unidadeId },
      include: { usuario: true },
      orderBy: { usuario: { nome: 'asc' } },
    });
    return vinculos.map((v) => ({
      id: v.usuario.id,
      nome: v.usuario.nome,
      email: v.usuario.email,
      postoGraduacao: v.usuario.postoGraduacao,
      perfil: v.perfil,
      vinculoAtivo: v.ativo,
      contaAtiva: v.usuario.ativo,
      mfaAtivo: v.usuario.mfaAtivo,
      senhaDefinida: !!v.usuario.senhaHash,
      ultimoLogin: v.usuario.ultimoLogin,
      podeGerir: podeGerir(ctx.perfil, v.perfil) && v.usuario.id !== ctx.usuarioId,
    }));
  }

  /** Lista enxuta para campos de seleção (responsáveis, designações). */
  async opcoes(ctx: Ctx) {
    const vinculos = await this.prisma.vinculoUnidadePerfil.findMany({
      where: { unidadeId: ctx.unidadeId, ativo: true, usuario: { ativo: true } },
      include: { usuario: { select: { id: true, nome: true, postoGraduacao: true } } },
      orderBy: { usuario: { nome: 'asc' } },
    });
    return vinculos.map((v) => ({ id: v.usuario.id, nome: v.usuario.nome, postoGraduacao: v.usuario.postoGraduacao, perfil: v.perfil }));
  }

  private async gerarConvite(usuarioId: string, email: string, tipo: TipoConvite, ctx: Ctx) {
    // Invalida convites anteriores ainda não utilizados.
    await this.prisma.convite.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: new Date() } });
    const token = novoToken();
    const horas = tipo === 'CONVITE' ? CONVITE_HORAS : RECUPERACAO_HORAS;
    await this.prisma.convite.create({
      data: { tipo, tokenHash: hashToken(token), email, usuarioId, criadoPor: ctx.usuarioId, expiraEm: new Date(Date.now() + horas * 3600000) },
    });
    return { link: `${env().appOrigin[0]}/convite/${token}`, expiraEmHoras: horas };
  }

  private async vinculoAlvo(ctx: Ctx, usuarioId: string) {
    const v = await this.prisma.vinculoUnidadePerfil.findUnique({
      where: { usuarioId_unidadeId: { usuarioId, unidadeId: ctx.unidadeId } },
      include: { usuario: true },
    });
    if (!v) throw new NotFoundException('Usuário não encontrado nesta unidade');
    if (usuarioId === ctx.usuarioId) throw new ForbiddenException('Não é permitido alterar a própria conta por esta função');
    if (!podeGerir(ctx.perfil, v.perfil)) throw new ForbiddenException('Seu perfil não pode gerenciar este usuário');
    return v;
  }

  async criar(ctx: Ctx, dto: CriarUsuarioDto) {
    if (!podeGerir(ctx.perfil, dto.perfil)) throw new ForbiddenException(`Seu perfil não pode criar contas ${dto.perfil}`);
    const email = dto.email.trim().toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      const v = await this.prisma.vinculoUnidadePerfil.findUnique({
        where: { usuarioId_unidadeId: { usuarioId: existente.id, unidadeId: ctx.unidadeId } },
      });
      if (v) throw new BadRequestException('Usuário já possui vínculo nesta unidade');
      if (!existente.ativo) throw new BadRequestException('Conta desativada; solicite reativação ao administrador');
    }
    return this.prisma.$transaction(async (tx) => {
      const usuario =
        existente ??
        (await tx.usuario.create({ data: { nome: dto.nome.trim(), email, postoGraduacao: dto.postoGraduacao?.trim() || null } }));
      await tx.vinculoUnidadePerfil.create({
        data: { usuarioId: usuario.id, unidadeId: ctx.unidadeId, perfil: dto.perfil, criadoPor: ctx.usuarioId },
      });
      await this.auditoria.registrar(tx, ctx, {
        acao: existente ? 'VINCULO_CRIADO' : 'USUARIO_CRIADO',
        entidade: 'Usuario',
        entidadeId: usuario.id,
        depois: { nome: usuario.nome, email, perfil: dto.perfil },
      });
      const convite = usuario.senhaHash ? null : await this.gerarConviteTx(tx, usuario.id, email, ctx);
      return { id: usuario.id, convite };
    });
  }

  // Versão transacional do gerador de convite.
  private async gerarConviteTx(tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0], usuarioId: string, email: string, ctx: Ctx) {
    await tx.convite.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: new Date() } });
    const token = novoToken();
    await tx.convite.create({
      data: { tipo: 'CONVITE', tokenHash: hashToken(token), email, usuarioId, criadoPor: ctx.usuarioId, expiraEm: new Date(Date.now() + CONVITE_HORAS * 3600000) },
    });
    return { link: `${env().appOrigin[0]}/convite/${token}`, expiraEmHoras: CONVITE_HORAS };
  }

  async desativar(ctx: Ctx, usuarioId: string, motivo: string) {
    const v = await this.vinculoAlvo(ctx, usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.vinculoUnidadePerfil.update({ where: { id: v.id }, data: { ativo: false } });
      const outros = await tx.vinculoUnidadePerfil.count({ where: { usuarioId, ativo: true } });
      if (outros === 0) {
        await tx.usuario.update({ where: { id: usuarioId }, data: { ativo: false, desativadoEm: new Date(), desativadoMotivo: motivo } });
      }
      // Revoga todas as sessões; designações e histórico são preservados.
      await tx.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await tx.convite.updateMany({ where: { usuarioId, usadoEm: null }, data: { usadoEm: new Date() } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'USUARIO_DESATIVADO', entidade: 'Usuario', entidadeId: usuarioId, motivo,
        antes: { vinculoAtivo: true }, depois: { vinculoAtivo: false, contaAtiva: outros > 0 },
      });
    });
  }

  async reativar(ctx: Ctx, usuarioId: string, motivo: string) {
    const v = await this.vinculoAlvo(ctx, usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.vinculoUnidadePerfil.update({ where: { id: v.id }, data: { ativo: true } });
      await tx.usuario.update({ where: { id: usuarioId }, data: { ativo: true, desativadoEm: null, desativadoMotivo: null } });
      await this.auditoria.registrar(tx, ctx, { acao: 'USUARIO_REATIVADO', entidade: 'Usuario', entidadeId: usuarioId, motivo });
    });
  }

  async alterarPerfil(ctx: Ctx, usuarioId: string, perfil: Perfil, motivo: string) {
    const v = await this.vinculoAlvo(ctx, usuarioId);
    if (!podeGerir(ctx.perfil, perfil)) throw new ForbiddenException(`Seu perfil não pode conceder ${perfil}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.vinculoUnidadePerfil.update({ where: { id: v.id }, data: { perfil } });
      await tx.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await this.auditoria.registrar(tx, ctx, {
        acao: 'PERFIL_ALTERADO', entidade: 'Usuario', entidadeId: usuarioId, motivo, antes: { perfil: v.perfil }, depois: { perfil },
      });
    });
  }

  async linkRedefinicao(ctx: Ctx, usuarioId: string) {
    const v = await this.vinculoAlvo(ctx, usuarioId);
    if (!v.usuario.ativo) throw new BadRequestException('Conta desativada');
    const tipo: TipoConvite = v.usuario.senhaHash ? 'RECUPERACAO' : 'CONVITE';
    const r = await this.gerarConvite(usuarioId, v.usuario.email, tipo, ctx);
    await this.auditoria.registrar(this.prisma, ctx, { acao: `LINK_${tipo}_GERADO`, entidade: 'Usuario', entidadeId: usuarioId });
    return r;
  }

  async revogarSessoes(ctx: Ctx, usuarioId: string) {
    await this.vinculoAlvo(ctx, usuarioId);
    const r = await this.prisma.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'SESSOES_REVOGADAS', entidade: 'Usuario', entidadeId: usuarioId, depois: { quantidade: r.count } });
    return { revogadas: r.count };
  }

  async resetarMfa(ctx: Ctx, usuarioId: string, motivo: string) {
    if (ctx.perfil !== 'ADMIN') throw new ForbiddenException('Somente administrador');
    await this.vinculoAlvo(ctx, usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: usuarioId }, data: { mfaAtivo: false, mfaSecretEnc: null } });
      await tx.sessao.updateMany({ where: { usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await this.auditoria.registrar(tx, ctx, { acao: 'MFA_RESETADO', entidade: 'Usuario', entidadeId: usuarioId, motivo });
    });
  }

  async concederSuporte(ctx: Ctx, usuarioId: string, horas: number, motivo: string) {
    const alvo = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!alvo?.ativo) throw new NotFoundException('Usuário não encontrado');
    const adminEmAlgumaUnidade = await this.prisma.vinculoUnidadePerfil.count({ where: { usuarioId, perfil: 'ADMIN', ativo: true } });
    if (!adminEmAlgumaUnidade) throw new BadRequestException('Suporte entre unidades só pode ser concedido a administradores');
    const c = await this.prisma.concessaoSuporte.create({
      data: { usuarioId, unidadeId: ctx.unidadeId, motivo, concedidoPor: ctx.usuarioId, fim: new Date(Date.now() + horas * 3600000) },
    });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'SUPORTE_CONCEDIDO', entidade: 'ConcessaoSuporte', entidadeId: c.id, motivo, depois: c });
    return c;
  }

  async revogarSuporte(ctx: Ctx, id: string) {
    const c = await this.prisma.concessaoSuporte.findFirst({ where: { id, unidadeId: ctx.unidadeId, revogadoEm: null } });
    if (!c) throw new NotFoundException('Concessão não encontrada');
    await this.prisma.concessaoSuporte.update({ where: { id }, data: { revogadoEm: new Date() } });
    await this.auditoria.registrar(this.prisma, ctx, { acao: 'SUPORTE_REVOGADO', entidade: 'ConcessaoSuporte', entidadeId: id });
  }

  listarSuporte(ctx: Ctx) {
    return this.prisma.concessaoSuporte.findMany({ where: { unidadeId: ctx.unidadeId }, orderBy: { inicio: 'desc' }, take: 50 });
  }
}
