import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PERFIS } from '@/lib/rotulos';
import { useAuth } from './useAuth';

export function useUsuariosOpcoes() {
  const { pode } = useAuth();
  const q = useQuery({
    queryKey: ['usuarios', 'opcoes'],
    queryFn: () => api.get<Array<{ id: string; nome: string; postoGraduacao?: string; perfil: string }>>('/usuarios/opcoes'),
    enabled: pode.lerUnidade,
    staleTime: 60_000,
  });
  return (q.data ?? []).map((u) => ({ value: u.id, label: `${u.postoGraduacao ? u.postoGraduacao + ' ' : ''}${u.nome} (${PERFIS[u.perfil] ?? u.perfil})` }));
}

export function useFornecedoresOpcoes() {
  const { pode } = useAuth();
  const q = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => api.get<Array<{ id: string; razaoSocial: string; documento: string }>>('/fornecedores'),
    enabled: pode.lerUnidade,
    staleTime: 60_000,
  });
  return (q.data ?? []).map((f) => ({ value: f.id, label: `${f.razaoSocial} — ${f.documento}` }));
}

export function useContratosOpcoes() {
  const q = useQuery({
    queryKey: ['contratos', 'opcoes'],
    queryFn: () => api.get<{ itens: Array<{ id: string; numero: string; objeto: string }> }>('/contratos?tamanho=200'),
    staleTime: 60_000,
  });
  return (q.data?.itens ?? []).map((c) => ({ value: c.id, label: `${c.numero} — ${c.objeto.slice(0, 60)}` }));
}

export function useProcessosOpcoes() {
  const { pode } = useAuth();
  const q = useQuery({
    queryKey: ['processos', 'opcoes'],
    queryFn: () => api.get<{ itens: Array<{ id: string; numeroInterno: string; objeto: string }> }>('/processos?tamanho=200'),
    enabled: pode.lerUnidade,
    staleTime: 60_000,
  });
  return (q.data?.itens ?? []).map((p) => ({ value: p.id, label: `${p.numeroInterno} — ${p.objeto.slice(0, 60)}` }));
}
