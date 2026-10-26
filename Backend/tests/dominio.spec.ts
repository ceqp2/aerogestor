import { saldoItemAta, impedimentosUtilizacao } from '../src/modules/atas/atas.regras';
import { cnpjValido, cpfValido } from '../src/modules/contratos/documento-fiscal';
import { detectarTipo, nomeSeguro } from '../src/modules/documentos/tipo-arquivo';
import {
  creditoAtualizado, demandaAEmpenhar, disponivelParaEmpenhar, saldosEmpenho, saldosRap, sugestaoInscricaoRap, validarMovimentoEmpenho, validarMovimentoRap,
} from '../src/modules/financeiro/financeiro.regras';
import { bloqueiosParaAvancar, cumprimento, validarClassificacao } from '../src/modules/processos/processos.regras';
import { nivel, score } from '../src/modules/riscos/riscos.regras';
import { podeGerir } from '../src/modules/usuarios/usuarios.service';
import { paraCsv } from '../src/modules/relatorios/relatorios.module';
import { marcoAtual } from '../src/jobs/jobs.module';
import { dataCivil, diffDias, hojeCivil, isoData } from '../src/common/datas';

describe('Financeiro — exemplo obrigatório da especificação', () => {
  // crédito 100.000; empenho 40.000; reforço 10.000; anulação 5.000; liquidação 20.000; pagamento 15.000
  const movs = [
    { id: 'e', tipo: 'EMISSAO' as const, valor: '40000' },
    { id: 'r', tipo: 'REFORCO' as const, valor: '10000' },
    { id: 'a', tipo: 'ANULACAO' as const, valor: '5000' },
    { id: 'l', tipo: 'LIQUIDACAO' as const, valor: '20000' },
    { id: 'p', tipo: 'PAGAMENTO' as const, valor: '15000' },
  ];
  const s = saldosEmpenho(movs);

  it('empenhado líquido = 45.000', () => expect(s.empenhadoLiquido.toFixed(2)).toBe('45000.00'));
  it('disponível = 55.000', () => expect(disponivelParaEmpenhar([{ tipo: 'INICIAL', valor: '100000' }], s.empenhadoLiquido).toFixed(2)).toBe('55000.00'));
  it('a liquidar = 25.000', () => expect(s.aLiquidar.toFixed(2)).toBe('25000.00'));
  it('liquidado a pagar = 5.000', () => expect(s.liquidadoAPagar.toFixed(2)).toBe('5000.00'));
  it('sem inscrição não há RAP (sugestão é só sugestão)', () => {
    const r = sugestaoInscricaoRap(movs);
    expect(r.processado.toFixed(2)).toBe('5000.00');
    expect(r.naoProcessado.toFixed(2)).toBe('25000.00');
  });
  it('sem ponto flutuante: 0,1 + 0,2 = 0,30 exato', () => {
    expect(saldosEmpenho([{ tipo: 'EMISSAO', valor: '0.1' }, { tipo: 'REFORCO', valor: '0.2' }]).empenhadoLiquido.toFixed(2)).toBe('0.30');
  });

  it('impede pagamento acima do liquidado a pagar', () => {
    expect(validarMovimentoEmpenho(movs, { tipo: 'PAGAMENTO', valor: '5000.01' })).not.toHaveLength(0);
    expect(validarMovimentoEmpenho(movs, { tipo: 'PAGAMENTO', valor: '5000' })).toHaveLength(0);
  });
  it('impede liquidação acima do empenhado a liquidar', () => {
    expect(validarMovimentoEmpenho(movs, { tipo: 'LIQUIDACAO', valor: '25000.01' })).not.toHaveLength(0);
  });
  it('impede anulação de valor já liquidado', () => {
    expect(validarMovimentoEmpenho(movs, { tipo: 'ANULACAO', valor: '25001' })).not.toHaveLength(0);
  });
  it('estorno exige movimento original correspondente e não pode repetir', () => {
    expect(validarMovimentoEmpenho(movs, { tipo: 'ESTORNO_PAGAMENTO', valor: '100', estornoDeId: 'l' })).not.toHaveLength(0);
    expect(validarMovimentoEmpenho(movs, { tipo: 'ESTORNO_PAGAMENTO', valor: '100', estornoDeId: 'p' })).toHaveLength(0);
    const comEstorno = [...movs, { id: 'x', tipo: 'ESTORNO_PAGAMENTO' as const, valor: '100', estornoDeId: 'p' }];
    expect(validarMovimentoEmpenho(comEstorno, { tipo: 'ESTORNO_PAGAMENTO', valor: '100', estornoDeId: 'p' })).not.toHaveLength(0);
  });
  it('não estorna liquidação já paga', () => {
    expect(validarMovimentoEmpenho(movs, { tipo: 'ESTORNO_LIQUIDACAO', valor: '20000', estornoDeId: 'l' })).not.toHaveLength(0);
    expect(validarMovimentoEmpenho(movs, { tipo: 'ESTORNO_LIQUIDACAO', valor: '5000', estornoDeId: 'l' })).toHaveLength(0);
  });
  it('crédito atualizado = inicial + acréscimos − reduções', () => {
    expect(creditoAtualizado([{ tipo: 'INICIAL', valor: '100' }, { tipo: 'ACRESCIMO', valor: '50' }, { tipo: 'REDUCAO', valor: '30' }]).toFixed(2)).toBe('120.00');
  });
  it('demanda a empenhar nunca é negativa', () => {
    expect(demandaAEmpenhar('100', '150').toFixed(2)).toBe('0.00');
    expect(demandaAEmpenhar('100', '40').toFixed(2)).toBe('60.00');
  });
});

