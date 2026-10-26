import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../database/prisma.service';
import { AuditoriaService } from '../../common/auditoria.service';
import { cifrar, decifrar, hashToken, novoToken } from '../../common/crypto';
import { env } from '../../config/env';
import { hashSenha, validarPoliticaSenha, verificarSenha } from './senha';

authenticator.options = { window: 1, step: 30 };

const MAX_FALHAS = 5;
const BLOQUEIO_MIN = 15;

export interface MetaReq {
  ip?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService,
  ) {}

  private async criarSessao(usuarioId: string, unidadeId: string | null, mfaPendente: boolean, meta: MetaReq) {
    const token = novoToken();
    const csrf = novoToken(24);
    const expiraEm = new Date(Date.now() + env().sessionTtlHours * 3600 * 1000);
    const sessao = await this.prisma.sessao.create({
      data: {
        tokenHash: hashToken(token),
        csrfHash: hashToken(csrf),
        usuarioId,
        unidadeId,
        mfaPendente,
        expiraEm,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
      },
    });
    return { sessao, token, csrf };
  }

  async login(email: string, senha: string, meta: MetaReq) {
    const emailNorm = email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { email: emailNorm } });
    const agora = new Date();
    const erro = new UnauthorizedException('E-mail ou senha inválidos');

    if (usuario?.bloqueadoAte && usuario.bloqueadoAte > agora) {
      await verificarSenha(null, senha);
      throw new UnauthorizedException('Conta temporariamente bloqueada por tentativas inválidas. Tente mais tarde.');
    }
    const ok = await verificarSenha(usuario?.ativo ? usuario.senhaHash : null, senha);
    if (!usuario || !usuario.ativo || !ok) {
      if (usuario) {
        const falhas = usuario.tentativasFalhas + 1;
        await this.prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            tentativasFalhas: falhas >= MAX_FALHAS ? 0 : falhas,
            bloqueadoAte: falhas >= MAX_FALHAS ? new Date(agora.getTime() + BLOQUEIO_MIN * 60000) : undefined,
          },
        });
        await this.auditoria.registrar(this.prisma, { usuarioId: usuario.id, correlationId: meta.correlationId, ip: meta.ip }, {
          acao: falhas >= MAX_FALHAS ? 'LOGIN_BLOQUEADO' : 'LOGIN_FALHA',
          entidade: 'Usuario',
          entidadeId: usuario.id,
        });
      }
      throw erro;
    }

    const vinculos = await this.prisma.vinculoUnidadePerfil.findMany({ where: { usuarioId: usuario.id, ativo: true } });
    const unidadeInicial = vinculos.length === 1 ? vinculos[0].unidadeId : null;
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { tentativasFalhas: 0, bloqueadoAte: null, ultimoLogin: agora },
    });
    const s = await this.criarSessao(usuario.id, unidadeInicial, usuario.mfaAtivo, meta);
    await this.auditoria.registrar(
      this.prisma,
      { usuarioId: usuario.id, nome: usuario.nome, unidadeId: unidadeInicial ?? undefined, correlationId: meta.correlationId, ip: meta.ip },
      { acao: 'LOGIN', entidade: 'Sessao', entidadeId: s.sessao.id },
    );
    return { ...s, mfaPendente: usuario.mfaAtivo };
  }

  async verificarMfa(sessaoId: string, codigo: string, meta: MetaReq) {
    const sessao = await this.prisma.sessao.findUnique({ where: { id: sessaoId }, include: { usuario: true } });
    if (!sessao || !sessao.mfaPendente || !sessao.usuario.mfaSecretEnc) throw new BadRequestException('Nenhuma verificação pendente');
    const valido = authenticator.check(codigo, decifrar(sessao.usuario.mfaSecretEnc));
    if (!valido) {
      await this.auditoria.registrar(this.prisma, { usuarioId: sessao.usuarioId, correlationId: meta.correlationId, ip: meta.ip }, {
        acao: 'MFA_FALHA', entidade: 'Sessao', entidadeId: sessao.id,
      });
      throw new UnauthorizedException('Código inválido');
    }
    // Rotaciona a sessão ao elevar o nível de autenticação.
    await this.prisma.sessao.update({ where: { id: sessao.id }, data: { revogadaEm: new Date() } });
    return this.criarSessao(sessao.usuarioId, sessao.unidadeId, false, meta);
  }

  async me(sessaoId: string) {
    const sessao = await this.prisma.sessao.findUniqueOrThrow({ where: { id: sessaoId }, include: { usuario: true } });
    const u = sessao.usuario;
    const vinculos = await this.prisma.vinculoUnidadePerfil.findMany({
      where: { usuarioId: u.id, ativo: true, unidade: { ativo: true } },
      include: { unidade: true },
    });
    const agora = new Date();
    const concessoes = await this.prisma.concessaoSuporte.findMany({
      where: { usuarioId: u.id, revogadoEm: null, inicio: { lte: agora }, fim: { gt: agora } },
    });
    const unidadesSuporte = concessoes.length
      ? await this.prisma.unidade.findMany({ where: { id: { in: concessoes.map((c) => c.unidadeId) } } })
      : [];
    const unidades = [
      ...vinculos.map((v) => ({ id: v.unidadeId, sigla: v.unidade.sigla, nome: v.unidade.nome, nomeSecao: v.unidade.nomeSecao, perfil: v.perfil, suporte: false })),
      ...unidadesSuporte
        .filter((un) => !vinculos.some((v) => v.unidadeId === un.id))
        .map((un) => ({ id: un.id, sigla: un.sigla, nome: un.nome, nomeSecao: un.nomeSecao, perfil: 'ADMIN' as const, suporte: true })),
    ];
    const atual = unidades.find((x) => x.id === sessao.unidadeId) ?? null;
    return {
      usuario: { id: u.id, nome: u.nome, email: u.email, postoGraduacao: u.postoGraduacao, mfaAtivo: u.mfaAtivo },
      mfaPendente: sessao.mfaPendente,
      mfaObrigatorio: env().mfaEnforcePrivileged && !!atual && ['ADMIN', 'CHEFE', 'COMANDANTE'].includes(atual.perfil) && !u.mfaAtivo,
      unidades: sessao.mfaPendente ? [] : unidades,
      unidadeAtual: sessao.mfaPendente ? null : atual,
      expiraEm: sessao.expiraEm,
    };
  }

  async selecionarUnidade(sessaoId: string, unidadeId: string, meta: MetaReq) {
    const sessao = await this.prisma.sessao.findUniqueOrThrow({ where: { id: sessaoId } });
    if (sessao.mfaPendente) throw new UnauthorizedException('Verificação MFA pendente');
    const info = await this.me(sessaoId);
    if (!info.unidades.some((x) => x.id === unidadeId)) throw new ForbiddenException('Sem vínculo com esta unidade');
    await this.prisma.sessao.update({ where: { id: sessaoId }, data: { unidadeId } });
    await this.auditoria.registrar(this.prisma, { usuarioId: sessao.usuarioId, unidadeId, correlationId: meta.correlationId, ip: meta.ip }, {
      acao: 'SELECIONAR_UNIDADE', entidade: 'Sessao', entidadeId: sessaoId,
    });
  }

  async logout(sessaoId: string) {
    await this.prisma.sessao.updateMany({ where: { id: sessaoId, revogadaEm: null }, data: { revogadaEm: new Date() } });
  }

  async consultarConvite(token: string) {
    const c = await this.prisma.convite.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!c || c.usadoEm || c.expiraEm < new Date()) throw new BadRequestException('Convite inválido ou expirado');
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    if (!u.ativo) throw new BadRequestException('Convite inválido ou expirado');
    return { nome: u.nome, email: u.email, tipo: c.tipo };
  }

  async aceitarConvite(token: string, senha: string, meta: MetaReq) {
    const c = await this.prisma.convite.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!c || c.usadoEm || c.expiraEm < new Date()) throw new BadRequestException('Convite inválido ou expirado');
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: c.usuarioId } });
    if (!u.ativo) throw new BadRequestException('Convite inválido ou expirado');
    validarPoliticaSenha(senha, u.email, u.nome);
    const senhaHash = await hashSenha(senha);
    await this.prisma.$transaction(async (tx) => {
      // updateMany com usadoEm: null impede uso concorrente do mesmo token.
      const r = await tx.convite.updateMany({ where: { id: c.id, usadoEm: null }, data: { usadoEm: new Date() } });
      if (r.count !== 1) throw new BadRequestException('Convite já utilizado');
      await tx.usuario.update({ where: { id: u.id }, data: { senhaHash, tentativasFalhas: 0, bloqueadoAte: null } });
      await tx.sessao.updateMany({ where: { usuarioId: u.id, revogadaEm: null }, data: { revogadaEm: new Date() } });
      await this.auditoria.registrar(tx, { usuarioId: u.id, nome: u.nome, correlationId: meta.correlationId, ip: meta.ip }, {
        acao: c.tipo === 'CONVITE' ? 'CONVITE_ACEITO' : 'SENHA_REDEFINIDA', entidade: 'Usuario', entidadeId: u.id,
      });
    });
  }

  async trocarSenha(usuarioId: string, sessaoId: string, atual: string, nova: string, meta: MetaReq) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!(await verificarSenha(u.senhaHash, atual))) throw new BadRequestException('Senha atual incorreta');
    validarPoliticaSenha(nova, u.email, u.nome);
    const senhaHash = await hashSenha(nova);
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: u.id }, data: { senhaHash } });
      await tx.sessao.updateMany({ where: { usuarioId: u.id, revogadaEm: null, NOT: { id: sessaoId } }, data: { revogadaEm: new Date() } });
      await this.auditoria.registrar(tx, { usuarioId: u.id, nome: u.nome, correlationId: meta.correlationId, ip: meta.ip }, {
        acao: 'SENHA_ALTERADA', entidade: 'Usuario', entidadeId: u.id,
      });
    });
  }

  async configurarMfa(usuarioId: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (u.mfaAtivo) throw new BadRequestException('MFA já está ativo');
    const segredo = authenticator.generateSecret(20);
    await this.prisma.usuario.update({ where: { id: u.id }, data: { mfaSecretEnc: cifrar(segredo) } });
    const uri = authenticator.keyuri(u.email, 'AEROGEST GSD', segredo);
    return { qrCode: await QRCode.toDataURL(uri), segredo };
  }

  async ativarMfa(usuarioId: string, codigo: string, meta: MetaReq) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!u.mfaSecretEnc || u.mfaAtivo) throw new BadRequestException('Configure o MFA primeiro');
    if (!authenticator.check(codigo, decifrar(u.mfaSecretEnc))) throw new BadRequestException('Código inválido');
    await this.prisma.usuario.update({ where: { id: u.id }, data: { mfaAtivo: true } });
    await this.auditoria.registrar(this.prisma, { usuarioId: u.id, nome: u.nome, correlationId: meta.correlationId, ip: meta.ip }, {
      acao: 'MFA_ATIVADO', entidade: 'Usuario', entidadeId: u.id,
    });
  }

  sessoes(usuarioId: string) {
    return this.prisma.sessao.findMany({
      where: { usuarioId, revogadaEm: null, expiraEm: { gt: new Date() } },
      select: { id: true, criadaEm: true, ultimoUso: true, ip: true, userAgent: true, expiraEm: true },
      orderBy: { ultimoUso: 'desc' },
    });
  }

  async revogarSessao(usuarioId: string, id: string) {
    await this.prisma.sessao.updateMany({ where: { id, usuarioId, revogadaEm: null }, data: { revogadaEm: new Date() } });
  }
}
