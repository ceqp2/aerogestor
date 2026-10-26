import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { ReqAuth } from './contexto';

/** Erros padronizados: { statusCode, error, message, correlationId }. Não vaza detalhes internos. */
@Catch()
export class ErrosFilter implements ExceptionFilter {
  private log = new Logger('Erros');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<ReqAuth>();
    const correlationId = req.correlationId;
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno. Informe o código de correlação ao suporte.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      message = typeof r === 'string' ? r : ((r as { message?: string | string[] }).message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Registro duplicado: já existe um item com esses dados.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Registro não encontrado.';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        message = 'Referência inválida ou registro em uso.';
      } else {
        this.log.error(`[${correlationId}] Prisma ${exception.code}: ${exception.message}`);
      }
    } else {
      const e = exception as Error;
      this.log.error(`[${correlationId}] ${e?.message}`, e?.stack);
    }

    if (res.headersSent) return;
    res.status(status).json({ statusCode: status, error: HttpStatus[status] ?? 'Error', message, correlationId });
  }
}
