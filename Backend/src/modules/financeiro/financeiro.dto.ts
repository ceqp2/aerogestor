import { TipoMovCredito, TipoMovEmpenho, TipoMovRap } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsDataCivil, IsDinheiro } from '../../common/validadores';

export class CriarCreditoDto {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
  @IsString() @IsNotEmpty() @MaxLength(20)
  ptres: string;
  @IsString() @IsNotEmpty() @MaxLength(20)
  fonte: string;
  @IsString() @IsNotEmpty() @MaxLength(20)
  naturezaDespesa: string;
  @IsOptional() @IsString() @MaxLength(30)
  planoInterno?: string;
  @IsOptional() @IsString() @MaxLength(20)
  ugr?: string;
  @IsOptional() @IsString() @MaxLength(300)
  descricao?: string;
  @IsDinheiro()
  valorInicial: string;
  @IsString() @MinLength(3) @MaxLength(200)
  documento: string;
  @IsDataCivil()
  dataMovimento: string;
}

export class MovimentoCreditoDto {
  @IsIn(['ACRESCIMO', 'REDUCAO'])
  tipo: Exclude<TipoMovCredito, 'INICIAL'>;
  @IsDinheiro()
  valor: string;
  @IsString() @MinLength(3) @MaxLength(200)
  documento: string;
  @IsDataCivil()
  dataMovimento: string;
  @IsOptional() @IsString() @MaxLength(1000)
  observacao?: string;
}

export class CriarEmpenhoDto {
  @IsString() @IsNotEmpty() @MaxLength(30)
  numero: string;
  @IsUUID()
  creditoId: string;
  @IsUUID()
  fornecedorId: string;
  @IsOptional() @IsUUID()
  processoId?: string;
  @IsOptional() @IsIn(['ORDINARIO', 'ESTIMATIVO', 'GLOBAL'])
  tipo?: string;
  @IsDataCivil()
  dataEmissao: string;
  @IsDinheiro()
  valor: string;
  @IsOptional() @IsString() @MaxLength(1000)
  descricao?: string;
  /** Rateio inicial opcional para um contrato */
  @IsOptional() @IsUUID()
  contratoId?: string;
}

export class MovimentoEmpenhoDto {
  @IsIn(['REFORCO', 'ANULACAO', 'LIQUIDACAO', 'ESTORNO_LIQUIDACAO', 'PAGAMENTO', 'ESTORNO_PAGAMENTO'])
  tipo: Exclude<TipoMovEmpenho, 'EMISSAO'>;
  @IsDinheiro()
  valor: string;
  /** Documento comprobatório (NE, NS, OB...). Obrigatório: lançamento sem evidência não é aceito. */
  @IsString() @MinLength(3) @MaxLength(200)
  documento: string;
  @IsDataCivil()
  dataMovimento: string;
  @IsOptional() @IsUUID()
  notaFiscalId?: string;
  @IsOptional() @IsUUID()
  contratoId?: string;
  @IsOptional() @IsUUID()
  estornoDeId?: string;
  @IsOptional() @IsString() @MaxLength(1000)
  observacao?: string;
}

export class RateioDto {
  @IsUUID()
  contratoId: string;
  @IsDinheiro()
  valor: string;
}

export class AlocacaoDto {
  @IsOptional() @IsUUID()
  creditoId?: string;
  @IsOptional() @IsUUID()
  demandaId?: string;
  @IsOptional() @IsUUID()
  processoId?: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
  @IsDinheiro()
  valor: string;
  @IsDataCivil()
  aprovadaEm: string;
  @IsOptional() @IsString() @MaxLength(200)
  documento?: string;
}

export class ConciliacaoDto {
  @IsString() @MinLength(3) @MaxLength(200)
  fonte: string;
}

export class InscricaoRapDto {
  @IsDataCivil()
  dataInscricao: string;
  @IsString() @MinLength(3) @MaxLength(200)
  documento: string;
}

export class MovimentoRapDto {
  @IsEnum(TipoMovRap)
  tipo: TipoMovRap;
  @IsDinheiro()
  valor: string;
  @IsDataCivil()
  dataMovimento: string;
  @IsString() @MinLength(3) @MaxLength(200)
  documento: string;
  @IsOptional() @IsUUID()
  estornoDeId?: string;
}

export class FinanceiroQuery {
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
}
