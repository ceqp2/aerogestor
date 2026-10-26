/**
 * Cria o administrador inicial SEM senha padrão: gera um link de convite de uso único (72 h)
 * para que o próprio administrador defina sua senha.
 *
 * Uso: npm run admin:create -- --email admin@orgao.gov.br --nome "Nome Completo" [--unidade GSD-SJ]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashToken, novoToken } from '../common/crypto';
import { env } from '../config/env';

function arg(nome: string) {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const nome = arg('nome')?.trim();
  const sigla = arg('unidade') ?? 'GSD-SJ';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !nome) {
    console.error('Uso: npm run admin:create -- --email <email> --nome "<nome>" [--unidade <SIGLA>]');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const unidade = await prisma.unidade.findUnique({ where: { sigla } });
    if (!unidade) throw new Error(`Unidade ${sigla} não encontrada. Execute "npm run db:seed" antes.`);
    const usuario = await prisma.usuario.upsert({ where: { email }, create: { email, nome }, update: {} });
    await prisma.vinculoUnidadePerfil.upsert({
      where: { usuarioId_unidadeId: { usuarioId: usuario.id, unidadeId: unidade.id } },
      create: { usuarioId: usuario.id, unidadeId: unidade.id, perfil: 'ADMIN' },
      update: { perfil: 'ADMIN', ativo: true },
    });
    await prisma.convite.updateMany({ where: { usuarioId: usuario.id, usadoEm: null }, data: { usadoEm: new Date() } });
    const token = novoToken();
    await prisma.convite.create({
      data: { tipo: usuario.senhaHash ? 'RECUPERACAO' : 'CONVITE', tokenHash: hashToken(token), email, usuarioId: usuario.id, expiraEm: new Date(Date.now() + 72 * 3600000) },
    });
    await prisma.registroAuditoria.create({
      data: { unidadeId: unidade.id, acao: 'ADMIN_CRIADO_CLI', entidade: 'Usuario', entidadeId: usuario.id, depois: { email, perfil: 'ADMIN' }, motivo: 'Comando admin:create' },
    });
    console.log(`\nAdministrador ${email} vinculado à unidade ${sigla}.`);
    console.log('Link de definição de senha (uso único, expira em 72 h) — entregue por canal seguro:\n');
    console.log(`  ${env().appOrigin[0]}/convite/${token}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
