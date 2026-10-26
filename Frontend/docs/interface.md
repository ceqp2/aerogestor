# Guia de interface

## Identidade
- Nome provisório **AEROGEST GSD** — “Gestão de Aquisições e Contratos”; texto institucional “Grupo de Segurança e Defesa de São José dos Campos”. Nome da seção configurável em Administração.
- Paleta **proposta** (sem alegação de padrão oficial FAB): branco `#FFFFFF`, fundo `#F5F9FD`, azul claro `#D9ECFA` (somente fundos), azul de ação `#246A9E`, azul-escuro de texto `#163A59`, borda `#DFE8F0`; status verde `#16794A`, âmbar `#925C00`, vermelho `#B42318` — sempre acompanhados de texto e ícone.
- Ícone próprio simples (`public/icone.svg`); nenhum brasão ou emblema oficial é usado.
- Fonte do sistema (Segoe UI/Roboto): sem dependência externa de fontes.

## Navegação por perfil
| Perfil | Menu |
|---|---|
| Comandante | Painel executivo e leitura de todos os módulos da unidade |
| Admin / Chefe / Auxiliar | Todos os módulos; ações conforme matriz de permissões |
| Gestor/fiscal | Visão geral (carteira), Processos (relacionados/tarefas), Contratos e execução, Riscos, Calendário, Documentos, Solicitações |
O menu apenas organiza a navegação; a autorização real é sempre feita pela API.

## Padrões
- Cartões de indicadores clicáveis abrem a lista que compõe o número (ex.: `/processos?indicador=atrasados`); a definição de cada indicador aparece no cartão.
- Alertas exibem o botão “Por que este alerta?” com regra e dados que o acionaram.
- Detalhes com abas preservadas na URL (`?aba=`): processo (resumo, etapas/checklist, itens, financeiro, riscos, documentos, histórico); contrato (resumo, designações, execução e entregas, notas e financeiro, solicitações, documentos, histórico).
- Formulários: validação no cliente (Zod) + servidor; em erro, os dados digitados são preservados e a mensagem do servidor é exibida no próprio diálogo.
- Ações relevantes (cancelar, retornar etapa, reabrir item, desativar usuário, correções) pedem confirmação e motivo, registrado na auditoria.
- Estados vazio, carregando (skeleton), erro (com código de correlação e “tentar novamente”) e sucesso (toast).

## Acessibilidade e responsividade
- Navegação por teclado, link “Pular para o conteúdo”, foco visível (contorno de 3 px), diálogos com foco preso e Esc, `aria-*` em abas, menus e campos (rótulos, descrições e erros associados).
- Contraste AA: azul claro nunca é usado como cor de texto; status não depende só de cor.
- Alvos de toque ≥ 44 px; layout validado em 360 px (sem rolagem horizontal), tablet e desktop. Em telas estreitas, tabelas viram cartões e o calendário abre em modo agenda.
- `prefers-reduced-motion` respeitado.
- Idioma pt-BR, moeda BRL e datas brasileiras; datas civis exibidas sem conversão de fuso; instantes em America/Sao_Paulo.

## Segurança no cliente
- Nenhum token em localStorage (sessão em cookie HttpOnly). O localStorage guarda apenas preferências (exercício selecionado, menu recolhido).
- Downloads feitos pela API autenticada (cada download é autorizado e auditado).
- Em produção, CSP restritiva servida pelo Nginx.
