import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, registrarNaoAutenticado } from '@/lib/api';

export type Perfil = 'COMANDANTE' | 'ADMIN' | 'CHEFE' | 'AUXILIAR' | 'GESTOR';

export interface UnidadeAcesso {
  id: string;
  sigla: string;
  nome: string;
  nomeSecao: string;
  perfil: Perfil;
  suporte: boolean;
}

export interface Me {
  usuario: { id: string; nome: string; email: string; postoGraduacao?: string | null; mfaAtivo: boolean };
  mfaPendente: boolean;
  mfaObrigatorio: boolean;
  unidades: UnidadeAcesso[];
  unidadeAtual: UnidadeAcesso | null;
  expiraEm: string;
}

interface AuthCtx {
  me: Me | null;
  carregando: boolean;
  recarregar: () => Promise<unknown>;
  sair: () => Promise<void>;
  perfil: Perfil | null;
  pode: {
    escrever: boolean; // secretaria (admin/chefe/auxiliar)
    gerir: boolean; // admin/chefe
    admin: boolean;
    lerUnidade: boolean; // todos exceto gestor
    gestor: boolean;
  };
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [semSessao, setSemSessao] = useState(false);
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const r = await api.get<Me>('/auth/me');
        setSemSessao(false);
        return r;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setSemSessao(true);
          return null;
        }
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    registrarNaoAutenticado(() => {
      qc.setQueryData(['me'], null);
      setSemSessao(true);
    });
  }, [qc]);

  const valor = useMemo<AuthCtx>(() => {
    const me = semSessao ? null : (q.data ?? null);
    const perfil = me?.unidadeAtual?.perfil ?? null;
    return {
      me,
      carregando: q.isLoading,
      recarregar: () => q.refetch(),
      sair: async () => {
        await api.post('/auth/logout').catch(() => undefined);
        qc.clear();
        qc.setQueryData(['me'], null);
        setSemSessao(true);
      },
      perfil,
      pode: {
        escrever: perfil === 'ADMIN' || perfil === 'CHEFE' || perfil === 'AUXILIAR',
        gerir: perfil === 'ADMIN' || perfil === 'CHEFE',
        admin: perfil === 'ADMIN',
        lerUnidade: !!perfil && perfil !== 'GESTOR',
        gestor: perfil === 'GESTOR',
      },
    };
  }, [q, qc, semSessao]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
