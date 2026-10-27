import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle, BarChart3, Bell, Building2, CalendarDays, ChevronsLeft, ChevronsRight, ClipboardList, FileSearch, FileText, FolderOpen,
  LayoutDashboard, LogOut, Menu, MessageSquareText, Search, Settings, ShieldCheck, Wallet, X, FileSignature, NotebookPen, UserCircle,
} from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { PERFIS } from '@/lib/rotulos';
import { Perfil, useAuth } from '@/hooks/useAuth';
import { useExercicio } from '@/hooks/useExercicio';
import { Aviso } from '@/components/ui';

interface ItemMenu {
  to: string;
  rotulo: string;
  icone: ReactNode;
  perfis?: Perfil[];
}

const TODOS_MENOS_GESTOR: Perfil[] = ['COMANDANTE', 'ADMIN', 'CHEFE', 'AUXILIAR'];

const MENU: ItemMenu[] = [
  { to: '/', rotulo: 'Visão geral', icone: <LayoutDashboard className="size-5" /> },
  { to: '/processos', rotulo: 'Processos', icone: <ClipboardList className="size-5" /> },
  { to: '/planejamento', rotulo: 'Planejamento', icone: <NotebookPen className="size-5" />, perfis: TODOS_MENOS_GESTOR },
  { to: '/financeiro', rotulo: 'Financeiro', icone: <Wallet className="size-5" />, perfis: TODOS_MENOS_GESTOR },
  { to: '/atas', rotulo: 'Atas', icone: <FileSignature className="size-5" />, perfis: TODOS_MENOS_GESTOR },
  { to: '/contratos', rotulo: 'Contratos e execução', icone: <Building2 className="size-5" /> },
  { to: '/riscos', rotulo: 'Riscos', icone: <AlertTriangle className="size-5" /> },
  { to: '/calendario', rotulo: 'Calendário', icone: <CalendarDays className="size-5" /> },
  { to: '/consultas', rotulo: 'Consultas públicas', icone: <FileSearch className="size-5" />, perfis: TODOS_MENOS_GESTOR },
  { to: '/documentos', rotulo: 'Documentos', icone: <FolderOpen className="size-5" /> },
  { to: '/solicitacoes', rotulo: 'Solicitações', icone: <MessageSquareText className="size-5" /> },
  { to: '/relatorios', rotulo: 'Relatórios', icone: <BarChart3 className="size-5" />, perfis: TODOS_MENOS_GESTOR },
  { to: '/administracao', rotulo: 'Administração', icone: <Settings className="size-5" />, perfis: ['ADMIN', 'CHEFE', 'AUXILIAR', 'COMANDANTE'] },
];

function Marca({ compacta }: { compacta?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="AEROGEST GSD — início">
      <img src="/icone.svg" alt="" className="size-9 shrink-0" />
      {!compacta && (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-wide text-tinta">AEROGEST GSD</span>
          <span className="block text-[0.7rem] text-tinta-suave">Gestão de Aquisições e Contratos</span>
        </span>
      )}
    </Link>
  );
}

