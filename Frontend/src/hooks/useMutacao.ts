import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/feedback';

/** Mutação com invalidação de consultas e toast de sucesso/erro. */
export function useMutacao<TVar, TRes = unknown>(fn: (v: TVar) => Promise<TRes>, opcoes: { invalidar?: unknown[][]; sucesso?: string; silenciarErro?: boolean } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all((opcoes.invalidar ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (opcoes.sucesso) toast.sucesso(opcoes.sucesso);
    },
    onError: (e) => {
      if (!opcoes.silenciarErro) toast.erro(e);
    },
  });
}