describe('Restos a pagar', () => {
  it('RPNP liquidado posteriormente mantém classificação e saldos coerentes', () => {
    const movs = [
      { id: 'l1', tipo: 'LIQUIDACAO' as const, valor: '10000' },
      { id: 'p1', tipo: 'PAGAMENTO' as const, valor: '4000' },
    ];
    const s = saldosRap('NAO_PROCESSADO', '25000', movs);
    expect(s.aLiquidar.toFixed(2)).toBe('15000.00');
    expect(s.liquidadoAPagar.toFixed(2)).toBe('6000.00');
    expect(s.saldo.toFixed(2)).toBe('21000.00');
    expect(validarMovimentoRap('NAO_PROCESSADO', '25000', movs, { tipo: 'PAGAMENTO', valor: '6000.01' })).not.toHaveLength(0);
    expect(validarMovimentoRap('NAO_PROCESSADO', '25000', movs, { tipo: 'CANCELAMENTO', valor: '15000' })).toHaveLength(0);
  });
  it('RAP processado não admite nova liquidação', () => {
    expect(validarMovimentoRap('PROCESSADO', '5000', [], { tipo: 'LIQUIDACAO', valor: '1' })).not.toHaveLength(0);
  });
});

describe('Processos e checklist', () => {
  it('dispensa/inexigibilidade e adesão não são modalidades', () => {
    expect(validarClassificacao({ formaContratacao: 'CONTRATACAO_DIRETA', modalidade: 'PREGAO', hipoteseDireta: 'DISPENSA' })).not.toHaveLength(0);
    expect(validarClassificacao({ formaContratacao: 'CONTRATACAO_DIRETA', hipoteseDireta: 'DISPENSA' })).toHaveLength(0);
    expect(validarClassificacao({ formaContratacao: 'ADESAO_ATA', modalidade: 'PREGAO' })).not.toHaveLength(0);
    expect(validarClassificacao({ formaContratacao: 'LICITACAO' })).not.toHaveLength(0);
  });
  const item = (estado: string, critico = true, etapa = 'PLANEJAMENTO', revisado = false) =>
    ({ estado, critico, etapa, exigeRevisaoNA: true, naRevisadoEm: revisado ? new Date() : null, titulo: estado }) as never;
  it('não aplicável fica fora do denominador', () => {
    const c = cumprimento([item('CONCLUIDO'), item('NAO_APLICAVEL'), item('PENDENTE')]);
    expect(c.aplicaveis).toBe(2);
    expect(c.percentual).toBe(50);
  });
  it('item crítico pendente bloqueia a etapa; N/A sem revisão também', () => {
    expect(bloqueiosParaAvancar([item('PENDENTE')], 'PLANEJAMENTO')).toHaveLength(1);
    expect(bloqueiosParaAvancar([item('NAO_APLICAVEL')], 'PLANEJAMENTO')).toHaveLength(1);
    expect(bloqueiosParaAvancar([item('NAO_APLICAVEL', true, 'PLANEJAMENTO', true)], 'PLANEJAMENTO')).toHaveLength(0);
    expect(bloqueiosParaAvancar([item('PENDENTE', false)], 'PLANEJAMENTO')).toHaveLength(0);
    expect(bloqueiosParaAvancar([item('PENDENTE', true, 'FORMALIZACAO')], 'PLANEJAMENTO')).toHaveLength(0);
  });
});