export function LayoutApp() {
  const { me, perfil, sair } = useAuth();
  const { exercicio, setExercicio } = useExercicio();
  const [recolhido, setRecolhido] = useState(() => {
    try {
      return localStorage.getItem('aerogest.menu') === '1';
    } catch {
      return false;
    }
  });
  const [menuMovel, setMenuMovel] = useState(false);
  const [busca, setBusca] = useState('');
  const navegar = useNavigate();
  const loc = useLocation();

  useEffect(() => setMenuMovel(false), [loc.pathname]);

  const notif = useQuery({ queryKey: ['notificacoes', 'contagem'], queryFn: () => api.get<{ naoLidas: number }>('/notificacoes/contagem'), refetchInterval: 60_000 });

  const itens = MENU.filter((m) => !m.perfis || (perfil && m.perfis.includes(perfil)));
  const alternar = () => {
    setRecolhido((r) => {
      try {
        localStorage.setItem('aerogest.menu', r ? '0' : '1');
      } catch {
        /* sem armazenamento */
      }
      return !r;
    });
  };
  const buscar = (e: FormEvent) => {
    e.preventDefault();
    if (busca.trim().length >= 2) navegar(`/busca?q=${encodeURIComponent(busca.trim())}`);
  };
  const anos = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i);

  const nav = (compacto: boolean) => (
    <nav aria-label="Menu principal" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      {itens.map((m) => (
        <NavLink
          key={m.to}
          to={m.to}
          end={m.to === '/'}
          title={compacto ? m.rotulo : undefined}
          className={({ isActive }) =>
            clsx(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-azul-claro text-tinta' : 'text-tinta-suave hover:bg-azul-claro-2 hover:text-tinta',
              compacto && 'justify-center px-0',
            )
          }
        >
          <span aria-hidden>{m.icone}</span>
          {!compacto && <span>{m.rotulo}</span>}
          {compacto && <span className="sr-only">{m.rotulo}</span>}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Pular para o conteúdo
      </a>

      {/* Sidebar desktop */}
      <aside className={clsx('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-borda bg-white md:flex', recolhido ? 'w-[72px]' : 'w-60')}>
        <div className={clsx('flex h-16 items-center border-b border-borda', recolhido ? 'justify-center' : 'px-4')}>
          <Marca compacta={recolhido} />
        </div>
        {nav(recolhido)}
        <div className="border-t border-borda p-2">
          {!recolhido && <p className="px-2 pb-2 text-[0.7rem] leading-snug text-tinta-suave">Grupo de Segurança e Defesa de São José dos Campos</p>}
          <button onClick={alternar} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-sm text-tinta-suave hover:bg-fundo" aria-label={recolhido ? 'Expandir menu' : 'Recolher menu'}>
            {recolhido ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" /> Recolher</>}
          </button>
        </div>
      </aside>

      {/* Menu móvel */}
      {menuMovel && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-tinta/40" onClick={() => setMenuMovel(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-borda px-4">
              <Marca />
              <button onClick={() => setMenuMovel(false)} className="rounded-lg p-2" aria-label="Fechar menu">
                <X className="size-5" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-borda bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 sm:px-5">
            <button onClick={() => setMenuMovel(true)} className="rounded-lg p-2 md:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </button>
            <form onSubmit={buscar} role="search" className="relative hidden max-w-sm flex-1 sm:block">
              <label htmlFor="busca-global" className="sr-only">
                Busca global
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
              <input
                id="busca-global"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar processo, NUP, contrato, ata…"
                className="h-10 w-full rounded-lg border border-borda bg-fundo pl-9 pr-3 text-sm"
              />
            </form>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button onClick={() => navegar('/busca')} className="rounded-lg p-2 sm:hidden" aria-label="Buscar">
                <Search className="size-5" />
              </button>
              <div className="hidden text-right md:block">
                <p className="text-sm font-medium text-tinta">{me?.unidadeAtual?.sigla}</p>
                <p className="text-[0.7rem] text-tinta-suave">{me?.unidadeAtual?.nomeSecao}</p>
              </div>
              <label className="sr-only" htmlFor="exercicio">
                Exercício
              </label>
              <select id="exercicio" value={exercicio} onChange={(e) => setExercicio(Number(e.target.value))} className="h-9 rounded-lg border border-borda bg-white px-2 text-sm sm:h-10" title="Exercício">
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <Link to="/notificacoes" className="relative rounded-lg p-1.5 hover:bg-fundo sm:p-2" aria-label={`Notificações: ${notif.data?.naoLidas ?? 0} não lidas`}>
                <Bell className="size-5 text-tinta" />
                {!!notif.data?.naoLidas && (
                  <span className="absolute right-0 top-0 min-w-5 rounded-full bg-perigo px-1 text-center text-[0.6rem] font-bold leading-5 text-white">
                    {notif.data.naoLidas > 99 ? '99+' : notif.data.naoLidas}
                  </span>
                )}
              </Link>
              <MenuPerfil nome={me?.usuario.nome ?? ''} perfil={perfil} trocar={(me?.unidades.length ?? 0) > 1} sair={sair} />
            </div>
          </div>
        </header>

        <main id="conteudo" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6">
          {me?.mfaObrigatorio && (
            <div className="mb-4">
              <Aviso tom="atencao" titulo="MFA obrigatório">
                Seu perfil exige autenticação em dois fatores. <Link to="/conta" className="font-semibold underline">Ative agora</Link>.
              </Aviso>
            </div>
          )}
          {me?.unidadeAtual?.suporte && (
            <div className="mb-4">
              <Aviso tom="atencao" titulo="Acesso de suporte">
                Você está nesta unidade por concessão temporária de suporte. Todas as ações são auditadas.
              </Aviso>
            </div>
          )}
          <Outlet />
        </main>
        <footer className="border-t border-borda px-4 py-3 text-center text-[0.7rem] text-tinta-suave sm:px-6">
          AEROGEST GSD — ferramenta de apoio gerencial; não substitui atos e sistemas oficiais. Versão para homologação.
        </footer>
      </div>
    </div>
  );
}

function MenuPerfil({ nome, perfil, trocar, sair }: { nome: string; perfil: Perfil | null; trocar: boolean; sair: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const navegar = useNavigate();
  useEffect(() => {
    if (!aberto) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [aberto]);
  return (
    <div className="relative">
      <button onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-haspopup="menu" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-fundo">
        <UserCircle className="size-7 text-acao" aria-hidden />
        <span className="hidden max-w-40 truncate text-left text-sm lg:block">
          <span className="block truncate font-medium">{nome}</span>
          <span className="block text-[0.7rem] text-tinta-suave">{perfil ? PERFIS[perfil] : ''}</span>
        </span>
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-borda bg-white p-1.5 shadow-lg">
            <p className="px-3 py-2 text-xs text-tinta-suave lg:hidden">
              {nome}
              <br />
              {perfil ? PERFIS[perfil] : ''}
            </p>
            <Link role="menuitem" to="/conta" onClick={() => setAberto(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-fundo">
              <ShieldCheck className="size-4" /> Minha conta e segurança
            </Link>
            {trocar && (
              <Link role="menuitem" to="/selecionar-unidade" onClick={() => setAberto(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-fundo">
                <Building2 className="size-4" /> Trocar unidade
              </Link>
            )}
            <Link role="menuitem" to="/documentos" onClick={() => setAberto(false)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm hover:bg-fundo">
              <FileText className="size-4" /> Meus documentos
            </Link>
            <button
              role="menuitem"
              onClick={async () => {
                await sair();
                navegar('/login');
              }}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-perigo hover:bg-perigo-fundo"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}
