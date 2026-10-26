import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function documentoOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('AEROGEST GSD API')
    .setDescription(
      'API de apoio à gestão de aquisições e contratos. Autenticação por cookie de sessão HttpOnly; ' +
        'requisições de escrita exigem o cabeçalho X-CSRF-Token com o valor do cookie aerogest_csrf.',
    )
    .setVersion('1.0.0')
    .addCookieAuth('aerogest_sid')
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function configurarSwagger(app: INestApplication) {
  SwaggerModule.setup('api/docs', app, documentoOpenApi(app), { jsonDocumentUrl: 'api/docs/openapi.json' });
}
