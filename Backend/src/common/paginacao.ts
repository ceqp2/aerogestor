import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginacaoQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pagina?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  tamanho?: number = 25;

  @IsOptional() @IsString() @MaxLength(200)
  busca?: string;
}

export function paginar(q: PaginacaoQuery) {
  const pagina = q.pagina ?? 1;
  const tamanho = q.tamanho ?? 25;
  return { skip: (pagina - 1) * tamanho, take: tamanho, pagina, tamanho };
}

export function resultado<T>(itens: T[], total: number, pagina: number, tamanho: number) {
  return { itens, total, pagina, tamanho, paginas: Math.max(1, Math.ceil(total / tamanho)) };
}