describe('Atas', () => {
  it('saldo interno = destinada − consumo − reservas ativas', () => {
    const s = saldoItemAta('200', [
      { tipo: 'CONSUMO', quantidade: '40' },
      { tipo: 'RESERVA', quantidade: '30' },
      { tipo: 'LIBERACAO_RESERVA', quantidade: '10' },
      { tipo: 'CANCELAMENTO_CONSUMO', quantidade: '5' },
    ]);
    expect(s.saldo.toString()).toBe('145');
  });
  it('ata expirada ou só importada não admite utilização', () => {
    const base = { cancelada: false, vigenciaInicio: dataCivil('2026-01-01'), vigenciaFim: dataCivil('2026-06-30'), tipoVinculo: 'PARTICIPANTE' as const, autorizacaoUtilizacao: 'Termo 1' };
    expect(impedimentosUtilizacao(base, dataCivil('2026-07-01'))).toContain('Vigência da ata expirada');
    expect(impedimentosUtilizacao(base, dataCivil('2026-06-30'))).toHaveLength(0);
    expect(impedimentosUtilizacao({ ...base, tipoVinculo: 'CONSULTA', autorizacaoUtilizacao: null }, dataCivil('2026-03-01')).length).toBeGreaterThan(0);
  });
});

describe('Permissões de gestão de contas', () => {
  it('auxiliar só cria gestor; chefe cria auxiliar e gestor; só admin cria comandante/chefe/admin', () => {
    expect(podeGerir('AUXILIAR', 'GESTOR')).toBe(true);
    expect(podeGerir('AUXILIAR', 'AUXILIAR')).toBe(false);
    expect(podeGerir('AUXILIAR', 'CHEFE')).toBe(false);
    expect(podeGerir('CHEFE', 'AUXILIAR')).toBe(true);
    expect(podeGerir('CHEFE', 'CHEFE')).toBe(false);
    expect(podeGerir('CHEFE', 'ADMIN')).toBe(false);
    expect(podeGerir('ADMIN', 'COMANDANTE')).toBe(true);
    expect(podeGerir('COMANDANTE', 'GESTOR')).toBe(false);
    expect(podeGerir('GESTOR', 'GESTOR')).toBe(false);
  });
});

describe('Riscos', () => {
  it('score e faixas propostas', () => {
    expect(score(4, 5)).toBe(20);
    expect(nivel(4)).toBe('baixo');
    expect(nivel(9)).toBe('moderado');
    expect(nivel(16)).toBe('alto');
    expect(nivel(17)).toBe('critico');
    expect(() => score(6, 1)).toThrow();
  });
});

describe('Datas civis e fuso', () => {
  it('data civil não desloca com fuso', () => {
    expect(isoData(dataCivil('2026-12-31'))).toBe('2026-12-31');
    expect(() => dataCivil('2026-02-30')).toThrow();
  });
  it('hoje em America/Sao_Paulo às 23h30 (02h30 UTC do dia seguinte) é o dia local', () => {
    expect(isoData(hojeCivil('America/Sao_Paulo', new Date('2026-10-10T02:30:00Z')))).toBe('2026-10-09');
  });
  it('diferença de dias', () => expect(diffDias(dataCivil('2026-10-31'), dataCivil('2026-10-01'))).toBe(30));
});

describe('Lembretes (idempotência por marco)', () => {
  const marcos = [90, 60, 30, 15, 7, 0];
  it('escolhe o menor marco >= dias restantes (recupera marcos perdidos)', () => {
    expect(marcoAtual(58, marcos)).toBe(60);
    expect(marcoAtual(30, marcos)).toBe(30);
    expect(marcoAtual(0, marcos)).toBe(0);
    expect(marcoAtual(-3, marcos)).toBe(-1);
    expect(marcoAtual(120, marcos)).toBeNull();
  });
});

describe('Validações de entrada', () => {
  it('CPF/CNPJ', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
    expect(cnpjValido('11222333000180')).toBe(false);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('11111111111')).toBe(false);
  });
  it('tipo real do arquivo por assinatura + extensão coerente', () => {
    expect(detectarTipo(Buffer.from('%PDF-1.7 ...'), 'a.pdf')?.mime).toBe('application/pdf');
    expect(detectarTipo(Buffer.from('%PDF-1.7 ...'), 'a.exe')).toBeNull();
    expect(detectarTipo(Buffer.from('MZ\x90\x00'), 'falso.pdf')).toBeNull();
    expect(detectarTipo(Buffer.from('<script>'), 'x.html')).toBeNull();
    expect(detectarTipo(Buffer.from('a;b\n1;2'), 'x.csv')?.mime).toBe('text/csv');
  });
  it('nome de arquivo seguro', () => {
    expect(nomeSeguro('../../etc/passwd')).toBe('passwd');
    expect(nomeSeguro('a"b<c>.pdf')).toBe('a_b_c_.pdf');
  });
  it('CSV neutraliza injeção de fórmula', () => {
    const csv = paraCsv([{ a: '=HYPERLINK("x")', b: 'ok;1' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"ok;1"');
  });
});
