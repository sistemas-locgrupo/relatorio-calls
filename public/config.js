/* =====================================================================
   CONFIGURAÇÃO DO SUPER RELATÓRIO DE CALLS
   Edite aqui como os status da planilha viram grupos na base unificada
   (status_reuniao_grupo e resultado_grupo). Remarcada = remarcacoes > 0.
   Os valores são comparados sem diferença de maiúsculas/espaços.
   Valores encontrados na planilha em 12/11/2026:
     status_reuniao: agendada, realizada, no_show, cancelada
     status_ghl:     confirmed, showed, noshow, cancelled
     resultado:      aberto, ganho, perdido, no_show, abandonado
   ===================================================================== */
window.SR_CONFIG = {
  /* Grupo da reunião. A primeira regra que bater vence, nesta ordem:
     cancelada → realizada → no_show. */
  reuniao: {
    cancelada: { status_reuniao: ['cancelada', 'cancelado'], status_ghl: ['cancelled', 'canceled'] },
    realizada: { status_reuniao: ['realizada'], status_ghl: ['showed'] },
    no_show:   { status_reuniao: ['no_show', 'noshow', 'no-show'], status_ghl: ['noshow', 'no_show'] }
  },

  /* Reunião que já passou e ainda está "agendada" na planilha, mas o negócio
     já avançou: conta como Realizada se a etapa da oportunidade estiver aqui... */
  realizadaPorEtapa: ['Reunião Realizada', 'Proposta enviada'],
  /* ...ou se o resultado da oportunidade estiver aqui. */
  realizadaPorResultado: ['ganho'],
  /* Conta como No-show se o resultado da oportunidade estiver aqui. */
  noShowPorResultado: ['no_show'],

  /* O que sobrar vira "Agendada" (inclui reuniões que já passaram
     e ainda não tiveram o status atualizado no CRM). */

  /* Gravação da reunião: só conta como entregue o link de um arquivo ou pasta
     nestes domínios. Link do Meet, de outros sites ou da página inicial do Drive
     fica como pendência. */
  gravacao: {
    dominiosValidos: ['drive.google.com'],
    exigirArquivoOuPasta: true
  },

  /* Grupo do resultado da oportunidade. */
  resultado: {
    ganho:   ['ganho', 'won'],
    perdido: ['perdido', 'lost', 'no_show', 'abandonado', 'abandoned'],
    aberto:  ['aberto', 'open']
  },

  /* Nomes que não contam como closer em nenhum relatório (gestores, testes).
     Call sem link cujo lead/oportunidade está com eles conta em "Sem closer". */
  closersIgnorados: ['Arthur Parentoni', 'Bruno Vieira'],

  /* Rótulos que aparecem na tela e nos arquivos. */
  rotulos: {
    agendada: 'Agendada',
    realizada: 'Realizada',
    no_show: 'No-show',
    cancelada: 'Cancelada',
    remarcada: 'Remarcada',
    ganho: 'Ganho',
    perdido: 'Perdido',
    aberto: 'Em aberto'
  },

  /* Cores de cada grupo nos gráficos (Design System LocAgora). */
  cores: {
    realizada: '#2103CE',
    agendada: 'rgba(0,150,255,.6)',
    no_show: '#E5484D',
    cancelada: '#B8BCC6'
  }
};
