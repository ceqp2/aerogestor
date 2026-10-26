# Permissões

Verificadas **no servidor em toda requisição** (inclusive downloads): `AuthGuard` (sessão, CSRF, unidade, perfil da rota) + `EscopoService` (autorização por objeto). Registros fora do escopo retornam **404** (não revelam existência).

| Ação | Comandante | Admin | Chefe | Auxiliar | Gestor/fiscal |
|---|---|---|---|---|---|
| Dashboard e relatórios gerenciais | Ler | Total | Ler | Ler | Apenas carteira própria (sem relatórios) |
| Processos, atas, financeiro, documentos | Ler | Total auditado | Criar/editar | Criar/editar | Processos dos seus contratos ou com tarefa atribuída; documentos liberados dos seus contratos |
| Checklist | Ler | Administrar modelos | Executar/revisar N/A, devolver | Executar | Somente tarefas expressamente atribuídas (andamento/conclusão) |
| Criar conta de gestor | — | Sim | Sim | Sim (apenas gestor) | — |
| Criar/desativar auxiliares | — | Sim | Sim | — | — |
| Criar comandante, chefe, admin | — | Sim | — | — | — |
| Alterar perfil | — | Sim | Auxiliar↔Gestor | — | — |
| Indicar designação | — | Sim | Sim | Sim | — |
| Registrar documento de designação / encerrar | — | Sim | Sim | — | — |
| Registrar execução, entregas, medições, notas | Ler | Sim | Sim | Sim | Contratos atribuídos |
| Atesto / recebimento formal | — | Somente com designação ATIVA competente (qualquer perfil) | ← | ← | ← |
| Liquidação/pagamento gerencial | Ler | Sim (com documento) | Sim (com documento) | Sim (com documento) | — |
| Inscrição em RAP | — | Sim | Sim | — | — |
| Aditivos, situação do contrato, vigência/autorização de ata | — | Sim | Sim | — | — |
| Correção administrativa (valor/vigência/número) | — | Sim, com motivo | — | — | — |
| Solicitações | Ler | Tratar | Tratar | Tratar | Abrir/cancelar as próprias |
| Parâmetros | — | Todos (globais e da unidade) | Operacionais da unidade (`lembretes.*`, `alertas.*`) | — | — |
| Auditoria | Ler | Ler | Ler | — | Histórico dos seus contratos |
| Alterar/apagar auditoria | Não | Não (bloqueado também no banco) | Não | Não | Não |

Regras adicionais:
- Ninguém altera o próprio perfil nem concede perfil que não poderia criar.
- Usuário com histórico é **desativado**, nunca apagado; desativação revoga sessões e convites, preservando designações e histórico.
- Suporte entre unidades: concessão explícita do administrador da unidade de destino, com motivo e prazo (máx. 168 h), revogável e auditada.
- Comandante: leitura gerencial; aprovação formal somente mediante competência/delegação a ser cadastrada (pendente de definição institucional).
- Com `MFA_ENFORCE_PRIVILEGED=true` (padrão em produção), Admin/Chefe/Comandante só operam após ativar MFA.
