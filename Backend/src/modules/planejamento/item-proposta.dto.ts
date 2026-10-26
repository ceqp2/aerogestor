import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IsDinheiro } from '../../common/validadores';

export class ItemPropostaDto {
  @IsString() @IsNotEmpty() @MaxLength(500)
  descricao: string;
  @IsString() @IsNotEmpty() @MaxLength(20)
  naturezaDespesa: string;
  @IsDinheiro()
  valor: string;
  @IsOptional() @IsUUID()
  demandaId?: string;
}
