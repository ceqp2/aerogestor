import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

/** Valor monetário como string decimal ("1234.56"). Nunca number (evita ponto flutuante). */
export const IsDinheiro = () =>
  applyDecorators(
    ApiProperty({ type: String, example: '1500.00' }),
    IsString(),
    Matches(/^\d{1,16}(\.\d{1,2})?$/, { message: '$property deve ser valor decimal positivo com até 2 casas (ex.: 1500.00)' }),
  );

export const IsQuantidade = () =>
  applyDecorators(
    ApiProperty({ type: String, example: '10' }),
    IsString(),
    Matches(/^\d{1,14}(\.\d{1,4})?$/, { message: '$property deve ser quantidade decimal com até 4 casas' }),
  );

/** Data civil AAAA-MM-DD (sem hora/fuso). */
export const IsDataCivil = () =>
  applyDecorators(
    ApiProperty({ type: String, example: '2026-12-31' }),
    IsString(),
    MaxLength(10),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property deve estar no formato AAAA-MM-DD' }),
  );
