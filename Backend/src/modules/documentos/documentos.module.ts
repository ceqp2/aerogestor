import {
  Body, Controller, Get, HttpCode, Module, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { TipoVinculoDoc } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { C, Ctx, Perfis, SECRETARIA, TODOS } from '../../common/contexto';
import { env } from '../../config/env';
import { DocumentosService } from './documentos.service';
import { StorageService } from './storage';

const CATEGORIAS = [
  'DFD', 'ETP', 'TR_PROJETO', 'PESQUISA_PRECOS', 'ANALISE_RISCOS', 'MATRIZ_ALOCACAO_RISCOS', 'PARECER_JURIDICO', 'AUTORIZACAO', 'EDITAL_AVISO',
  'CONTRATO', 'ADITIVO', 'DESIGNACAO', 'NOTA_FISCAL', 'RELATORIO', 'EVIDENCIA', 'COMUNICACAO', 'ATA', 'EMPENHO', 'OUTRO',
] as const;

class UploadDto {
  @IsString() @IsNotEmpty() @MaxLength(300) titulo: string;
  @IsString() @IsNotEmpty() @MaxLength(60) categoria: string;
  @IsEnum(TipoVinculoDoc) vinculoTipo: TipoVinculoDoc;
  @IsUUID() vinculoId: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() liberadoGestor?: boolean;
}

class AtualizarDocDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) titulo?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(60) categoria?: string;
  @IsOptional() @IsBoolean() liberadoGestor?: boolean;
}

class ArquivarDto {
  @IsString() @MinLength(5) @MaxLength(1000) motivo: string;
}

class VincularDto {
  @IsEnum(TipoVinculoDoc) tipo: TipoVinculoDoc;
  @IsUUID() entidadeId: string;
}

class ListarDocsQuery {
  @IsOptional() @IsEnum(TipoVinculoDoc) vinculoTipo?: TipoVinculoDoc;
  @IsOptional() @IsUUID() vinculoId?: string;
  @IsOptional() @IsString() @MaxLength(100) busca?: string;
  @IsOptional() @IsString() @MaxLength(60) categoria?: string;
}

const upload = () =>
  FileInterceptor('arquivo', { storage: memoryStorage(), limits: { fileSize: env().uploadMaxBytes, files: 1, fields: 10 } });

function enviarArquivo(res: Response, r: { dados: Buffer; mime: string; nome: string }) {
  res.setHeader('Content-Type', r.mime);
  res.setHeader('Content-Length', r.dados.length);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  const ascii = r.nome.replace(/[^\x20-\x7e]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(r.nome)}`);
  res.end(r.dados);
}

@ApiTags('documentos')
@Controller('documentos')
class DocumentosController {
  constructor(private s: DocumentosService) {}

  @Perfis(...TODOS) @Get('categorias')
  categorias() {
    return CATEGORIAS;
  }

  @Perfis(...TODOS) @Get()
  listar(@C() ctx: Ctx, @Query() q: ListarDocsQuery) {
    return this.s.listar(ctx, q);
  }

  @Perfis(...TODOS) @Post() @ApiConsumes('multipart/form-data') @UseInterceptors(upload())
  enviar(@C() ctx: Ctx, @UploadedFile() arquivo: Express.Multer.File, @Body() dto: UploadDto) {
    return this.s.enviar(ctx, arquivo, dto);
  }

  @Perfis(...TODOS) @Post(':id/versoes') @ApiConsumes('multipart/form-data') @UseInterceptors(upload())
  versao(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() arquivo: Express.Multer.File) {
    return this.s.novaVersao(ctx, id, arquivo);
  }

  @Perfis(...TODOS) @Get(':id/download')
  async baixar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response, @Query('versao', new ParseIntPipe({ optional: true })) versao?: number) {
    enviarArquivo(res, await this.s.baixar(ctx, id, versao));
  }

  @Perfis(...SECRETARIA) @Patch(':id')
  atualizar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarDocDto) {
    return this.s.atualizar(ctx, id, dto);
  }

  @Perfis(...SECRETARIA) @Post(':id/arquivar') @HttpCode(200)
  async arquivar(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArquivarDto) {
    await this.s.arquivar(ctx, id, dto.motivo);
    return { ok: true };
  }

  @Perfis(...SECRETARIA) @Post(':id/vinculos')
  vincular(@C() ctx: Ctx, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VincularDto) {
    return this.s.vincular(ctx, id, dto.tipo, dto.entidadeId);
  }
}

@Module({ controllers: [DocumentosController], providers: [DocumentosService, StorageService], exports: [DocumentosService, StorageService] })
export class DocumentosModule {}
