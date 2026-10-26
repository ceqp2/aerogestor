/**
 * Testes de integração contra a API real + PostgreSQL de desenvolvimento com o seed demonstrativo.
 * Requer: banco migrado, `npm run db:seed` e o arquivo .local/credenciais-demo.txt (dados FICTÍCIOS).
 */
import 'dotenv/config';
process.env.JOBS_ENABLED = 'false';
process.env.THROTTLE_DISABLED = 'true';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { correlationMiddleware } from '../src/common/correlation.middleware';
import { ErrosFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

const CRED = path.resolve(__dirname, '..', '.local', 'credenciais-demo.txt');
const temSeed = existsSync(CRED);
const d = temSeed ? describe : describe.skip;

type Agente = { get: (u: string) => request.Test; post: (u: string, b?: object) => request.Test; csrf: string };

d('API (integração)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const creds: Record<string, { email: string; senha: string }> = {};
  const ano = new Date().getFullYear();

  async function login(nome: string): Promise<Agente> {
    const ag = request.agent(app.getHttpServer());
    const r = await ag.post('/api/v1/auth/login').send(creds[nome]).expect(200);
    const csrf = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('aerogest_csrf='))!.split(';')[0].split('=')[1];
    return {
      csrf,
      get: (u) => ag.get('/api/v1' + u),
      post: (u, b = {}) => ag.post('/api/v1' + u).set('x-csrf-token', csrf).send(b),
    };
  }

  beforeAll(async () => {
    for (const l of readFileSync(CRED, 'utf8').split('\n').filter((x) => x.includes('@demo'))) {
      const [, email, senha] = l.trim().split(/\s+/);
      creds[email.split('@')[0]] = { email, senha };
    }
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(correlationMiddleware);
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new ErrosFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => app?.close());

  it('rejeita requisição sem sessão e login inválido sem revelar o motivo', async () => {
    await request(app.getHttpServer()).get('/api/v1/processos').expect(401);
    const r = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'naoexiste@x.invalid', senha: 'x' }).expect(401);
    expect(r.body.message).toBe('E-mail ou senha inválidos');
  });

  it('escrita sem token CSRF é bloqueada', async () => {
    const chefe = await login('chefe');
    const ag = request.agent(app.getHttpServer());
    await ag.post('/api/v1/auth/login').send(creds.chefe);
    await ag.post('/api/v1/planejamento/propostas').send({ exercicio: ano, titulo: 'x' }).expect(403);
    expect(chefe.csrf.length).toBeGreaterThan(10);
  });

  it('validação rejeita campos extras e valores monetários em float', async () => {
    const chefe = await login('chefe');
    await chefe.post('/planejamento/demandas', { exercicio: ano, titulo: 'x', descricao: 'y', setorRequisitante: 'z', hack: 1 }).expect(400);
    await chefe.post('/planejamento/demandas', { exercicio: ano, titulo: 'x', descricao: 'y', setorRequisitante: 'z', valorEstimado: 10.5 }).expect(400);
  });

  it('gestor A não acessa contrato de B por URL, API, busca, financeiro, execução ou documento', async () => {
    const chefe = await login('chefe');
    const lista = (await chefe.get('/contratos').expect(200)).body.itens;
    const cB = lista.find((c: { numero: string }) => c.numero.includes('09/'));
    const gA = await login('gestora');
    await gA.get(`/contratos/${cB.id}`).expect(404);
    await gA.get(`/financeiro/contratos/${cB.id}`).expect(404);
    await gA.get(`/execucao/contratos/${cB.id}`).expect(404);
    await gA.get(`/documentos?vinculoTipo=CONTRATO&vinculoId=${cB.id}`).expect(404);
    const busca = (await gA.get(`/contratos?busca=09`).expect(200)).body.itens;
    expect(busca).toHaveLength(0);
    await gA.post('/solicitacoes', { contratoId: cB.id, categoria: 'CONTATO', titulo: 't', descricao: 'd' }).expect(404);
    await gA.get(`/relatorios/vigencias?exercicio=${ano}`).expect(403);
  });

  it('auxiliar só cria gestor e não se promove; desativação revoga sessões', async () => {
    const aux = await login('auxiliar');
    await aux.post('/usuarios', { nome: 'X', email: `x${Date.now()}@t.invalid`, perfil: 'AUXILIAR' }).expect(403);
    const novo = await aux.post('/usuarios', { nome: '[DEMO] Gestor teste', email: `g${Date.now()}@demo.aerogest.invalid`, perfil: 'GESTOR' }).expect(201);
    expect(novo.body.convite.link).toMatch(/\/convite\//);
    const eu = (await aux.get('/usuarios').expect(200)).body.find((u: { email: string }) => u.email.startsWith('auxiliar@'));
    await aux.post(`/usuarios/${eu.id}/perfil`, { perfil: 'CHEFE', motivo: 'tentativa' }).expect(403);

    // aceita convite e depois é desativado: sessão revogada, designações preservadas
    const chefe = await login('chefe');
    const link = (await chefe.post(`/usuarios/${novo.body.id}/link-acesso`).expect(200)).body.link as string;
    const token = link.split('/convite/')[1];
    await request(app.getHttpServer()).post('/api/v1/auth/convite/aceitar').send({ token, senha: 'curta' }).expect(400);
    await request(app.getHttpServer()).post('/api/v1/auth/convite/aceitar').send({ token, senha: 'Xt7#pLm2qRz9!w' }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/convite/aceitar').send({ token, senha: 'Xt7#pLm2qRz9!w' }).expect(400);
    const ag = request.agent(app.getHttpServer());
    await ag.post('/api/v1/auth/login').send({ email: (await prisma.usuario.findUniqueOrThrow({ where: { id: novo.body.id } })).email, senha: 'Xt7#pLm2qRz9!w' }).expect(200);
    await ag.get('/api/v1/auth/me').expect(200);
    await chefe.post(`/usuarios/${novo.body.id}/desativar`, { motivo: 'Teste de desativação' }).expect(200);
    await ag.get('/api/v1/auth/me').expect(401);
  });

  it('unidades isoladas: registro de outra unidade retorna 404', async () => {
    const outra = await prisma.unidade.upsert({ where: { sigla: 'TESTE-ISO' }, create: { sigla: 'TESTE-ISO', nome: 'Unidade de teste' }, update: {} });
    const forn = await prisma.fornecedor.upsert({
      where: { unidadeId_documento: { unidadeId: outra.id, documento: '11222333000181' } },
      create: { unidadeId: outra.id, documento: '11222333000181', razaoSocial: 'Outra' },
      update: {},
    });
    const c = await prisma.contratoInstrumento.upsert({
      where: { unidadeId_numero: { unidadeId: outra.id, numero: 'ISO-1' } },
      create: {
        unidadeId: outra.id, numero: 'ISO-1', tipo: 'CONTRATO', natureza: 'SERVICO', fornecedorId: forn.id, objeto: 'x', valorInicial: '1', valorAtualizado: '1',
        vigenciaInicio: new Date('2026-01-01T00:00:00Z'), vigenciaFim: new Date('2026-12-31T00:00:00Z'), criadoPor: forn.id,
      },
      update: {},
    });
    const admin = await login('admin');
    await admin.get(`/contratos/${c.id}`).expect(404);
  });

  it('pagamentos concorrentes não ultrapassam o saldo liquidado', async () => {
    const chefe = await login('chefe');
    const credito = (await chefe.get(`/financeiro/creditos?exercicio=${ano}`).expect(200)).body[0];
    const forn = (await chefe.get('/fornecedores').expect(200)).body[0];
    const contrato = (await chefe.get('/contratos').expect(200)).body.itens.find((c: { numero: string }) => c.numero.includes('05/'));
    const emp = await chefe.post('/financeiro/empenhos', {
      numero: `${ano}NE9${Date.now() % 100000}`, creditoId: credito.creditoId, fornecedorId: forn.id, dataEmissao: `${ano}-04-01`, valor: '1000.00', contratoId: contrato.id,
    }).expect(201);
    // nota atestada direta no banco (atesto exige designação; aqui testamos só o ledger)
    const nf = await prisma.notaFiscal.create({
      data: { unidadeId: contrato.unidadeId, contratoId: contrato.id, numero: `T${Date.now()}`, serie: '', dataEmissao: new Date(`${ano}-04-02T00:00:00Z`), dataRecebimento: new Date(`${ano}-04-02T00:00:00Z`), valor: '1000.00', status: 'ATESTADA', criadoPor: forn.id },
    });
    await chefe.post(`/financeiro/empenhos/${emp.body.id}/movimentos`, { tipo: 'LIQUIDACAO', valor: '600.00', documento: 'NS t', dataMovimento: `${ano}-04-03`, notaFiscalId: nf.id }).expect(201);
    const tentativas = await Promise.all(
      Array.from({ length: 5 }, () => chefe.post(`/financeiro/empenhos/${emp.body.id}/movimentos`, { tipo: 'PAGAMENTO', valor: '200.00', documento: 'OB t', dataMovimento: `${ano}-04-04`, notaFiscalId: nf.id })),
    );
    expect(tentativas.filter((t) => t.status === 201)).toHaveLength(3);
    const det = (await chefe.get(`/financeiro/empenhos/${emp.body.id}`).expect(200)).body;
    expect(det.saldos.pagoLiquido).toBe('600.00');
    expect(det.saldos.liquidadoAPagar).toBe('0.00');
  });

  it('ledger e auditoria são imutáveis no banco', async () => {
    await expect(prisma.$executeRawUnsafe('UPDATE "MovimentoEmpenho" SET valor = 1')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('DELETE FROM "RegistroAuditoria"')).rejects.toThrow();
  });

  it('atesto exige designação ativa; documento: tipo real e download autorizado', async () => {
    const chefe = await login('chefe');
    const contrato = (await chefe.get('/contratos').expect(200)).body.itens.find((c: { numero: string }) => c.numero.includes('05/'));
    const nf = await chefe.post(`/execucao/contratos/${contrato.id}/notas`, { numero: `A${Date.now()}`, dataEmissao: `${ano}-05-01`, dataRecebimento: `${ano}-05-02`, valor: '10.00' }).expect(201);
    await chefe.post(`/execucao/notas/${nf.body.id}/atesto`, { data: `${ano}-05-03` }).expect(403);

    const ag = request.agent(app.getHttpServer());
    const r = await ag.post('/api/v1/auth/login').send(creds.chefe);
    const csrf = (r.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('aerogest_csrf='))!.split(';')[0].split('=')[1];
    await ag.post('/api/v1/documentos').set('x-csrf-token', csrf)
      .field('titulo', 'exe disfarçado').field('categoria', 'OUTRO').field('vinculoTipo', 'CONTRATO').field('vinculoId', contrato.id)
      .attach('arquivo', Buffer.from('MZ\x90\x00binario'), 'nota.pdf').expect(400);
    const up = await ag.post('/api/v1/documentos').set('x-csrf-token', csrf)
      .field('titulo', 'Relatório').field('categoria', 'RELATORIO').field('vinculoTipo', 'CONTRATO').field('vinculoId', contrato.id).field('liberadoGestor', 'false')
      .attach('arquivo', Buffer.from('%PDF-1.4 teste'), 'relatorio.pdf').expect(201);
    const dl = await ag.get(`/api/v1/documentos/${up.body.id}/download`).expect(200);
    expect(dl.headers['content-disposition']).toContain('attachment');
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    // gestor do contrato não vê documento interno (não liberado)
    const gA = await login('gestora');
    await gA.get(`/documentos/${up.body.id}/download`).expect(404);
  });
});
