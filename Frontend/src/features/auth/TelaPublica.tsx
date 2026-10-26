import { ReactNode } from 'react';

export function TelaPublica({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-azul-claro-2 to-fundo px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icone.svg" alt="" className="mb-3 size-14" />
          <p className="text-xl font-bold tracking-wide text-tinta">AEROGEST GSD</p>
          <p className="text-sm text-tinta-suave">Gestão de Aquisições e Contratos</p>
          <p className="mt-1 text-xs text-tinta-suave">Grupo de Segurança e Defesa de São José dos Campos</p>
        </div>
        <main className="rounded-2xl border border-borda bg-white p-6 shadow-cartao sm:p-8">
          <h1 className="text-lg font-semibold text-tinta">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-tinta-suave">{subtitulo}</p>}
          <div className="mt-5">{children}</div>
        </main>
        <p className="mt-4 text-center text-[0.7rem] text-tinta-suave">Acesso restrito a usuários autorizados. As ações são registradas em trilha de auditoria.</p>
      </div>
    </div>
  );
}
