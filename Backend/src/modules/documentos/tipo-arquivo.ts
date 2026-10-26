/**
 * Validação do tipo REAL do arquivo por assinatura (magic bytes) + extensão coerente.
 * Não confia no Content-Type enviado pelo cliente.
 */
export interface TipoDetectado {
  mime: string;
  extensao: string;
}

const ZIP_OFFICE: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

function comeca(b: Buffer, bytes: number[], offset = 0) {
  return bytes.every((x, i) => b[offset + i] === x);
}

function textoValido(b: Buffer) {
  if (b.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
    return true;
  } catch {
    return false;
  }
}

export function detectarTipo(buf: Buffer, nomeOriginal: string): TipoDetectado | null {
  const ext = (nomeOriginal.split('.').pop() ?? '').toLowerCase();
  if (comeca(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]) && ext === 'pdf') return { mime: 'application/pdf', extensao: 'pdf' };
  if (comeca(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && ext === 'png') return { mime: 'image/png', extensao: 'png' };
  if (comeca(buf, [0xff, 0xd8, 0xff]) && (ext === 'jpg' || ext === 'jpeg')) return { mime: 'image/jpeg', extensao: 'jpg' };
  if (comeca(buf, [0x52, 0x49, 0x46, 0x46]) && comeca(buf, [0x57, 0x45, 0x42, 0x50], 8) && ext === 'webp') return { mime: 'image/webp', extensao: 'webp' };
  if (comeca(buf, [0x50, 0x4b, 0x03, 0x04]) && ZIP_OFFICE[ext]) return { mime: ZIP_OFFICE[ext], extensao: ext };
  if ((ext === 'txt' || ext === 'csv') && textoValido(buf)) return { mime: ext === 'csv' ? 'text/csv' : 'text/plain', extensao: ext };
  return null;
}

/** Nome seguro para exibição/Content-Disposition (sem caminhos ou caracteres de controle). */
export function nomeSeguro(nome: string) {
  const base = nome.split(/[\\/]/).pop() ?? 'arquivo';
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\x00-\x1f\x7f"<>|:*?]/g, '_').slice(0, 180) || 'arquivo';
}
