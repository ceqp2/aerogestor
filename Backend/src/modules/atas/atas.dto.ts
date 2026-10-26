import { PartialType, OmitType } from '@nestjs/swagger';
import { TipoMovQtdAta, TipoVinculoAta } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginacaoQuery } from '../../common/paginacao';
import { IsDataCivil, IsDinheiro, IsQuantidade } from '../../common/validadores';

export class CriarAtaDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  numero: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  ano?: number;
  @IsOptional() @IsString() @MaxLength(80)
  idPncp?: string;
  @IsString() @IsNotEmpty() @MaxLength(300)
  orgaoGerenciador: string;
  @IsOptional() @IsString() @MaxLength(20)
  cnpjGerenciador?: string;
  @IsOptional() @IsString() @MaxLength(20)
  uasg?: string;
  @IsString() @IsNotEmpty() @MaxLength(3000)
  objeto: string;
  @IsOptional() @IsString() @MaxLength(100)
  processoOrigem?: string;
  @IsDataCivil()
  vigenciaInicio: string;
  @IsDataCivil()
  vigenciaFim: string;
}

export class AtualizarAtaDto extends PartialType(OmitType(CriarAtaDto, ['vigenciaInicio', 'vigenciaFim'] as const)) {
  @IsOptional() @IsBoolean()
  cancelada?: boolean;
}

export class AlterarVigenciaAtaDto {
  @IsDataCivil()
  vigenciaFim: string;
  @IsString() @MinLength(3) @MaxLength(300)
  documento: string;
  @IsString() @MinLength(10) @MaxLength(2000)
  fundamento: string;
}

export class AutorizarUtilizacaoDto {
  @IsIn(['GERENCIADOR', 'PARTICIPANTE', 'ADESAO'])
  tipoVinculo: Exclude<TipoVinculoAta, 'CONSULTA'>;
  @IsString() @MinLength(3) @MaxLength(300)
  documento: string;
  /** Para adesão: processo (forma ADESAO_ATA) com o dossiê de justificativas */
  @IsOptional() @IsUUID()
  processoAdesaoId?: string;
}

export class ItemAtaDto {
  @Type(() => Number) @IsInt() @Min(1)
  numeroItem: number;
  @IsString() @IsNotEmpty() @MaxLength(2000)
  descricao: string;
  @IsOptional() @IsUUID()
  fornecedorId?: string;
  @IsString() @IsNotEmpty() @MaxLength(30)
  unidadeMedida: string;
  @IsOptional() @IsString() @MaxLength(20)
  codigoCatalogo?: string;
  /** vazio = desconhecido na fonte */
  @IsOptional() @IsQuantidade()
  quantidadeRegistrada?: string;
  @IsQuantidade()
  quantidadeDestinada: string;
  @IsDinheiro()
  precoUnitario: string;
}

export class AlterarDestinadaDto {
  @IsQuantidade()
  quantidadeDestinada: string;
  @IsString() @MinLength(5) @MaxLength(1000)
  motivo: string;
}

export class MovimentoAtaDto {
  @IsEnum(TipoMovQtdAta)
  tipo: TipoMovQtdAta;
  @IsQuantidade()
  quantidade: string;
  @IsOptional() @IsUUID()
  processoId?: string;
  @IsOptional() @IsUUID()
  contratoId?: string;
  @IsOptional() @IsString() @MaxLength(300)
  documento?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  motivo?: string;
}

export class AtasQuery extends PaginacaoQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  vencendoEmDias?: number;
  @IsOptional() @IsEnum(TipoVinculoAta)
  tipoVinculo?: TipoVinculoAta;
  @IsOptional() @IsIn(['vigentes', 'expiradas', 'todas'])
  vigencia?: string;
}
