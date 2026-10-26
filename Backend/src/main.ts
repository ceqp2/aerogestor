import 'dotenv/config';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { correlationMiddleware } from './common/correlation.middleware';
import { ErrosFilter } from './common/http-exception.filter';
import { env } from './config/env';
import { configurarSwagger } from './config/swagger';

async function bootstrap() {
  const cfg = env();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: cfg.isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
  });

  app.set('trust proxy', 1); // atrás do reverse proxy TLS
  app.disable('x-powered-by');
  app.use(correlationMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // a documentação Swagger (somente fora de produção) precisa de estilos inline
          'script-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.enableCors({ origin: cfg.appOrigin, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }),
  );
  app.useGlobalFilters(new ErrosFilter());
  app.enableShutdownHooks();

  if (!cfg.isProd) configurarSwagger(app);

  await app.listen(cfg.port, '0.0.0.0');
  new Logger('Bootstrap').log(`API AEROGEST GSD ouvindo em http://localhost:${cfg.port}/api/v1 (${cfg.nodeEnv})`);
}

bootstrap();
