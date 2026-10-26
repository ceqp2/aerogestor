import type { EventClickArg, EventInput, EventSourceFuncArg } from '@fullcalendar/core';
import ptBr from '@fullcalendar/core/locales/pt-br';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/feedback';
import { Campo, FormularioModal } from '@/components/Formulario';
import { Confirmacao } from '@/components/Modal';
import { Botao, CabecalhoPagina, Cartao, Selo } from '@/components/ui';
import { api } from '@/lib/api';
import { opcoes, PRIORIDADES, TIPOS_EVENTO } from '@/lib/rotulos';
import { useAuth } from '@/hooks/useAuth';
import { useContratosOpcoes, useUsuariosOpcoes } from '@/hooks/useOpcoes';

interface ItemAgenda {
  id: string;
  titulo: string;
  tipo: string;
  start: string;
  end?: string | null;
  allDay: boolean;
  automatico: boolean;
  prioridade?: string;
  concluido?: boolean;
  link?: string;
  regra?: string;
}

const COR: Record<string, string> = {
  VIGENCIA: '#B42318',
  ENTREGA: '#925C00',
  REVISAO_RISCO: '#7a4b9e',
  CONTATO_EMPRESA: '#16794A',
  OUTRO: '#4a6680',
};

export default function CalendarioPage() {
  const { perfil } = useAuth();
  const navegar = useNavigate();
  const toast = useToast();
  const cal = useRef<FullCalendar>(null);
  const usuarios = useUsuariosOpcoes();
  const contratos = useContratosOpcoes();
  const [criar, setCriar] = useState<{ data?: string } | null>(null);
  const [editar, setEditar] = useState<Record<string, unknown> | null>(null);
  const [remover, setRemover] = useState<string | null>(null);

  const carregar = async (info: EventSourceFuncArg): Promise<EventInput[]> => {
    const itens = await api.get<ItemAgenda[]>(`/calendario/agenda?de=${encodeURIComponent(info.start.toISOString())}&ate=${encodeURIComponent(info.end.toISOString())}`);
    return itens.map((e) => ({
      id: e.id,
      title: (e.automatico ? '◆ ' : '') + e.titulo,
      start: e.start,
      end: e.end ?? undefined,
      allDay: e.allDay,
      backgroundColor: e.automatico ? (COR[e.tipo] ?? '#4a6680') : e.concluido ? '#9fb3c4' : '#246A9E',
      borderColor: 'transparent',
      extendedProps: e,
    }));
  };

  const clicar = async (arg: EventClickArg) => {
    const e = arg.event.extendedProps as ItemAgenda;
    if (e.automatico) {
      if (e.link) navegar(e.link);
      return;
    }
    try {
      const ev = await api.get<Record<string, unknown>>(`/calendario/eventos/${e.id.split(':')[0]}`);
      setEditar(ev);
    } catch (err) {
      toast.erro(err);
    }
  };

  const campos: Campo[] = [
    { nome: 'titulo', rotulo: 'Título', obrigatorio: true },
    { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: opcoes(TIPOS_EVENTO), obrigatorio: true, meia: true, ajuda: 'Marcos TOD: datas e definição da sigla pendentes de validação institucional.' },
    { nome: 'prioridade', rotulo: 'Prioridade', tipo: 'select', opcoes: opcoes(PRIORIDADES), meia: true },
    { nome: 'diaInteiro', rotulo: 'Dia inteiro', tipo: 'checkbox' },
    { nome: 'inicioData', rotulo: 'Data', tipo: 'data', obrigatorio: true, meia: true, visivel: (v) => !!v.diaInteiro },
    { nome: 'inicioHora', rotulo: 'Início', tipo: 'datahora', meia: true, visivel: (v) => !v.diaInteiro },
    { nome: 'fimHora', rotulo: 'Fim', tipo: 'datahora', meia: true, visivel: (v) => !v.diaInteiro },
    { nome: 'responsavelId', rotulo: 'Responsável', tipo: 'select', opcoes: usuarios, meia: true },
    { nome: 'contratoId', rotulo: 'Contrato vinculado', tipo: 'select', opcoes: contratos, meia: true },
    { nome: 'recorrencia', rotulo: 'Recorrência', tipo: 'select', opcoes: [{ value: 'NENHUMA', label: 'Nenhuma' }, { value: 'SEMANAL', label: 'Semanal' }, { value: 'MENSAL', label: 'Mensal' }, { value: 'ANUAL', label: 'Anual' }], meia: true },
    { nome: 'lembrete', rotulo: 'Lembrete (dias antes)', tipo: 'numero', min: 0, max: 365, meia: true },
    { nome: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
  ];
  const paraApi = (v: Record<string, unknown>) => ({
    titulo: v.titulo,
    tipo: v.tipo,
    prioridade: v.prioridade,
    diaInteiro: !!v.diaInteiro,
    inicio: v.diaInteiro ? v.inicioData : v.inicioHora,
    fim: v.diaInteiro ? undefined : v.fimHora,
    responsavelId: v.responsavelId,
    contratoId: v.contratoId,
    recorrencia: v.recorrencia,
    lembreteDias: v.lembrete !== undefined ? [Number(v.lembrete)] : undefined,
    descricao: v.descricao,
  });
  const atualizarCal = () => cal.current?.getApi().refetchEvents();
  const local = (iso?: unknown) => {
    if (!iso) return '';
    const d = new Date(String(iso));
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Calendário"
        subtitulo="Atividades manuais e marcos automáticos (◆) derivados de vigências, entregas, revisões de risco, prazos de checklist e solicitações."
        acoes={perfil !== 'COMANDANTE' && <Botao icone={<Plus className="size-4" />} onClick={() => setCriar({})}>Novo evento</Botao>}
      />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Selo tom="info">Evento manual</Selo>
        <Selo tom="perigo">◆ Vigência</Selo>
        <Selo tom="atencao">◆ Entrega</Selo>
        <Selo tom="neutro">◆ Outros marcos</Selo>
      </div>
      <Cartao>
        <FullCalendar
          ref={cal}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={ptBr}
          timeZone="local"
          initialView={window.innerWidth < 640 ? 'listMonth' : 'dayGridMonth'}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listMonth' }}
          buttonText={{ today: 'Hoje', month: 'Mês', week: 'Semana', list: 'Agenda' }}
          events={carregar}
          eventClick={clicar}
          dateClick={(a: DateClickArg) => perfil !== 'COMANDANTE' && setCriar({ data: a.dateStr.slice(0, 10) })}
          height="auto"
          dayMaxEvents={3}
          eventDisplay="block"
          noEventsText="Sem eventos no período"
        />
      </Cartao>
      <FormularioModal
        aberto={!!criar}
        aoFechar={() => setCriar(null)}
        titulo="Novo evento"
        largo
        campos={campos}
        valoresIniciais={{ diaInteiro: !!criar?.data, inicioData: criar?.data ?? '', tipo: 'REUNIAO', prioridade: 'MEDIA', recorrencia: 'NENHUMA', lembrete: '1' }}
        aoEnviar={async (v) => {
          await api.post('/calendario/eventos', paraApi(v));
          atualizarCal();
        }}
      />
      <FormularioModal
        aberto={!!editar}
        aoFechar={() => setEditar(null)}
        titulo="Editar evento"
        largo
        campos={[...campos, { nome: 'concluido', rotulo: 'Concluído', tipo: 'checkbox' }]}
        valoresIniciais={
          editar
            ? {
                ...Object.fromEntries(Object.entries(editar).map(([k, v]) => [k, v === null ? '' : v])),
                inicioData: String(editar.inicio ?? '').slice(0, 10),
                inicioHora: local(editar.inicio),
                fimHora: local(editar.fim),
                lembrete: String((editar.lembreteDias as number[])?.[0] ?? ''),
              }
            : undefined
        }
        aviso={
          <div className="flex justify-end">
            <Botao pequeno variante="perigo" onClick={() => setRemover(String(editar?.id))}>
              Excluir evento
            </Botao>
          </div>
        }
        aoEnviar={async (v) => {
          await api.patch(`/calendario/eventos/${editar!.id}`, { ...paraApi(v), concluido: !!v.concluido });
          atualizarCal();
        }}
      />
      <Confirmacao
        aberto={!!remover}
        aoFechar={() => setRemover(null)}
        titulo="Excluir evento"
        texto="O evento manual será removido (a ação é registrada na auditoria)."
        perigo
        rotuloConfirmar="Excluir"
        aoConfirmar={async () => {
          try {
            await api.delete(`/calendario/eventos/${remover}`);
            setRemover(null);
            setEditar(null);
            atualizarCal();
          } catch (e) {
            toast.erro(e);
          }
        }}
      />
    </>
  );
}
