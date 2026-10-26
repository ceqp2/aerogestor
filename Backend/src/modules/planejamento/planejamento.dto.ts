import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Prioridade, StatusDemanda } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { ItemPropostaDto } from './item-proposta.dto';
import { PaginacaoQuery } from '../../common/paginacao';
import { IsDataCivil, IsDinheiro } from '../../common/validadores';

export class CriarDemandaDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;
  @IsString() @IsNotEmpty() @MaxLength(5000)
  descricao: string;
  @IsString() @IsNotEmpty() @MaxLength(200)
  setorRequisitante: string;
  @IsOptional() @IsEnum(Prioridade)
  prioridade?: Prioridade;
  @IsOptional() @IsDinheiro()
  valorEstimado?: string;
  @IsOptional() @IsString() @MaxLength(60)
  numeroDfd?: string;
  @IsOptional() @IsString() @MaxLength(100)
  itemPca?: string;
  @IsOptional() @IsDataCivil()
  dataNecessidade?: string;
}

export class AtualizarDemandaDto extends PartialType(CriarDemandaDto) {}

export class StatusDemandaDto {
  @IsEnum(StatusDemanda)
  status: StatusDemanda;
  @IsOptional() @IsString() @MaxLength(1000)
  motivo?: string;
}

export class DemandasQuery extends PaginacaoQuery {
  @IsOptional() @Type(() => Number) @IsInt()
  exercicio?: number;
  @IsOptional() @IsEnum(StatusDemanda)
  status?: StatusDemanda;
}

export class CriarPropostaDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
  @IsString() @IsNotEmpty() @MaxLength(200)
  titulo: string;
}

export class NovaVersaoPropostaDto {
  @ApiProperty({ type: () => [ItemPropostaDto] })
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ItemPropostaDto)
  itens: ItemPropostaDto[];
  @IsOptional() @IsString() @MaxLength(2000)
  observacao?: string;
}
