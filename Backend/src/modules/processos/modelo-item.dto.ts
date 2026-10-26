import { EtapaProcesso } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModeloItemDto {
  @IsString() @IsNotEmpty() @MaxLength(300)
  titulo: string;
  @IsOptional() @IsString() @MaxLength(1000)
  descricao?: string;
  @IsEnum(EtapaProcesso)
  etapa: EtapaProcesso;
  @IsBoolean()
  critico: boolean;
  @IsBoolean()
  exigeEvidencia: boolean;
  @IsOptional() @IsBoolean()
  exigeRevisaoNA?: boolean;
  @IsOptional() @IsString() @MaxLength(300)
  referenciaNormativa?: string;
  @IsOptional() @IsString() @MaxLength(500)
  aplicabilidade?: string;
}
