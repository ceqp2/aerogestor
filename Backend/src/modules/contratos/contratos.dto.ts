import { OmitType, PartialType } from '@nestjs/swagger';
import { FuncaoDesignacao, NaturezaInstrumento, SituacaoContrato, TipoAditivo, TipoInstrumento } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginacaoQuery } from '../../common/paginacao';
import { IsDataCivil, IsDinheiro, IsQuantidade } from '../../common/validadores';

export class FornecedorDto {
  @IsString() @MaxLength(18)
  documento: string;
  @IsString() @IsNotEmpty() @MaxLength(300)
  razaoSocial: string;
  @IsOptional() @IsEmail() @MaxLength(200)
  email?: string;
  @IsOptional() @IsString() @MaxLength(30)
  telefone?: string;
}

export class CriarContratoDto {
  @IsString() @IsNotEmpty() @MaxLength(60)
  numero: string;
  @IsEnum(TipoInstrumento)
  tipo: TipoInstrumento;
  @IsEnum(NaturezaInstrumento)
  natureza: NaturezaInstrumento;
  @IsOptional() @IsUUID()
  processoId?: string;
  @IsOptional() @IsUUID()
  ataId?: string;
  @IsUUID()
  fornecedorId: string;
  @IsString() @IsNotEmpty() @MaxLength(3000)
  objeto: string;
  @IsDinheiro()
  valorInicial: string;
  @IsOptional() @IsDataCivil()
  dataAssinatura?: string;
  @IsDataCivil()
  vigenciaInicio: string;
  @IsDataCivil()
  vigenciaFim: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(36500)
  prazoExecucaoDias?: number;
  @IsOptional() @IsDataCivil()
  inicioPrevisto?: string;
  @IsOptional() @IsString() @MaxLength(100)
  reajusteIndice?: string;
  @IsOptional() @IsString() @MaxLength(100)
  garantiaTipo?: string;
  @IsOptional() @IsDinheiro()
  garantiaValor?: string;
  @IsOptional() @IsDataCivil()
  garantiaValidade?: string;
  @IsOptional() @IsString() @MaxLength(5000)
  obrigacoes?: string;
}

/** Edição ordinária não altera valor nem vigência (somente por aditivo ou correção administrativa). */
export class AtualizarContratoDto extends PartialType(
  OmitType(CriarContratoDto, ['valorInicial', 'vigenciaInicio', 'vigenciaFim', 'numero', 'fornecedorId'] as const),
) {
  @IsOptional() @IsDataCivil()
  inicioReal?: string;
}

export class CorrecaoContratoDto {
  @IsOptional() @IsDinheiro()
  valorInicial?: string;
  @IsOptional() @IsDinheiro()
  valorAtualizado?: string;
  @IsOptional() @IsDataCivil()
  vigenciaInicio?: string;
  @IsOptional() @IsDataCivil()
  vigenciaFim?: string;
  @IsOptional() @IsString() @MaxLength(60)
  numero?: string;
  @IsString() @MinLength(10) @MaxLength(2000)
  motivo: string;
}

export class SituacaoContratoDto {
  @IsEnum(SituacaoContrato)
  situacao: SituacaoContrato;
  @IsString() @MinLength(5) @MaxLength(2000)
  motivo: string;
  @IsOptional() @IsDataCivil()
  data?: string;
}

export class ItemContratoDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  descricao: string;
  @IsString() @IsNotEmpty() @MaxLength(30)
  unidadeMedida: string;
  @IsQuantidade()
  quantidade: string;
  @IsDinheiro()
  valorUnitario: string;
  @IsOptional() @IsUUID()
  itemAtaId?: string;
}

export class IndicarDesignacaoDto {
  @IsUUID()
  usuarioId: string;
  @IsEnum(FuncaoDesignacao)
  funcao: FuncaoDesignacao;
  @IsDataCivil()
  inicio: string;
  @IsOptional() @IsDataCivil()
  fim?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  escopo?: string;
}

export class ConfirmarDesignacaoDto {
  @IsString() @MinLength(3) @MaxLength(300)
  documentoDesignacao: string;
  @IsDataCivil()
  dataDocumento: string;
}

export class EncerrarDesignacaoDto {
  @IsDataCivil()
  fim: string;
  @IsString() @MinLength(5) @MaxLength(1000)
  motivo: string;
}

export class AditivoDto {
  @IsString() @IsNotEmpty() @MaxLength(40)
  numero: string;
  @IsEnum(TipoAditivo)
  tipo: TipoAditivo;
  @IsString() @MinLength(5) @MaxLength(2000)
  fundamento: string;
  @IsString() @MinLength(3) @MaxLength(300)
  documento: string;
  @IsDataCivil()
  dataAssinatura: string;
  @IsOptional() @IsDinheiro()
  novoValor?: string;
  @IsOptional() @IsDataCivil()
  novaVigenciaFim?: string;
}

export class ContratosQuery extends PaginacaoQuery {
  @IsOptional() @IsEnum(SituacaoContrato)
  situacao?: SituacaoContrato;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(3650)
  vencendoEmDias?: number;
  @IsOptional() @IsEnum(NaturezaInstrumento)
  natureza?: NaturezaInstrumento;
  @IsOptional() @IsString() @MaxLength(10)
  semDesignacao?: string;
}
