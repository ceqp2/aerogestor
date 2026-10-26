import { IsEmail, IsNotEmpty, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(200)
  email: string;

  @IsString() @IsNotEmpty() @MaxLength(128)
  senha: string;
}

export class CodigoMfaDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'Código deve ter 6 dígitos' })
  codigo: string;
}

export class SelecionarUnidadeDto {
  @IsUUID()
  unidadeId: string;
}

export class AceitarConviteDto {
  @IsString() @Length(20, 200)
  token: string;

  @IsString() @MaxLength(128)
  senha: string;
}

export class TrocarSenhaDto {
  @IsString() @MaxLength(128)
  senhaAtual: string;

  @IsString() @MaxLength(128)
  novaSenha: string;
}
