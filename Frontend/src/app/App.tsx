import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, ReactNode, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Carregando, ToastProvider } from '@/components/feedback';
import { ApiError } from '@/lib/api';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ExercicioProvider } from '@/hooks/useExercicio';
import { LayoutApp } from './LayoutApp';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const MfaPage = lazy(() => import('@/features/auth/MfaPage'));
const ConvitePage = lazy(() => import('@/features/auth/ConvitePage'));
const SelecionarUnidadePage = lazy(() => import('@/features/auth/SelecionarUnidadePage'));
const MinhaContaPage = lazy(() => import('@/features/auth/MinhaContaPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const ProcessosPage = lazy(() => import('@/features/processos/ProcessosPage'));
const ProcessoDetalhePage = lazy(() => import('@/features/processos/ProcessoDetalhePage'));
const PlanejamentoPage = lazy(() => import('@/features/planejamento/PlanejamentoPage'));
const FinanceiroPage = lazy(() => import('@/features/financeiro/FinanceiroPage'));
const EmpenhoDetalhePage = lazy(() => import('@/features/financeiro/EmpenhoDetalhePage'));
const AtasPage = lazy(() => import('@/features/atas/AtasPage'));
const AtaDetalhePage = lazy(() => import('@/features/atas/AtaDetalhePage'));
const ContratosPage = lazy(() => import('@/features/contratos/ContratosPage'));
const ContratoDetalhePage = lazy(() => import('@/features/contratos/ContratoDetalhePage'));
const RiscosPage = lazy(() => import('@/features/riscos/RiscosPage'));
const RiscoDetalhePage = lazy(() => import('@/features/riscos/RiscoDetalhePage'));
const CalendarioPage = lazy(() => import('@/features/calendario/CalendarioPage'));
const ConsultasPage = lazy(() => import('@/features/consultas/ConsultasPage'));
const DocumentosPage = lazy(() => import('@/features/documentos/DocumentosPage'));
const SolicitacoesPage = lazy(() => import('@/features/solicitacoes/SolicitacoesPage'));
const SolicitacaoDetalhePage = lazy(() => import('@/features/solicitacoes/SolicitacaoDetalhePage'));
const RelatoriosPage = lazy(() => import('@/features/relatorios/RelatoriosPage'));
const AdministracaoPage = lazy(() => import('@/features/administracao/AdministracaoPage'));
const NotificacoesPage = lazy(() => import('@/features/notificacoes/NotificacoesPage'));
const BuscaPage = lazy(() => import('@/features/busca/BuscaPage'));

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof ApiError && [401, 403, 404].includes(e.status)) && n < 2,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function Protegido({ children }: { children: ReactNode }) {
  const { me, carregando } = useAuth();
  const loc = useLocation();
  if (carregando) return <div className="p-8"><Carregando /></div>;
  if (!me) return <Navigate to="/login" replace state={{ de: loc.pathname + loc.search }} />;
  if (me.mfaPendente) return <Navigate to="/mfa" replace />;
  if (!me.unidadeAtual) return <Navigate to="/selecionar-unidade" replace />;
  return <>{children}</>;
}

function Rotas() {
  return (
    <Suspense fallback={<div className="p-8"><Carregando /></div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/mfa" element={<MfaPage />} />
        <Route path="/convite/:token" element={<ConvitePage />} />
        <Route path="/selecionar-unidade" element={<SelecionarUnidadePage />} />
        <Route
          element={
            <Protegido>
              <LayoutApp />
            </Protegido>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="processos" element={<ProcessosPage />} />
          <Route path="processos/:id" element={<ProcessoDetalhePage />} />
          <Route path="planejamento" element={<PlanejamentoPage />} />
          <Route path="financeiro" element={<FinanceiroPage />} />
          <Route path="financeiro/empenhos/:id" element={<EmpenhoDetalhePage />} />
          <Route path="atas" element={<AtasPage />} />
          <Route path="atas/:id" element={<AtaDetalhePage />} />
          <Route path="contratos" element={<ContratosPage />} />
          <Route path="contratos/:id" element={<ContratoDetalhePage />} />
          <Route path="riscos" element={<RiscosPage />} />
          <Route path="riscos/:id" element={<RiscoDetalhePage />} />
          <Route path="calendario" element={<CalendarioPage />} />
          <Route path="consultas" element={<ConsultasPage />} />
          <Route path="documentos" element={<DocumentosPage />} />
          <Route path="solicitacoes" element={<SolicitacoesPage />} />
          <Route path="solicitacoes/:id" element={<SolicitacaoDetalhePage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="administracao" element={<AdministracaoPage />} />
          <Route path="notificacoes" element={<NotificacoesPage />} />
          <Route path="busca" element={<BuscaPage />} />
          <Route path="conta" element={<MinhaContaPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AuthProvider>
          <ExercicioProvider>
            <BrowserRouter>
              <Rotas />
            </BrowserRouter>
          </ExercicioProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
