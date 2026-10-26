/**
 * Seed do AEROGEST GSD.
 *  - Sempre: unidade inicial, parâmetros propostos (pendentes de validação) e modelos de checklist.
 *  - Somente fora de produção e com SEED_DEMO != "false": dados DEMONSTRATIVOS FICTÍCIOS, identificados com [DEMO],
 *    e-mails no domínio reservado .invalid e senhas aleatórias gravadas em .local/credenciais-demo.txt (não versionado).
 */
import 'dotenv/config';
import { EtapaProcesso, FormaContratacao, Prisma, PrismaClient } from '@prisma/client';
import { hash, Algorithm } from '@node-rs/argon2';
import { randomInt } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const D = (v: string) => new Prisma.Decimal(v);
const dia = (s: string) => new Date(`${s}T00:00:00.000Z`);
const hoje = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
const mais = (n: number) => new Date(hoje.getTime() + n * 86400000);

function cnpjFicticio(base: string) {
  const n = base.padStart(12, '0').slice(0, 12).split('').map(Number);
  const dv = (arr: number[], pesos: number[]) => {
    const r = arr.reduce((a, x, i) => a + x * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv([...n, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...n, d1, d2].join('');
}

function senhaAleatoria() {
  const alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 14; i++) s += alfa[randomInt(alfa.length)];
  return `${s}#${randomInt(10, 99)}`;
}

type ItemModelo = [string, EtapaProcesso, boolean, boolean, string?];

const MODELOS: Array<{ nome: string; forma: FormaContratacao; itens: ItemModelo[] }> = [
  {
    nome: 'Licitação — padrão',
    forma: 'LICITACAO',
    itens: [
      ['Documento de Formalização da Demanda (DFD)', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 18, I'],
      ['Estudo Técnico Preliminar (ETP), quando aplicável', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 18, I e §1º'],
      ['Análise de riscos', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 18, X'],
      ['Termo de Referência / Projeto Básico', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 18, II; art. 6º, XXIII'],
      ['Pesquisa de preços', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 23; IN SEGES/ME 65/2021'],
      ['Demonstração de disponibilidade orçamentária', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 18, caput'],
      ['Minuta de edital e de contrato', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 18, V e VI'],
      ['Análise jurídica, quando exigível', 'ANALISE', true, true, 'Lei 14.133/2021, art. 53'],
      ['Autorização da autoridade competente', 'ANALISE', true, true, 'Lei 14.133/2021, arts. 7º–8º'],
      ['Divulgação do edital (PNCP)', 'SELECAO_FORNECEDOR', true, false, 'Lei 14.133/2021, art. 54'],
      ['Resultado, adjudicação e homologação', 'SELECAO_FORNECEDOR', true, true, 'Lei 14.133/2021, art. 71'],
      ['Formalização do instrumento contratual', 'FORMALIZACAO', true, true, 'Lei 14.133/2021, arts. 92 e 95'],
      ['Designação de gestor e fiscais', 'FORMALIZACAO', true, true, 'Lei 14.133/2021, art. 117; Decreto 11.246/2022'],
      ['Divulgação do contrato no PNCP', 'FORMALIZACAO', false, false, 'Lei 14.133/2021, art. 94'],
    ],
  },
  {
    nome: 'Contratação direta — padrão',
    forma: 'CONTRATACAO_DIRETA',
    itens: [
      ['Documento de Formalização da Demanda (DFD)', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 72, I'],
      ['Estudo Técnico Preliminar / análise de riscos, se for o caso', 'PLANEJAMENTO', false, true, 'Lei 14.133/2021, art. 72, I'],
      ['Termo de Referência / Projeto Básico', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, I'],
      ['Estimativa de despesa (pesquisa de preços)', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, II; IN 65/2021'],
      ['Parecer jurídico/técnico, se for o caso', 'ANALISE', true, true, 'Lei 14.133/2021, art. 72, III'],
      ['Demonstração de compatibilidade orçamentária', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, IV'],
      ['Comprovação de habilitação e qualificação do contratado', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, V'],
      ['Razão da escolha do contratado', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, VI'],
      ['Justificativa de preço', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 72, VII'],
      ['Enquadramento na hipótese legal (art. 74 ou 75) — validar redação vigente', 'ANALISE', true, true, 'Lei 14.133/2021, arts. 74–75'],
      ['Autorização da autoridade competente', 'ANALISE', true, true, 'Lei 14.133/2021, art. 72, VIII'],
      ['Divulgação do ato que autoriza a contratação direta', 'FORMALIZACAO', true, false, 'Lei 14.133/2021, art. 72, parágrafo único'],
      ['Formalização do instrumento (contrato ou substitutivo admitido)', 'FORMALIZACAO', true, true, 'Lei 14.133/2021, art. 95'],
    ],
  },
  {
    nome: 'Adesão a ata — dossiê',
    forma: 'ADESAO_ATA',
    itens: [
      ['Documento de Formalização da Demanda (DFD)', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 18'],
      ['Justificativa da vantagem da adesão', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 86, §2º, I'],
      ['Demonstração de compatibilidade dos valores com o mercado', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 86, §2º, II'],
      ['Consulta e aceite do órgão gerenciador', 'INSTRUCAO', true, true, 'Lei 14.133/2021, art. 86, §2º, III; Decreto 11.462/2023'],
      ['Aceite do fornecedor beneficiário', 'INSTRUCAO', true, true, 'Decreto 11.462/2023'],
      ['Verificação de limites de adesão (regra normativa versionada)', 'ANALISE', true, true, 'Lei 14.133/2021, art. 86, §§4º–5º — validar redação vigente'],
      ['Verificação da vigência da ata', 'ANALISE', true, false, 'Lei 14.133/2021, art. 84'],
      ['Disponibilidade orçamentária', 'ANALISE', true, true, 'Lei 14.133/2021, art. 18'],
      ['Autorização da autoridade competente', 'ANALISE', true, true, 'Lei 14.133/2021, arts. 7º–8º'],
      ['Formalização da contratação', 'FORMALIZACAO', true, true, 'Lei 14.133/2021, art. 95'],
    ],
  },
  {
    nome: 'Utilização de ata como participante',
    forma: 'UTILIZACAO_ATA_PARTICIPANTE',
    itens: [
      ['Documento de Formalização da Demanda (DFD)', 'PLANEJAMENTO', true, true, 'Lei 14.133/2021, art. 18'],
      ['Confirmação da participação e quantitativo destinado', 'INSTRUCAO', true, true, 'Decreto 11.462/2023'],
      ['Verificação da vigência e do saldo interno', 'ANALISE', true, false, 'Lei 14.133/2021, art. 84'],
      ['Disponibilidade orçamentária', 'ANALISE', true, true, 'Lei 14.133/2021, art. 18'],
      ['Autorização da autoridade competente', 'ANALISE', true, true, 'Lei 14.133/2021, arts. 7º–8º'],
      ['Formalização da contratação', 'FORMALIZACAO', true, true, 'Lei 14.133/2021, art. 95'],
    ],
  },
];

async function base() {
  const unidade = await prisma.unidade.upsert({
    where: { sigla: 'GSD-SJ' },
    create: { sigla: 'GSD-SJ', nome: 'Grupo de Segurança e Defesa de São José dos Campos', nomeSecao: 'Secretaria de Aquisições', cidade: 'São José dos Campos' },
    update: {},
  });

  const params: Array<[string, string, unknown, string]> = [
    ['lembretes.vigencia.dias', 'Marcos de lembrete de vigência (dias antes)', [90, 60, 30, 15, 7, 0], 'Proposta gerencial — especificação AEROGEST, seção 9'],
    ['riscos.faixas', 'Faixas de nível de risco (score = P × I)', { baixo: [1, 4], moderado: [5, 9], alto: [10, 16], critico: [17, 25] }, 'Proposta gerencial — especificação AEROGEST, seção 8 (não imposta pela lei)'],
    ['competencia.atesto', 'Funções de designação competentes para atesto de nota fiscal', ['GESTOR', 'GESTOR_SUBSTITUTO', 'FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'FISCAL_REQUISITANTE'], 'Lei 14.133/2021, art. 117; Decreto 11.246/2022 — PENDENTE de validação institucional'],
    ['competencia.recebimento.provisorio', 'Funções competentes para recebimento provisório', ['FISCAL_TECNICO', 'FISCAL_ADMINISTRATIVO', 'FISCAL_REQUISITANTE', 'FISCAL_SUBSTITUTO'], 'Lei 14.133/2021, art. 140 — PENDENTE de validação institucional'],
    ['competencia.recebimento.definitivo', 'Funções competentes para recebimento definitivo', ['GESTOR', 'GESTOR_SUBSTITUTO'], 'Lei 14.133/2021, art. 140 — PENDENTE de validação institucional'],
    ['alertas.servico.diasSemRelatorio', 'Dias sem relatório/medição para alertar contrato de serviço', 30, 'Proposta gerencial'],
  ];
  for (const [chave, descricao, valor, fonte] of params) {
    const existe = await prisma.parametroNormativo.findFirst({ where: { chave, unidadeId: null } });
    if (!existe) {
      await prisma.parametroNormativo.create({
        data: { chave, descricao, valor: valor as Prisma.InputJsonValue, fonte, vigenciaInicio: dia('2026-01-01'), pendenteValidacao: true },
      });
    }
  }

  for (const m of MODELOS) {
    const existe = await prisma.modeloChecklist.findFirst({ where: { nome: m.nome, unidadeId: null } });
    if (existe) continue;
    await prisma.modeloChecklist.create({
      data: {
        nome: m.nome, formaContratacao: m.forma, versao: 1, fonte: 'Modelo inicial proposto — validar com normas FAB/COMAER e modelos locais',
        itens: {
          create: m.itens.map(([titulo, etapa, critico, exigeEvidencia, ref], i) => ({
            ordem: i + 1, titulo, etapa, critico, exigeEvidencia, referenciaNormativa: ref, exigeRevisaoNA: true,
          })),
        },
      },
    });
  }
  return unidade;
}

async function demo(unidadeId: string) {
  if (await prisma.usuario.findFirst({ where: { email: { endsWith: '@demo.aerogest.invalid' } } })) {
    console.log('Dados demonstrativos já existem — nada a fazer.');
    return;
  }
  const opc = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
  const pessoas = [
    { chave: 'admin', nome: '[DEMO] Administrador do Sistema', perfil: 'ADMIN', posto: 'Cap' },
    { chave: 'comandante', nome: '[DEMO] Comandante', perfil: 'COMANDANTE', posto: 'Cel' },
    { chave: 'chefe', nome: '[DEMO] Chefe da Secretaria', perfil: 'CHEFE', posto: 'Maj' },
    { chave: 'auxiliar', nome: '[DEMO] Auxiliar da Secretaria', perfil: 'AUXILIAR', posto: '2S' },
    { chave: 'gestora', nome: '[DEMO] Gestor A', perfil: 'GESTOR', posto: '1T' },
    { chave: 'gestorb', nome: '[DEMO] Gestor B', perfil: 'GESTOR', posto: '1S' },
  ] as const;
  const creds: string[] = [];
  const ids: Record<string, string> = {};
  for (const p of pessoas) {
    const senha = senhaAleatoria();
    const email = `${p.chave}@demo.aerogest.invalid`;
    const u = await prisma.usuario.create({ data: { nome: p.nome, email, postoGraduacao: p.posto, senhaHash: await hash(senha, opc) } });
    await prisma.vinculoUnidadePerfil.create({ data: { usuarioId: u.id, unidadeId, perfil: p.perfil } });
    ids[p.chave] = u.id;
    creds.push(`${p.perfil.padEnd(11)} ${email.padEnd(34)} ${senha}`);
  }
  const autor = ids.chefe;

  const forn = await Promise.all(
    ['Alfa Suprimentos', 'Beta Serviços de Manutenção', 'Gama Tecnologia'].map((n, i) =>
      prisma.fornecedor.create({ data: { unidadeId, documento: cnpjFicticio(`9900000${i + 1}0001`), razaoSocial: `[DEMO] ${n} Ltda`, email: `contato${i}@empresa.demo.invalid` } }),
    ),
  );

  const ano = hoje.getUTCFullYear();
  const modelos = await prisma.modeloChecklist.findMany({ include: { itens: true } });
  const criarProcesso = async (n: number, objeto: string, forma: FormaContratacao, etapa: EtapaProcesso, extra: Partial<Prisma.ProcessoUncheckedCreateInput> = {}) => {
    const p = await prisma.processo.create({
      data: {
        unidadeId, numeroInterno: `PROC-${ano}-${String(n).padStart(4, '0')}`, nup: `67000.0${n}0000/${ano}-0${n}`, exercicio: ano, objeto: `[DEMO] ${objeto}`,
        tipoObjeto: forma === 'LICITACAO' ? 'SERVICO_CONTINUO' : 'MATERIAL', formaContratacao: forma, etapa, responsavelId: ids.auxiliar, criadoPor: autor,
        valorEstimado: D(String(50000 * n)), dataInicioPrevista: mais(-60), dataConclusaoPrevista: mais(n === 2 ? -5 : 45), setorRequisitante: 'Seção de Logística (fictícia)',
        ...extra,
      },
    });
    const modelo = modelos.find((m) => m.formaContratacao === forma);
    if (modelo) {
      const ordem = ['A_INICIAR', 'PLANEJAMENTO', 'INSTRUCAO', 'ANALISE', 'SELECAO_FORNECEDOR', 'FORMALIZACAO', 'FINALIZADO'];
      await prisma.checklistItem.createMany({
        data: modelo.itens.map((i) => ({
          processoId: p.id, modeloItemId: i.id, ordem: i.ordem, titulo: i.titulo, etapa: i.etapa, critico: i.critico, exigeEvidencia: false,
          exigeRevisaoNA: i.exigeRevisaoNA, referenciaNormativa: i.referenciaNormativa, responsavelId: ids.auxiliar,
          estado: ordem.indexOf(i.etapa) < ordem.indexOf(etapa) ? 'CONCLUIDO' : 'PENDENTE',
          concluidoEm: ordem.indexOf(i.etapa) < ordem.indexOf(etapa) ? new Date() : null,
          prazo: ordem.indexOf(i.etapa) === ordem.indexOf(etapa) ? mais(n === 2 ? -3 : 10) : null,
        })),
      });
      await prisma.processo.update({ where: { id: p.id }, data: { modeloChecklistId: modelo.id } });
    }
    return p;
  };
  const p1 = await criarProcesso(1, 'Serviço de manutenção predial', 'LICITACAO', 'FINALIZADO', { modalidade: 'PREGAO', tipoObjeto: 'SERVICO_CONTINUO' });
  await criarProcesso(2, 'Aquisição de material de expediente', 'LICITACAO', 'INSTRUCAO', { modalidade: 'PREGAO' });
  await criarProcesso(3, 'Aquisição emergencial de peças', 'CONTRATACAO_DIRETA', 'ANALISE', { hipoteseDireta: 'DISPENSA', fundamentoLegal: 'Hipótese a validar — Lei 14.133/2021, art. 75' });
  await criarProcesso(4, 'Uniformes e equipamentos de proteção', 'LICITACAO', 'A_INICIAR', { modalidade: 'PREGAO' });

  const ata = await prisma.ata.create({
    data: {
      unidadeId, numero: `[DEMO] 012/${ano}`, ano, orgaoGerenciador: '[DEMO] Órgão Gerenciador Fictício', objeto: '[DEMO] Registro de preços de material de expediente',
      vigenciaInicio: mais(-200), vigenciaFim: mais(40), tipoVinculo: 'PARTICIPANTE', autorizacaoUtilizacao: '[DEMO] Termo de participação nº 1', autorizadaEm: new Date(), autorizadaPor: autor, criadoPor: autor,
    },
  });
  const itemAta = await prisma.itemAta.create({
    data: { ataId: ata.id, numeroItem: 1, descricao: 'Papel A4 75 g/m² (caixa com 10 resmas)', fornecedorId: forn[0].id, unidadeMedida: 'CX', quantidadeRegistrada: null, quantidadeDestinada: D('200'), precoUnitario: D('245.90') },
  });
  await prisma.movimentoQuantidadeAta.create({ data: { itemAtaId: itemAta.id, tipo: 'CONSUMO', quantidade: D('40'), documento: '[DEMO] Pedido 1', autorId: autor } });
  await prisma.movimentoQuantidadeAta.create({ data: { itemAtaId: itemAta.id, tipo: 'RESERVA', quantidade: D('30'), documento: '[DEMO] Reserva DFD 7', autorId: autor } });

  const cA = await prisma.contratoInstrumento.create({
    data: {
      unidadeId, numero: `[DEMO] 05/${ano}`, tipo: 'CONTRATO', natureza: 'SERVICO', processoId: p1.id, fornecedorId: forn[1].id, objeto: '[DEMO] Manutenção predial preventiva e corretiva',
      valorInicial: D('180000.00'), valorAtualizado: D('180000.00'), vigenciaInicio: mais(-300), vigenciaFim: mais(28), dataAssinatura: mais(-305), criadoPor: autor,
    },
  });
  const cB = await prisma.contratoInstrumento.create({
    data: {
      unidadeId, numero: `[DEMO] 09/${ano}`, tipo: 'CONTRATO', natureza: 'MATERIAL', ataId: ata.id, fornecedorId: forn[0].id, objeto: '[DEMO] Fornecimento parcelado de material de expediente',
      valorInicial: D('9836.00'), valorAtualizado: D('9836.00'), vigenciaInicio: mais(-90), vigenciaFim: mais(150), criadoPor: autor,
    },
  });
  const cC = await prisma.contratoInstrumento.create({
    data: {
      unidadeId, numero: `[DEMO] 11/${ano}`, tipo: 'CONTRATO', natureza: 'SERVICO', fornecedorId: forn[2].id, objeto: '[DEMO] Suporte técnico de TI (sem gestor designado)',
      valorInicial: D('60000.00'), valorAtualizado: D('60000.00'), vigenciaInicio: mais(-30), vigenciaFim: mais(335), criadoPor: autor,
    },
  });
  const desig = (contratoId: string, usuarioId: string, funcao: 'GESTOR' | 'FISCAL_TECNICO', status: 'ATIVA' | 'PENDENTE') =>
    prisma.designacao.create({
      data: {
        unidadeId, contratoId, usuarioId, funcao, status, inicio: mais(-60), indicadoPor: autor,
        documentoDesignacao: status === 'ATIVA' ? '[DEMO] Portaria nº 123/GSD-SJ' : null, dataDocumento: status === 'ATIVA' ? mais(-61) : null,
        confirmadoPor: status === 'ATIVA' ? autor : null, confirmadoEm: status === 'ATIVA' ? new Date() : null,
      },
    });
  await desig(cA.id, ids.gestora, 'GESTOR', 'ATIVA');
  await desig(cA.id, ids.gestora, 'FISCAL_TECNICO', 'ATIVA');
  await desig(cB.id, ids.gestorb, 'GESTOR', 'ATIVA');
  await desig(cC.id, ids.gestorb, 'GESTOR', 'PENDENTE');

  // Financeiro — exemplo da especificação: crédito 100.000; empenho 40.000; reforço 10.000; anulação 5.000; liquidação 20.000; pagamento 15.000.
  const cred = await prisma.credito.create({
    data: { unidadeId, exercicio: ano, ptres: '000000', fonte: '1000000000', naturezaDespesa: '339039', planoInterno: 'DEMO0001', descricao: '[DEMO] Serviços de terceiros PJ' },
  });
  await prisma.movimentoCredito.create({ data: { creditoId: cred.id, tipo: 'INICIAL', valor: D('100000.00'), dataMovimento: dia(`${ano}-01-15`), documento: '[DEMO] NC 0001', autorId: autor } });
  const emp = await prisma.empenho.create({
    data: { unidadeId, numero: `${ano}NE000101`, exercicio: ano, creditoId: cred.id, fornecedorId: forn[1].id, processoId: p1.id, dataEmissao: dia(`${ano}-02-01`), descricao: '[DEMO] Empenho do contrato de manutenção' },
  });
  const nf = await prisma.notaFiscal.create({
    data: { unidadeId, contratoId: cA.id, numero: '1001', serie: '1', dataEmissao: dia(`${ano}-03-05`), dataRecebimento: dia(`${ano}-03-06`), valor: D('20000.00'), status: 'ATESTADA', criadoPor: ids.gestora },
  });
  const desA = await prisma.designacao.findFirstOrThrow({ where: { contratoId: cA.id, funcao: 'GESTOR' } });
  await prisma.atesto.create({ data: { notaFiscalId: nf.id, usuarioId: ids.gestora, designacaoId: desA.id, competencia: 'GESTOR — [DEMO] Portaria nº 123/GSD-SJ', data: dia(`${ano}-03-08`) } });
  await prisma.notaFiscal.create({
    data: { unidadeId, contratoId: cA.id, numero: '1002', serie: '1', dataEmissao: mais(-3), dataRecebimento: mais(-2), valor: D('15000.00'), status: 'RECEBIDA', criadoPor: ids.gestora },
  });
  const movs: Array<[string, string, string, string | null]> = [
    ['EMISSAO', '40000.00', `${ano}-02-01`, null],
    ['REFORCO', '10000.00', `${ano}-02-20`, null],
    ['ANULACAO', '5000.00', `${ano}-03-01`, null],
    ['LIQUIDACAO', '20000.00', `${ano}-03-10`, nf.id],
    ['PAGAMENTO', '15000.00', `${ano}-03-15`, nf.id],
  ];
  for (const [tipo, valor, data, nfId] of movs) {
    await prisma.movimentoEmpenho.create({
      data: {
        empenhoId: emp.id, tipo: tipo as never, valor: D(valor), dataMovimento: dia(data), documento: `[DEMO] ${tipo}`, autorId: autor,
        notaFiscalId: nfId, contratoId: nfId ? cA.id : null,
      },
    });
  }
  await prisma.rateioEmpenho.create({ data: { empenhoId: emp.id, contratoId: cA.id, valor: D('45000.00') } });
  const dem = await prisma.demanda.create({
    data: {
      unidadeId, exercicio: ano, titulo: '[DEMO] Manutenção predial — exercício', descricao: 'Necessidade fictícia para demonstração.', setorRequisitante: 'Seção de Infraestrutura (fictícia)',
      prioridade: 'ALTA', valorEstimado: D('180000.00'), status: 'APROVADA', numeroDfd: `DFD 03/${ano}`, processoId: p1.id, criadoPor: autor,
    },
  });
  await prisma.alocacaoOrcamentaria.create({
    data: { unidadeId, creditoId: cred.id, demandaId: dem.id, processoId: p1.id, exercicio: ano, valor: D('60000.00'), aprovadaEm: dia(`${ano}-01-20`), documento: '[DEMO] Despacho 4', autorId: autor },
  });

  await prisma.entrega.create({
    data: { unidadeId, contratoId: cB.id, descricao: 'Lote 1 — 20 caixas de papel A4', local: 'Almoxarifado (fictício)', quantidadePrevista: D('20'), prazo: mais(-4), criadoPor: autor },
  });
  await prisma.entrega.create({
    data: { unidadeId, contratoId: cB.id, descricao: 'Lote 2 — 20 caixas de papel A4', local: 'Almoxarifado (fictício)', quantidadePrevista: D('20'), prazo: mais(25), criadoPor: autor },
  });
  await prisma.registroExecucao.create({
    data: { unidadeId, contratoId: cA.id, tipo: 'RELATORIO', titulo: 'Relatório mensal de acompanhamento', texto: '[DEMO] Serviços executados conforme cronograma.', data: mais(-10), autorId: ids.gestora },
  });

  const risco = await prisma.risco.create({
    data: {
      unidadeId, contratoId: cA.id, evento: '[DEMO] Descontinuidade do serviço no fim da vigência', causa: 'Prorrogação não instruída a tempo', consequencia: 'Interrupção da manutenção',
      fase: 'Gestão contratual', categoria: 'Operacional', probabilidade: 4, impacto: 5, probResidual: 2, impactoResidual: 4, controles: 'Lembretes de vigência',
      acaoPreventiva: 'Iniciar análise de prorrogação com 90 dias', contingencia: 'Contratação emergencial — validar hipótese legal', responsavelId: ids.chefe, proximaRevisao: mais(-2), criadoPor: autor,
    },
  });
  await prisma.avaliacaoRisco.create({ data: { riscoId: risco.id, probabilidade: 4, impacto: 5, probResidual: 2, impactoResidual: 4, comentario: 'Avaliação inicial', autorId: autor } });
  await prisma.risco.create({
    data: {
      unidadeId, evento: '[DEMO] Pesquisa de preços com poucas fontes', causa: 'Mercado restrito', consequencia: 'Preço estimado inadequado', fase: 'Planejamento',
      categoria: 'Econômico', probabilidade: 3, impacto: 3, responsavelId: ids.auxiliar, proximaRevisao: mais(20), criadoPor: autor,
    },
  });

  await prisma.evento.create({
    data: { unidadeId, titulo: '[DEMO] Reunião de preparação da proposta orçamentária', tipo: 'PROPOSTA_ORCAMENTARIA', responsavelId: ids.chefe, participantes: [ids.auxiliar], inicio: new Date(mais(3).getTime() + 13 * 3600000), fim: new Date(mais(3).getTime() + 15 * 3600000), criadoPor: autor, lembreteDias: [1] },
  });
  const sol = await prisma.solicitacao.create({
    data: { unidadeId, contratoId: cA.id, categoria: 'NOTIFICACAO', titulo: '[DEMO] Atraso no atendimento de chamado corretivo', descricao: 'Chamado aberto há 5 dias sem atendimento.', prioridade: 'ALTA', autorId: ids.gestora },
  });
  await prisma.interacaoSolicitacao.create({ data: { solicitacaoId: sol.id, tipo: 'COMENTARIO', texto: 'Registro inicial pelo gestor.', autorId: ids.gestora } });

  const dir = path.resolve(process.cwd(), '.local');
  mkdirSync(dir, { recursive: true });
  const arquivo = path.join(dir, 'credenciais-demo.txt');
  writeFileSync(
    arquivo,
    [
      'AEROGEST GSD — credenciais DEMONSTRATIVAS (dados fictícios). Não utilizar em ambiente com dados reais.',
      `Gerado em ${new Date().toISOString()}. Senhas aleatórias; altere-as em "Minha conta" ou recrie o banco.`,
      '',
      ...creds,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(`Dados demonstrativos criados. Credenciais em ${arquivo}`);
}

async function main() {
  const u = await base();
  console.log(`Unidade ${u.sigla} pronta; parâmetros e modelos de checklist verificados.`);
  const prod = process.env.NODE_ENV === 'production';
  if (!prod && process.env.SEED_DEMO !== 'false') await demo(u.id);
  else console.log('Seed demonstrativo ignorado (produção ou SEED_DEMO=false). Crie o administrador com: npm run admin:create (dev) ou node dist/cli/create-admin.js (produção)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

