import { EstadoChecklist, EtapaProcesso, FormaContratacao, HipoteseDireta, Modalidade, Prioridade, SituacaoProcesso, TipoObjeto } from '@prisma/client';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { IsDataCivil, IsDinheiro, IsQuantidade } from '../../common/validadores';
import { ModeloItemDto } from './modelo-item.dto';
import { PaginacaoQuery } from '../../common/paginacao';

export class CriarProcessoDto {
  @IsOptional() @IsString() @MaxLength(40)
  nup?: string;
  @Type(() => Number) @IsInt() @Min(2000) @Max(2100)
  exercicio: number;
  @IsString() @IsNotEmpty() @MaxLength(2000)
  objeto: string;
  @IsEnum(TipoObjeto)
  tipoObjeto: TipoObjeto;
  @IsOptional() @IsString() @MaxLength(300)
  origemDemanda?: string;
  @IsOptional() @IsString() @MaxLength(200)
  setorRequisitante?: string;
  @IsOptional() @IsEnum(Prioridade)
  prioridade?: Prioridade;
  @IsOptional() @IsDinheiro()
  valorEstimado?: string;
  @IsEnum(FormaContratacao)
  formaContratacao: FormaContratacao;
  @IsOptional() @IsEnum(Modalidade)
  modalidade?: Modalidade | null;
  @IsOptional() @IsEnum(HipoteseDireta)
  hipoteseDireta?: HipoteseDireta | null;
  @IsOptional() @IsString() @MaxLength(200)
  procedimentoAuxiliar?: string;
  @IsOptional() @IsString() @MaxLength(500)
  fundamentoLegal?: string;
  @IsOptional() @IsUUID()
  responsavelId?: string | null;
  @IsOptional() @IsUUID()
  ataId?: string | null;
  @IsOptional() @IsDataCivil()
  dataInicioPrevista?: string;
  @IsOptional() @IsDataCivil()
  dataConclusaoPrevista?: string;
  @IsOptional() @IsUUID()
  modeloChecklistId?: string;
  @IsOptional() @IsUUID()
  demandaId?: string;
}

export class AtualizarProcessoDto extends PartialType(CriarProcessoDto) {
  @IsOptional() @IsDataCivil()
  dataInicioReal?: string;
  @IsOptional() @IsDataCivil()
  dataConclusaoReal?: string;
}

export class ProcessosQuery extends PaginacaoQuery {
  @IsOptional() @IsEnum(EtapaProcesso)
  etapa?: EtapaProcesso;
  @IsOptional() @IsEnum(SituacaoProcesso)
  situacao?: SituacaoProcesso;
  @IsOptional() @IsEnum(FormaContratacao)
  forma?: FormaContratacao;
  @IsOptional() @Type(() => Number) @IsInt()
  exercicio?: number;
  @IsOptional() @IsIn(['a_iniciar', 'iniciados', 'finalizados', 'atrasados'])
  indicador?: string;
}

export class MudarEtapaDto {
  @IsEnum(EtapaProcesso)
  etapa: EtapaProcesso;
  @IsOptional() @IsString() @MaxLength(1000)
  motivo?: string;
}

export class MudarSituacaoDto {
  @IsEnum(SituacaoProcesso)
  situacao: SituacaoProcesso;
  @IsString() @MinLength(5) @MaxLength(1000)
  justificativa: string;
}

export class AtualizarChecklistItemDto {
  @IsOptional() @IsEnum(EstadoChecklist)
  estado?: EstadoChecklist;
  @IsOptional() @IsString() @MaxLength(2000)
  observacao?: string;
  @IsOptional() @IsString() @MaxLength(2000)
  justificativaNA?: string;
  @IsOptional() @IsUUID()
  responsavelId?: string | null;
  @IsOptional() @IsUUID()
  atribuidoGestorId?: string | null;
  @IsOptional() @IsDataCivil()
  prazo?: string | null;
  /** Motivo obrigatório ao reabrir item concluído/não aplicável */
  @IsOptional() @IsString() @MaxLength(1000)
  motivoReabertura?: string;
}

export class RevisarNaDto {
  @IsBoolean()
  aprovado: boolean;
  @IsOptional() @IsString() @MaxLength(1000)
  comentario?: string;
}

export class NovoChecklistItemDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;
  @IsEnum(EtapaProcesso)
  etapa: EtapaProcesso;
  @IsOptional() @IsBoolean()
  critico?: boolean;
  @IsOptional() @IsBoolean()
  exigeEvidencia?: boolean;
  @IsOptional() @IsString() @MaxLength(300)
  referenciaNormativa?: string;
}

export class AplicarModeloDto {
  @IsUUID()
  modeloId: string;
}

export class ItemProcessoDto {
  @IsString() @IsNotEmpty() @MaxLength(1000)
  descricao: string;
  @IsOptional() @IsString() @MaxLength(20)
  codigoCatalogo?: string;
  @IsOptional() @IsIn(['CATMAT', 'CATSER'])
  tipoCatalogo?: string;
  @IsString() @IsNotEmpty() @MaxLength(30)
  unidadeMedida: string;
  @IsQuantidade()
  quantidade: string;
  @IsOptional() @IsDinheiro()
  valorUnitarioEstimado?: string;
}

export class CriarModeloDto {
  @IsString() @IsNotEmpty() @MaxLength(200)
  nome: string;
  @IsEnum(FormaContratacao)
  formaContratacao: FormaContratacao;
  @IsOptional() @IsEnum(TipoObjeto)
  tipoObjeto?: TipoObjeto;
  @IsOptional() @IsString() @MaxLength(500)
  fonte?: string;
  @ApiProperty({ type: () => [ModeloItemDto] })
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ModeloItemDto)
  itens: ModeloItemDto[];
}
