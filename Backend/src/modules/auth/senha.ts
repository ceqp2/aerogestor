import { BadRequestException } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';

// Argon2id com parâmetros recomendados pela OWASP (m=19 MiB, t=2, p=1).
const OPCOES = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashSenha = (senha: string) => hash(senha, OPCOES);

// Hash fixo usado quando o usuário não existe, para equalizar o tempo de resposta.
let hashFicticio: string | null = null;
export async function verificarSenha(hashArmazenado: string | null | undefined, senha: string): Promise<boolean> {
  if (!hashArmazenado) {
    hashFicticio ??= await hashSenha('senha-ficticia-para-tempo-constante');
    await verify(hashFicticio, senha).catch(() => false);
    return false;
  }
  return verify(hashArmazenado, senha).catch(() => false);
}

const COMUNS = ['123456', 'senha', 'password', 'qwerty', 'aerogest', 'admin', 'forcaaerea', '12345678'];

/** Política: 12+ caracteres, 3 de 4 classes, sem e-mail/nome e sem padrões comuns. */
export function validarPoliticaSenha(senha: string, email: string, nome?: string) {
  const erros: string[] = [];
  if (senha.length < 12) erros.push('mínimo de 12 caracteres');
  if (senha.length > 128) erros.push('máximo de 128 caracteres');
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(senha)).length;
  if (classes < 3) erros.push('use ao menos 3 entre: minúsculas, maiúsculas, números e símbolos');
  const baixa = senha.toLowerCase();
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 3 && baixa.includes(local)) erros.push('não pode conter o e-mail');
  if (nome && nome.split(/\s+/).some((p) => p.length >= 4 && baixa.includes(p.toLowerCase()))) erros.push('não pode conter o nome');
  if (COMUNS.some((c) => baixa.includes(c))) erros.push('contém padrão muito comum');
  if (/(.)\1{3,}/.test(senha)) erros.push('evite repetir o mesmo caractere');
  if (erros.length) throw new BadRequestException(`Senha não atende à política: ${erros.join('; ')}`);
}
