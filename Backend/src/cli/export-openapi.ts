/** Gera openapi.json (contrato da API) para o frontend gerar tipos: npm run openapi:export */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import * as path from 'path';
import { AppModule } from '../app.module';
import { documentoOpenApi } from '../config/swagger';

async function main() {
  process.env.JOBS_ENABLED = 'false';
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  const doc = documentoOpenApi(app);
  const destino = path.resolve(__dirname, '..', '..', 'openapi.json');
  writeFileSync(destino, JSON.stringify(doc, null, 2));
  console.log(`OpenAPI exportada em ${destino}`);
  await app.close();
}

main();
