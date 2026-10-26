import { TipoRecebimento, TipoRegistroExecucao } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsDataCivil, IsDinheiro, IsQuantidade } from '../../common/validadores';

export class EntregaDto {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  descricao: string;
  @IsOptional() @IsString() @MaxLength(300)
  local?: string;
  @IsQuantidade()
  quantidadePrevista: string;
  @IsDataCivil()
  prazo: string;
}

export class RecebimentoDto {
  @IsEnum(TipoRecebimento)
  tipo: TipoRecebimento;
  @IsOptional() @IsQuantidade()
  quantidade?: string;
  @IsDataCivil()
  data: string;
  @IsOptional() @IsString() @MaxLength(2000)
  observacao?: string;
}

export class MedicaoDto {
  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'competencia no formato AAAA-MM' })
  competencia: string;
  @IsString() @IsNotEmpty() @MaxLength(2000)
  descricao: string;
  @IsString() @Matches(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, { message: 'percentual entre 0 e 100' })
  percentualFisico: string;
  @IsDinheiro()
  valor: string;
  @IsOptional() @IsString() @MaxLength(2000)
  inconformidades?: string;
}

export class RegistroExecucaoDto {
  @IsEnum(TipoRegistroExecucao)
  tipo: TipoRegistroExecucao;
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;
  @IsString() @IsNotEmpty() @MaxLength(10000)
  texto: string;
  @IsDataCivil()
  data: string;
}

export class NotaFiscalDto {
  @IsString() @IsNotEmpty() @MaxLength(30)
  numero: string;
  @IsOptional() @IsString() @MaxLength(10)
  serie?: string;
  @IsOptional() @IsString() @Matches(/^\d{44}$/, { message: 'chave de acesso com 44 dígitos' })
  chaveAcesso?: string;
  @IsDataCivil()
  dataEmissao: string;
  @IsDataCivil()
  dataRecebimento: string;
  @IsDinheiro()
  valor: string;
}

export class AtestoDto {
  @IsDataCivil()
  data: string;
  @IsOptional() @IsString() @MaxLength(2000)
  observacao?: string;
}

export class MotivoExecDto {
  @IsString() @MinLength(5) @MaxLength(2000)
  motivo: string;
}
