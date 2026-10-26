import { Prisma, TipoMovQtdAta, TipoVinculoAta } from '@prisma/client';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

export interface MovQtd {
  tipo: TipoMovQtdAta;
  quantidade: Prisma.Decimal.Value;
}

/**
 * Saldo quantitativo INTERNO da unidade (não é saldo nacional oficial):
 *   saldo = quantidade destinada − consumo formalizado líquido − reservas ativas.
 */
export function saldoItemAta(destinada: Prisma.Decimal.Value, movs: MovQtd[]) {
  let consumo = D(0);
  let reservas = D(0);
  for (const m of movs) {
    const q = D(m.quantidade);
    if (m.tipo === 'CONSUMO') consumo = consumo.plus(q);
    if (m.tipo === 'CANCELAMENTO_CONSUMO') consumo = consumo.minus(q);
    if (m.tipo === 'RESERVA') reservas = reservas.plus(q);
    if (m.tipo === 'LIBERACAO_RESERVA') reservas = reservas.minus(q);
  }
  return { destinada: D(destinada), consumo, reservas, saldo: D(destinada).minus(consumo).minus(reservas) };
}

/**
 * Ata importada não autoriza utilização. Uso no fluxo normal exige vínculo autorizado,
 * vigência em curso e ata não cancelada. Não há "botão de ignorar bloqueio".
 */
export function impedimentosUtilizacao(
  ata: { cancelada: boolean; vigenciaInicio: Date; vigenciaFim: Date; tipoVinculo: TipoVinculoAta; autorizacaoUtilizacao: string | null },
  hoje: Date,
): string[] {
  const r: string[] = [];
  if (ata.cancelada) r.push('Ata cancelada');
  if (hoje > ata.vigenciaFim) r.push('Vigência da ata expirada');
  if (hoje < ata.vigenciaInicio) r.push('Vigência da ata ainda não iniciada');
  if (ata.tipoVinculo === 'CONSULTA') r.push('Ata apenas cadastrada para consulta: participação/adesão não registrada');
  if (!ata.autorizacaoUtilizacao) r.push('Sem documento de autorização de utilização registrado');
  return r;
}
