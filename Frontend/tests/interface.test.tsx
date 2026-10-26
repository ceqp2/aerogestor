import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { converter, Campo } from '@/components/Formulario';
import { Tabela } from '@/components/Tabela';
import { Selo } from '@/components/ui';
import { requisitosSenha } from '@/features/auth/ConvitePage';
import { data, moeda, normalizarValor } from '@/lib/formato';

describe('formatação pt-BR', () => {
  it('moeda em BRL', () => expect(moeda('45000.00').replace(/\s/g, ' ')).toBe('R$ 45.000,00'));
  it('data civil sem deslocamento de fuso', () => {
    expect(data('2026-01-01')).toBe('01/01/2026');
    expect(data('2026-01-01T00:00:00.000Z')).toBe('01/01/2026');
  });
  it('valor digitado vira string decimal (nunca float)', () => {
    expect(normalizarValor('1.234,56')).toBe('1234.56');
    expect(normalizarValor('R$ 10,5')).toBe('10.5');
    expect(normalizarValor('99.90')).toBe('99.90');
  });
});

describe('formulário', () => {
  const campos: Campo[] = [
    { nome: 'valor', rotulo: 'Valor', tipo: 'dinheiro' },
    { nome: 'n', rotulo: 'N', tipo: 'numero' },
    { nome: 'oculto', rotulo: 'Oculto', visivel: () => false },
    { nome: 'vazio', rotulo: 'Vazio' },
    { nome: 'ok', rotulo: 'Ok', tipo: 'checkbox' },
  ];
  it('converte para o formato da API e omite campos vazios/ocultos', () => {
    expect(converter(campos, { valor: '1.000,00', n: '3', oculto: 'x', vazio: '', ok: true })).toEqual({ valor: '1000.00', n: 3, ok: true });
  });
});

describe('política de senha (feedback no cliente)', () => {
  it('exige 12+ caracteres e 3 classes', () => {
    expect(requisitosSenha('curta').every((r) => r.ok)).toBe(false);
    expect(requisitosSenha('Xt7#pLm2qRz9!w', 'a@b.c').every((r) => r.ok)).toBe(true);
  });
});

describe('acessibilidade de componentes', () => {
  it('selo de status traz texto (não depende só de cor)', () => {
    render(<Selo tom="perigo">Crítico</Selo>);
    expect(screen.getByText('Crítico')).toBeInTheDocument();
  });
  it('tabela renderiza versão tabular e em cartões com rótulo', () => {
    render(
      <MemoryRouter>
        <Tabela rotulo="Itens" dados={[{ id: '1', nome: 'A' }]} chave={(l) => l.id} colunas={[{ titulo: 'Nome', render: (l) => l.nome }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('table', { name: 'Itens' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Itens' })).toBeInTheDocument();
  });
});
