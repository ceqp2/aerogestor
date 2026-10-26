import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { env } from '../../config/env';

/** Armazenamento privado de arquivos. Nunca dentro de pasta pública; chaves são aleatórias. */
export interface Storage {
  salvar(chave: string, dados: Buffer, mime: string): Promise<void>;
  ler(chave: string): Promise<Buffer>;
  remover(chave: string): Promise<void>;
}

const CHAVE_SEGURA = /^[a-f0-9]{64}$/;

function validarChave(chave: string) {
  if (!CHAVE_SEGURA.test(chave)) throw new Error('Chave de armazenamento inválida');
}

export class LocalStorage implements Storage {
  private base = path.resolve(env().storageLocalDir);

  private caminho(chave: string) {
    validarChave(chave);
    // Subpastas por prefixo evitam diretórios enormes.
    return path.join(this.base, chave.slice(0, 2), chave);
  }

  async salvar(chave: string, dados: Buffer) {
    const p = this.caminho(chave);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, dados, { flag: 'wx', mode: 0o600 });
  }

  ler(chave: string) {
    return fs.readFile(this.caminho(chave));
  }

  async remover(chave: string) {
    await fs.rm(this.caminho(chave), { force: true });
  }
}

export class S3Storage implements Storage {
  private client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  private bucket = process.env.S3_BUCKET as string;

  async salvar(chave: string, dados: Buffer, mime: string) {
    validarChave(chave);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: chave, Body: dados, ContentType: mime, ServerSideEncryption: 'AES256' }));
  }

  async ler(chave: string) {
    validarChave(chave);
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: chave }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async remover(chave: string) {
    validarChave(chave);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: chave }));
  }
}

@Injectable()
export class StorageService implements Storage {
  private impl: Storage;
  constructor() {
    if (env().storageDriver === 's3') {
      if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET obrigatório para STORAGE_DRIVER=s3');
      this.impl = new S3Storage();
    } else {
      this.impl = new LocalStorage();
    }
    new Logger('Storage').log(`Driver de armazenamento: ${env().storageDriver}`);
  }
  salvar(c: string, d: Buffer, m: string) {
    return this.impl.salvar(c, d, m);
  }
  ler(c: string) {
    return this.impl.ler(c);
  }
  remover(c: string) {
    return this.impl.remover(c);
  }
}
