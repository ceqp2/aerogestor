import { randomUUID } from 'crypto';
import type { NextFunction, Response } from 'express';
import type { ReqAuth } from './contexto';

export function correlationMiddleware(req: ReqAuth, res: Response, next: NextFunction) {
  const recebido = req.header('x-correlation-id');
  const id = recebido && /^[\w-]{8,64}$/.test(recebido) ? recebido : randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}
