import { Perfil } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CriarUsuarioDto {
  @IsString() @IsNotEmpty() @MaxLength(150)
  nome: string;

  @IsOptional() @IsString() @MaxLength(60)
  nomeGuerra?: string;

  @IsEmail() @MaxLength(200)
  email: string;

  @IsOptional() @IsString() @MaxLength(60)
  postoGraduacao?: string;

  @IsEnum(Perfil)
  perfil: Perfil;

  @IsOptional() @IsString() @MinLength(12) @MaxLength(128)
  senha?: string;
}

export class EditarUsuarioDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(150)
  nome?: string;

  @IsOptional() @IsString() @MaxLength(60)
  nomeGuerra?: string;

  @IsOptional() @IsEmail() @MaxLength(200)
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  postoGraduacao?: string;

  @IsOptional() @IsString() @MinLength(12) @MaxLength(128)
  senha?: string;
}

export class MotivoDto {
  @IsString() @MinLength(5) @MaxLength(1000)
  motivo: string;
}

export class AlterarPerfilDto extends MotivoDto {
  @IsEnum(Perfil)
  perfil: Perfil;
}

export class ConcessaoSuporteDto extends MotivoDto {
  @IsUUID()
  usuarioId: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(168)
  horas: number;
}
