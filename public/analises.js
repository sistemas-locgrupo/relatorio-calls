/* Análises do Super Relatório: central de alertas, qualidade do CRM, no-show, ciclo e velocidade, metas,
   tendência e retorno do Meta e custo por vendedor. Usa as peças que o blocks.js expõe em SR._int. */
(function () {
  const S = window.SR, X = S._int || {};
  const { E, semAcento, qualidade, DC_LEAD, DC_GRAV, DC_NOTA, DC_VENDA, DC_MOT, vendasEntre, negocios, tabelaRanking, hbars, HEAT, corNum, DS, segmento, metaPorGestor, carregarMeta, MAPA_CONTA, normNome, META_CANAL, DC_GL, DC_GC, DC_GV, so, C, baseGestores, NOMES_GEST, SEM_GEST } = X;

  /* =================== NOVAS ANÁLISES: alertas, qualidade do CRM, no-show, ciclo, metas e Meta =================== */
  const CFGX = window.SR_CONFIG || {};
  const sa = t => semAcento(S.limpa(t));
  const ETAPAS_FIM = ['desqualificado', 'negocio perdido', 'negocio vendido'];
  const horasEntre = (a, b) => { const d = S.difDias(a, b); return d == null ? null : d * 24; };
  const fHoras = h => h == null ? '—' : h < 1 ? Math.max(1, Math.round(h * 60)) + ' min' : h < 48 ? S.f1(h).replace(/,0$/, '') + ' h' : S.fDias(h / 24);
  const quantil = (xs, q) => { const v = xs.filter(x => x != null && isFinite(x) && x >= 0).sort((a, b) => a - b); if (!v.length) return null; return d3.quantileSorted(v, q); };
  /* caixa de KPIs clicáveis */
  function caixaKpis(cls) {
    const ks = E('div', 'sr-kpis ' + (cls || 'sr-saude'));
    const kpi = (rot, val, sub, abrir, alerta, dica) => {
      const b = E(abrir ? 'button' : 'div', 'sr-kpi' + (alerta ? ' alerta' : '')); if (abrir) { b.type = 'button'; b.addEventListener('click', abrir); }
      const l = E('span', 'l', rot); if (dica) l.title = dica;
      b.append(l, E('span', 'n', val), E('span', 'v', sub || '')); ks.appendChild(b); return b;
    };
    return { ks, kpi };
  }
  /* barras de taxa (no-show por faixa): rótulo | barra | taxa e base */
  function barrasTaxa(el, itens, o) {
    o = o || {};
    const ok = itens.filter(d => d.base > 0);
    if (!ok.length) { S.vazio(el, o.vazio || 'Sem dados no período.'); return; }
    const max = Math.max(o.max || 0, d3.max(ok, d => d.taxa || 0) || 0) || 1;
    el.replaceChildren(...itens.map(d => {
      const b = E('button', 'sr-hb sr-hbt'); b.type = 'button';
      const tr = E('span', 'tr'); const fl = E('i'); fl.style.width = (d.base ? 100 * (d.taxa || 0) / max : 0) + '%'; if (d.cor) fl.style.background = d.cor; tr.appendChild(fl);
      const nv = E('span', 'nv'); nv.append(E('b', '', d.base ? S.fP(d.taxa) : '—'), document.createTextNode(d.base ? ` · ${S.fInt(d.n)} de ${S.fInt(d.base)}` : ' · sem calls'));
      b.append(E('span', 'lb', d.label), tr, nv); b.title = d.label;
      if (d.abrir && d.base) b.addEventListener('click', d.abrir); else b.disabled = true;
      return b;
    }));
  }
  /* aba higiene (n8n): retrato atual dos problemas de preenchimento do CRM */
  const PROB_CRM = [
    { k: 'sem_dono', t: 'Lead sem proprietário', d: 'Leads que entraram e não têm dono no CRM' },
    { k: 'parado_7d', t: 'Oportunidade parada há 7+ dias', d: 'Oportunidades abertas sem movimentação há 7 dias ou mais' },
    { k: 'campo:fonte', t: 'Sem fonte', d: 'Oportunidades sem o campo fonte preenchido' },
    { k: 'campo:motivo_de_perda', t: 'Perda sem motivo', d: 'Oportunidades perdidas sem o motivo da perda' },
    { k: 'campo:valor_total_da_venda', t: 'Venda sem valor', d: 'Vendas sem o valor total preenchido' },
    { k: 'campo:data_da_venda', t: 'Venda sem data', d: 'Vendas sem a data da venda' },
    { k: 'campo:sdr_origem', t: 'Sem SDR de origem', d: 'Oportunidades sem o SDR de origem' }
  ];
  const DC_HIG = ['lead_nome', 'problema_crm', 'dono_atual_nome', 'dias_parado', 'data_verificacao'];
  let higCache = null;
  function higiene() {
    const H = dash.data('higiene');
    if (!H || H.status !== 'ok' || !Array.isArray(H.data)) return null;
    if (higCache && higCache.h === H.data) return higCache.v;
    const rotulo = new Map(PROB_CRM.map(p => [p.k, p.t]));
    const v = H.data.filter(r => r.registro_id || r.lead_id).map(r => {
      const k = S.norm(r.problema) === 'campo_vazio' ? 'campo:' + S.norm(r.campo_vazio) : S.norm(r.problema);
      const dias = Number(r.dias_parado);
      return { lead_id: r.lead_id || '', lead_nome: S.limpa(r.nome), dono_atual_nome: S.limpa(r.usuario_nome), tipo_registro: S.limpa(r.tipo_registro), _prob: k,
        problema_crm: rotulo.get(k) || (S.limpa(r.problema) + (r.campo_vazio ? ': ' + S.limpa(r.campo_vazio) : '')), _parado: isFinite(dias) && r.dias_parado !== '' ? dias : null, data_verificacao: r.data_verificacao || '' };
    });
    higCache = { h: H.data, v };
    return v;
  }

  /* =================== CENTRAL DE ALERTAS =================== */
  const DC_PAR = ['lead_nome', 'dono_atual_nome', 'sdr_responsavel_nome', 'etapa_atual', 'data_entrada', 'data_ultima_movimentacao', 'dias_parado', 'tag_campanha'];
  const DC_NOVO = ['lead_nome', 'sdr_responsavel_nome', 'dono_atual_nome', 'etapa_atual', 'data_entrada', 'horas_sem_contato', 'tag_campanha', 'fonte'];
  const DC_PASSOU = ['lead_nome', 'sdr_agendou_nome', 'closer_nome', 'data_reuniao', 'status', 'link_gravacao'];
  const respDe = l => S.limpa(l.dono_atual_nome) || S.limpa(l.sdr_responsavel_nome) || 'Sem responsável';
  function leadsParados(L, agora) {
    return L.filter(l => {
      if (S.norm(l.status_lead) !== 'aberto') return false;
      if (ETAPAS_FIM.includes(sa(l.etapa_atual))) return false;
      const d = S.difDias(l.data_ultima_movimentacao || l.data_entrada, agora); l._parado = d;
      return d != null && d >= 3;
    });
  }
  function alertas() {
    const F = S.full(), D = S.dados(); if (!F) return null;
    const agora = S.agora(), L = F.leads, Cs = F.calls, out = [];
    const add = (nivel, titulo, rows, desc, abrir) => out.push({ nivel, titulo, n: rows.length, rows, desc, abrir });
    const lista = (titulo, rows, kind, cols) => () => S.abrir({ titulo, rows, kind, cols });
    /* leads novos sem contato: ainda em "Lead Novo" (ou sem etapa) há mais de 24 h */
    const novos = L.filter(l => { const e = sa(l.etapa_atual); if (!(e === 'lead novo') || S.norm(l.status_lead) !== 'aberto') return false; const h = horasEntre(l.data_entrada, agora); l._hNovo = h; return h != null && h > 24; });
    add('alto', 'Leads novos sem contato há +24 h', novos, 'Ainda na etapa Lead Novo mais de um dia depois de entrar.', lista('Leads novos sem contato há mais de 24 h', novos, 'l', DC_NOVO));
    const par = leadsParados(L, agora);
    add(par.length > 20 ? 'alto' : 'medio', 'Leads parados há 3+ dias', par, 'Em aberto e sem movimentação no CRM há 3 dias ou mais.', lista('Leads parados há 3 dias ou mais', par, 'l', DC_PAR));
    const semSdr = L.filter(l => l._k.sdr === S.SEMK);
    add('medio', 'Leads sem SDR responsável', semSdr, 'Entraram no período e ninguém está com eles.', lista('Leads sem SDR responsável', semSdr, 'l', DC_LEAD));
    /* reunião que já passou (2 h de folga) e continua sem status */
    const limite = (() => { const d = new Date(Date.now() - 2 * 36e5), p = S.pad; return `${S.iso(d)} ${p(d.getHours())}:${p(d.getMinutes())}`; })();
    const passou = Cs.filter(r => r._g === 'agendada' && r.realizada_sem_link !== 'sim' && r.data_reuniao && r.data_reuniao < limite);
    add('alto', 'Reuniões que já passaram sem status', passou, 'A data da reunião passou e ela segue como agendada: falta marcar realizada (com link), no-show ou cancelada.', lista('Reuniões que já passaram sem status', passou, 'c', DC_PASSOU));
    const q = qualidade(Cs);
    add('alto', 'Gravações pendentes', q.pend, 'Realizadas no CRM sem link de gravação ou com link do Meet.', lista('Gravações pendentes', q.pend, 'c', DC_GRAV));
    add('medio', 'Realizadas sem nota do closer', q.semNota, 'O closer ainda não avaliou a qualidade do lead.', lista('Realizadas sem nota do closer', q.semNota, 'c', DC_NOTA));
    /* no-show acima da média do time (SDRs com 5+ calls concluídas) */
    const conc = r => r._g === 'realizada' || r._g === 'no_show';
    const geral = S.pct(Cs.filter(r => r._g === 'no_show').length, Cs.filter(conc).length);
    if (geral != null) {
      const altos = d3.groups(Cs.filter(r => r._k.sdr !== S.SEMK), r => r._k.sdr).map(([k, rows]) => { const c = rows.filter(conc), ns = rows.filter(r => r._g === 'no_show'); return { k, nome: S.rotulo('sdr', k), n: c.length, t: S.pct(ns.length, c.length), ns }; })
        .filter(x => x.n >= 5 && x.t != null && x.t >= geral + 0.1).sort((a, b) => b.t - a.t);
      const rows = altos.flatMap(x => x.ns);
      out.push({ nivel: 'medio', titulo: 'SDRs com no-show acima da média', n: altos.length, rows, desc: altos.length ? altos.slice(0, 4).map(x => `${x.nome} ${S.fP(x.t)}`).join(' · ') + ` (time: ${S.fP(geral)})` : `Ninguém 10 p.p. acima da média do time (${S.fP(geral)}).`, abrir: lista('No-shows dos SDRs acima da média', rows, 'c') });
    }
    const V = vendasEntre(F.a, F.b);
    if (V) add('medio', 'Vendas sem valor', V.semValor, 'Vendas do período sem o valor preenchido no CRM.', lista('Vendas sem valor', V.semValor, 'l', DC_VENDA));
    const N = negocios();
    if (N) { const f = S.filtros(); const sm = N.filter(o => o._fora && o._dc >= F.a && o._dc <= F.b && !o.motivo_unificado && S.passa(o, 'l', null, f)); add('baixo', 'Perdas sem motivo', sm, 'Oportunidades perdidas ou desqualificadas no período sem motivo no CRM.', lista('Perdas sem motivo', sm, 'l', DC_MOT)); }
    const Hg = higiene();
    if (Hg) { const p7 = Hg.filter(r => r._prob === 'parado_7d'); add('medio', 'Oportunidades paradas há 7+ dias', p7, 'Retrato de hoje do CRM (todas as datas), da conferência automática.', lista('Oportunidades paradas há 7 dias ou mais', p7, 'l', DC_HIG)); }
    const peso = { alto: 0, medio: 1, baixo: 2 };
    out.sort((a, b) => (!a.n) - (!b.n) || peso[a.nivel] - peso[b.nivel] || b.n - a.n);
    return out;
  }
  dash.draw('nav-alertas', el => {
    let a = null; try { a = alertas(); } catch (e) { a = null; }
    const n = a ? a.filter(x => x.n && x.nivel === 'alto').length : 0;
    el.textContent = n ? String(n) : ''; el.title = n ? `${n} alerta${n > 1 ? 's' : ''} importante${n > 1 ? 's' : ''}` : '';
  });
  S.st.alerta = S.st.alerta || { ord: { k: 'tot', dir: -1 } };
  dash.draw('alertas', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const A = alertas(), box = E('div', 'sr-nps');
    const ativos = A.filter(a => a.n), ok = A.filter(a => !a.n);
    const grid = E('div', 'sr-alertas');
    ativos.forEach(a => {
      const c = E('button', 'sr-alc n-' + a.nivel); c.type = 'button';
      const topo = E('span', 'at'); topo.append(E('span', 'tg', a.nivel === 'alto' ? 'Prioridade' : a.nivel === 'medio' ? 'Atenção' : 'Ajuste'), E('b', 'nn', S.fInt(a.n)));
      c.append(topo, E('span', 'tt', a.titulo), E('span', 'ds', a.desc), E('span', 'vl', 'Ver lista →'));
      c.addEventListener('click', a.abrir); grid.appendChild(c);
    });
    if (ativos.length) box.appendChild(grid); else box.appendChild(E('div', 'sr-empty', 'Nenhum alerta no período. Tudo em dia.'));
    if (ok.length) { const p = E('p', 'sr-hint sr-alok'); p.append(E('b', '', 'Em dia: '), document.createTextNode(ok.map(a => a.titulo).join(' · '))); box.appendChild(p); }
    /* fila de leads parados por responsável, por tempo parado */
    const par = leadsParados(F.leads, S.agora());
    const h = E('h3', 'sr-sub3', 'Fila de leads parados por responsável'); h.appendChild(E('span', 'sr-hint', ' · em aberto, sem movimentação há 3 dias ou mais, por tempo parado · clique no número para ver os leads')); box.appendChild(h);
    if (!par.length) box.appendChild(E('div', 'sr-empty', 'Nenhum lead parado no período.'));
    else {
      const FX = [['f1', '3 a 6 dias', 3, 7], ['f2', '7 a 14 dias', 7, 15], ['f3', '15 a 30 dias', 15, 31], ['f4', 'Mais de 30 dias', 31, Infinity]];
      const mk = rows => { const m = { calls: rows, tot: rows }; FX.forEach(([k, , a, b]) => { m[k] = rows.filter(l => l._parado >= a && l._parado < b); }); return m; };
      let grupos = d3.groups(par, respDe).map(([nome, rows]) => ({ key: nome === 'Sem responsável' ? S.SEMK : nome, nome, m: mk(rows) }));
      const totG = grupos.length, stA = S.st.alerta;
      if (!stA.todos && totG > 15) grupos = grupos.sort((a, b) => b.m.tot.length - a.m.tot.length).slice(0, 15);
      const cols = [{ k: 'tot', t: 'Total', v: m => m.tot.length, f: S.fInt, rows: m => m.tot, tit: 'Leads parados', kind: 'l', dcols: DC_PAR }]
        .concat(FX.map(([k, t]) => ({ k, t, v: m => m[k].length, f: S.fInt, rows: m => m[k], tit: 'Leads parados há ' + t.toLowerCase(), kind: 'l', dcols: DC_PAR })));
      const w = E('div', 'sr-motw'); const st = S.st.alerta;
      tabelaRanking(w, { dim: 'sdr', nomeCol: 'Responsável', grupos, cols, ord: st.ord, semMedalha: true, total: mk(par),
        aoOrdenar: (k, dir) => { st.ord = { k, dir }; dash.draw('alertas'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads parados', recorte: ['Responsável: ' + g.nome], rows: g.m.tot, kind: 'l', cols: DC_PAR }) }) });
      box.appendChild(w);
      if (totG > 15) { const mb = E('button', 'sr-link', stA.todos ? 'Mostrar só os 15 com mais leads parados' : `Mostrar todos os ${S.fInt(totG)} responsáveis`); mb.type = 'button'; mb.addEventListener('click', () => { stA.todos = !stA.todos; dash.draw('alertas'); }); box.appendChild(mb); }
    }
    box.appendChild(E('p', 'sr-hint', 'Os alertas seguem o período e os filtros escolhidos. "Oportunidades paradas há 7+ dias" vem da conferência automática do CRM e vale para todas as datas.'));
    el.replaceChildren(box);
  });

  /* =================== QUALIDADE DO CRM (aba higiene) =================== */
  S.st.hig = S.st.hig || { ord: { k: 'tot', dir: -1 } };
  dash.draw('higiene', el => {
    const D = S.dados(), H = dash.data('higiene');
    if (!D.ok) { S.vazio(el, S.estado(D)); return; }
    const Hg = higiene();
    if (!Hg) { S.vazio(el, H && H.status === 'error' ? 'Não foi possível ler a aba higiene da planilha.' : S.estado(H || D)); return; }
    const box = E('div', 'sr-nps');
    if (!Hg.length) { box.appendChild(E('div', 'sr-empty', 'Nenhum problema de preenchimento encontrado. CRM em dia.')); el.replaceChildren(box); return; }
    const ver = d3.max(Hg, r => r.data_verificacao) || '';
    const { ks, kpi } = caixaKpis('sr-saude sr-higk');
    const usados = PROB_CRM.filter(p => Hg.some(r => r._prob === p.k));
    const outros = Hg.filter(r => !PROB_CRM.some(p => p.k === r._prob));
    usados.forEach(p => { const rows = Hg.filter(r => r._prob === p.k); kpi(p.t, S.fInt(rows.length), p.d, () => S.abrir({ titulo: p.t, rows, kind: 'l', cols: DC_HIG }), rows.length > 0, p.d); });
    if (outros.length) kpi('Outros', S.fInt(outros.length), 'outros problemas apontados', () => S.abrir({ titulo: 'Outros problemas do CRM', rows: outros, kind: 'l', cols: DC_HIG }));
    box.appendChild(ks);
    const cols = [{ k: 'tot', t: 'Total', v: m => m.tot.length, f: S.fInt, rows: m => m.tot, tit: 'Problemas no CRM', kind: 'l', dcols: DC_HIG }]
      .concat(usados.map(p => ({ k: p.k, t: p.t, v: m => m[p.k].length, f: S.fInt, rows: m => m[p.k], tit: p.t, kind: 'l', dcols: DC_HIG })));
    const mk = rows => { const m = { calls: rows, tot: rows }; usados.forEach(p => { m[p.k] = rows.filter(r => r._prob === p.k); }); return m; };
    let grupos = d3.groups(Hg, r => r.dono_atual_nome || '').map(([nome, rows]) => ({ key: nome ? nome : S.SEMK, nome: nome || 'Sem responsável', m: mk(rows) }));
    const w = E('div', 'sr-motw'), st = S.st.hig, totG = grupos.length;
    if (!st.todos && totG > 15) grupos = grupos.sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.m.tot.length - a.m.tot.length).slice(0, 15).concat(grupos.filter(g => g.key === S.SEMK));
    tabelaRanking(w, { dim: 'sdr', nomeCol: 'Responsável', grupos, cols, ord: st.ord, semMedalha: true, total: mk(Hg),
      aoOrdenar: (k, dir) => { st.ord = { k, dir }; dash.draw('higiene'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Problemas no CRM', recorte: ['Responsável: ' + g.nome], rows: g.m.tot, kind: 'l', cols: DC_HIG }) }) });
    box.appendChild(w);
    if (totG > 15) { const mb = E('button', 'sr-link', st.todos ? 'Mostrar só os 15 com mais pendências' : `Mostrar todos os ${S.fInt(totG)} responsáveis`); mb.type = 'button'; mb.addEventListener('click', () => { st.todos = !st.todos; dash.draw('higiene'); }); box.appendChild(mb); }
    box.appendChild(E('p', 'sr-hint', `Retrato do CRM conferido em ${S.fDataHora(ver)} pela rotina automática (aba higiene). Não depende do período escolhido: mostra tudo o que está pendente hoje.`));
    el.replaceChildren(box);
  });

  /* =================== NO-SHOW =================== */
  const DC_NS = ['lead_nome', 'sdr_agendou_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'antecedencia', 'status', 'tag_campanha', 'utm_content'];
  const concl = r => r._g === 'realizada' || r._g === 'no_show';
  const mNs = rows => { const calls = S.umPorLead(rows), comp = rows.filter(concl), ns = rows.filter(r => r._g === 'no_show'); return { calls, comp, ns, rem: calls.filter(r => r._rem), t: S.pct(ns.length, comp.length) }; };
  const COLS_NS = [
    { k: 'calls', t: 'Agendadas', v: m => m.calls.length, f: S.fInt, rows: m => m.calls, tit: 'Calls agendadas', dcols: DC_NS },
    { k: 'comp', t: 'Concluídas', v: m => m.comp.length, f: S.fInt, rows: m => m.comp, tit: 'Realizadas + no-show', dcols: DC_NS },
    { k: 'ns', t: 'No-shows', v: m => m.ns.length, f: S.fInt, rows: m => m.ns, tit: 'No-shows', dcols: DC_NS },
    { k: 't', t: 'Taxa de no-show', v: m => m.comp.length >= 3 ? m.t : null, f: S.fP, rows: m => m.ns, tit: 'No-shows', dcols: DC_NS },
    { k: 'rem', t: 'Remarcadas', v: m => m.rem.length, f: S.fInt, rows: m => m.rem, tit: 'Calls remarcadas', dcols: DC_NS }
  ];
  const FAIXAS_ANT = [['No mesmo dia', 0, 1], ['1 dia antes', 1, 2], ['2 a 3 dias', 2, 4], ['4 a 7 dias', 4, 8], ['8 dias ou mais', 8, Infinity]];
  const FAIXAS_H = [['Manhã (até 12h)', 0, 12], ['Começo da tarde (12h–15h)', 12, 15], ['Fim da tarde (15h–18h)', 15, 18], ['Noite (18h em diante)', 18, 24]];
  S.st.ns = S.st.ns || { ordS: { k: 'ns', dir: -1 }, ordC: { k: 'ns', dir: -1 }, ordT: { k: 'ns', dir: -1 } };
  dash.draw('noshow', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const Cs = F.calls, st = S.st.ns, box = E('div', 'sr-nps');
    if (!Cs.length) { S.vazio(el, 'Nenhuma call no período.'); return; }
    Cs.forEach(r => { r._ant = r.dias_agendamento_ate_reuniao === '' || r.dias_agendamento_ate_reuniao == null ? null : Number(r.dias_agendamento_ate_reuniao); });
    const T = mNs(Cs);
    const { ks, kpi } = caixaKpis('sr-saude');
    kpi('Taxa de no-show', S.fP(T.t), `${S.fInt(T.ns.length)} de ${S.fInt(T.comp.length)} calls concluídas`, () => S.abrir({ titulo: 'No-shows', rows: T.ns, cols: DC_NS }), T.t != null && T.t >= .2, 'No-shows ÷ (realizadas + no-show)');
    const antNs = quantil(T.ns.map(r => r._ant), .5), antOk = quantil(T.comp.filter(r => r._g === 'realizada').map(r => r._ant), .5);
    kpi('Antecedência (no-show)', S.fDias(antNs), 'mediana entre agendar e a reunião', null, false, 'Metade dos no-shows foi agendada com até esse tempo de antecedência');
    kpi('Antecedência (compareceu)', S.fDias(antOk), 'mediana das calls realizadas', null, false, 'Metade das calls realizadas foi agendada com até esse tempo de antecedência');
    const volta = F.leads.filter(l => S.norm(l.tag_retorno).includes('noshow'));
    kpi('Voltaram para o SDR', S.fInt(volta.length), 'leads com a tag de retorno de no-show', () => S.abrir({ titulo: 'No-show que voltou para o SDR', rows: volta, kind: 'l', cols: DC_LEAD }));
    box.appendChild(ks);
    /* faixas: antecedência, dia da semana e horário */
    const g3 = E('div', 'sr-g3');
    const bloco = (tit, sub, itens) => { const d = E('div'); const h = E('h3', 'sr-sub3', tit); if (sub) h.appendChild(E('span', 'sr-hint', ' · ' + sub)); const c = E('div', 'sr-hbs'); barrasTaxa(c, itens); d.append(h, c); g3.appendChild(d); return itens; };
    const item = (label, rows) => { const m = mNs(rows); return { label, base: m.comp.length, n: m.ns.length, taxa: m.t, cor: 'var(--c-ns)', abrir: () => S.abrir({ titulo: 'No-shows', recorte: [label], rows: m.ns, cols: DC_NS }) }; };
    const itAnt = bloco('Por antecedência', 'tempo entre agendar e a reunião', FAIXAS_ANT.map(([t, a, b]) => item(t, Cs.filter(r => r._ant != null && r._ant >= a && r._ant < b))));
    const wdR = r => { const d = S.toDate(r.data_reuniao); return d ? d.getDay() : null; };
    bloco('Por dia da reunião', '', DS.map(([n, d]) => item(n.charAt(0).toUpperCase() + n.slice(1), Cs.filter(r => wdR(r) === d))));
    const hrR = r => /\d\d:\d\d/.test((r.data_reuniao || '').slice(11, 16)) ? Number(r.data_reuniao.slice(11, 13)) : null;
    bloco('Por horário da reunião', '', FAIXAS_H.map(([t, a, b]) => item(t, Cs.filter(r => { const h = hrR(r); return h != null && h >= a && h < b; }))));
    box.appendChild(g3);
    const okA = itAnt.filter(x => x.base >= 5);
    if (okA.length >= 2) {
      const pior = okA.slice().sort((a, b) => b.taxa - a.taxa)[0], melhor = okA.slice().sort((a, b) => a.taxa - b.taxa)[0];
      if (pior !== melhor && pior.taxa - melhor.taxa >= .05) box.appendChild(E('p', 'sr-note', `Calls agendadas ${pior.label.toLowerCase()} têm ${S.fP(pior.taxa)} de no-show, contra ${S.fP(melhor.taxa)} ${melhor.label === 'No mesmo dia' ? 'no mesmo dia' : 'com ' + melhor.label.toLowerCase()}. Vale reforçar a confirmação dessas reuniões.`));
    }
    /* tabelas por SDR, closer e campanha */
    const tab = (tit, dim, ordK, nomeCol, lim) => {
      const d = E('div'); d.appendChild(E('h3', 'sr-sub3', tit));
      let grupos = d3.groups(Cs, r => r._k[dim]).map(([k, rows]) => ({ key: k, nome: S.rotulo(dim, k), m: mNs(rows) })).filter(g => g.m.comp.length);
      const totG = grupos.length, todos = (st.todos || {})[dim];
      if (lim && !todos && totG > lim) grupos = grupos.sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.m.comp.length - a.m.comp.length).slice(0, lim);
      const w = E('div', 'sr-motw');
      tabelaRanking(w, { dim, nomeCol, grupos, cols: COLS_NS, ord: st[ordK], semMedalha: true, total: T,
        aoOrdenar: (k, dir) => { st[ordK] = { k, dir }; dash.draw('noshow'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'No-shows', recorte: [nomeCol + ': ' + g.nome], rows: g.m.ns, cols: DC_NS }) }) });
      d.appendChild(w);
      if (lim && totG > lim) { const mb = E('button', 'sr-link', todos ? `Mostrar só as ${lim} com mais calls` : `Mostrar todas as ${S.fInt(totG)}`); mb.type = 'button'; mb.addEventListener('click', () => { st.todos = Object.assign({}, st.todos, { [dim]: !todos }); dash.draw('noshow'); }); d.appendChild(mb); }
      return d;
    };
    box.append(tab('Por SDR que agendou', 'sdr', 'ordS', 'SDR'), tab('Por closer', 'closer', 'ordC', 'Closer'), tab('Por tag de campanha', 'tag', 'ordT', 'Tag de campanha', 15));
    box.appendChild(E('p', 'sr-hint', 'Taxa de no-show = no-shows ÷ (realizadas + no-show). Calls ainda agendadas ou canceladas ficam de fora. Taxas com menos de 3 calls concluídas aparecem como —.'));
    el.replaceChildren(box);
  });

  /* =================== CICLO E VELOCIDADE =================== */
  const DC_VEL = ['lead_nome', 'sdr_responsavel_nome', 'data_entrada', 'primeiro_agendamento', 'horas_ate_agendar', 'tag_campanha', 'etapa_atual'];
  const FAIXAS_VEL = [['Até 1 h', 0, 1], ['1 a 4 h', 1, 4], ['4 a 24 h', 4, 24], ['1 a 2 dias', 24, 48], ['2 a 7 dias', 48, 168], ['Mais de 7 dias', 168, Infinity]];
  /* primeiro agendamento de cada lead (qualquer data) e as horas desde a entrada */
  function velocidade(L) {
    const D = S.dados();
    L.forEach(l => {
      const cs = (D.porLead.get(l.lead_id) || []).map(c => c.data_agendamento).filter(Boolean).sort();
      const p = cs.find(d => d >= (l.data_entrada || '')) || cs[0] || '';
      l.primeiro_agendamento = p;
      const h = p ? horasEntre(l.data_entrada, p) : null;
      l._hAg = h != null && h >= 0 ? h : null;
    });
    return L;
  }
  const mVel = rows => { const ag = rows.filter(l => l._hAg != null); return { calls: ag, leads: rows, ag, h24: ag.filter(l => l._hAg <= 24), h48: ag.filter(l => l._hAg <= 48), med: quantil(ag.map(l => l._hAg), .5) }; };
  const COLS_VEL = [
    { k: 'leads', t: 'Leads', v: m => m.leads.length, f: S.fInt, rows: m => m.leads, tit: 'Leads', kind: 'l', dcols: DC_VEL },
    { k: 'ag', t: 'Agendaram', v: m => m.ag.length, f: S.fInt, rows: m => m.ag, tit: 'Leads que agendaram call', kind: 'l', dcols: DC_VEL },
    { k: 'p24', t: 'Em até 24 h', v: m => S.pct(m.h24.length, m.leads.length), f: S.fP, rows: m => m.h24, tit: 'Agendaram em até 24 h', kind: 'l', dcols: DC_VEL },
    { k: 'p48', t: 'Em até 48 h', v: m => S.pct(m.h48.length, m.leads.length), f: S.fP, rows: m => m.h48, tit: 'Agendaram em até 48 h', kind: 'l', dcols: DC_VEL },
    { k: 'med', t: 'Tempo até agendar', v: m => m.med, f: fHoras, rows: m => m.ag, tit: 'Leads que agendaram call', kind: 'l', dcols: DC_VEL }
  ];
  const DC_CIC = ['lead_nome', 'closer_nome', 'sdr_origem_nome', 'data_entrada', 'data_fechamento', 'dias_ate_venda', 'valor', 'tag_principal'];
  S.st.cic = S.st.cic || { ordV: { k: 'leads', dir: -1 }, ordC: { k: 'vendas', dir: -1 } };
  const semanaDe = s => { const d = S.toDate(s); if (!d) return ''; const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return S.iso(d); };
  dash.draw('ciclo', el => {
    const F = S.full(), D = S.dados(), N = negocios();
    if (!F || !N) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const st = S.st.cic, box = E('div', 'sr-nps'), f = S.filtros();
    /* --- velocidade do SDR (speed-to-lead) --- */
    const L = velocidade(F.leads.slice()), T = mVel(L);
    const sec = (t, sub) => { const h = E('h3', 'sr-sub3', t); if (sub) h.appendChild(E('span', 'sr-hint', ' · ' + sub)); box.appendChild(h); };
    sec('Velocidade do SDR', 'tempo entre a entrada do lead e o primeiro agendamento de call');
    const { ks, kpi } = caixaKpis('sr-saude');
    kpi('Tempo até agendar', fHoras(T.med), 'mediana dos leads que agendaram', () => S.abrir({ titulo: 'Leads que agendaram call', rows: T.ag, kind: 'l', cols: DC_VEL }), false, 'Metade dos leads que agendaram foi agendada em até esse tempo');
    kpi('Agendados em até 24 h', S.fP(S.pct(T.h24.length, L.length)), `${S.fInt(T.h24.length)} de ${S.fInt(L.length)} leads do período`, () => S.abrir({ titulo: 'Agendaram em até 24 h', rows: T.h24, kind: 'l', cols: DC_VEL }));
    kpi('Agendados em até 48 h', S.fP(S.pct(T.h48.length, L.length)), `${S.fInt(T.h48.length)} leads`, () => S.abrir({ titulo: 'Agendaram em até 48 h', rows: T.h48, kind: 'l', cols: DC_VEL }));
    const sem = L.filter(l => l._hAg == null);
    kpi('Ainda sem call', S.fInt(sem.length), S.fP(S.pct(sem.length, L.length)) + ' dos leads do período', () => S.abrir({ titulo: 'Leads ainda sem call', rows: sem, kind: 'l', cols: DC_VEL }), false);
    box.appendChild(ks);
    const g2 = E('div', 'sr-g2'), dv = E('div'), dt = E('div');
    dv.appendChild(E('h3', 'sr-sub3', 'Em quanto tempo os leads agendam'));
    const hb = E('div', 'sr-hbs'); hbars(hb, FAIXAS_VEL.map(([t, a, b]) => { const rows = T.ag.filter(l => l._hAg >= a && l._hAg < b); return { label: t, n: rows.length, abrir: () => S.abrir({ titulo: 'Agendaram ' + t.toLowerCase() + ' depois de entrar', rows, kind: 'l', cols: DC_VEL }) }; }).filter(x => x.n), 'Nenhum lead do período agendou call.');
    dv.appendChild(hb);
    dt.appendChild(E('h3', 'sr-sub3', 'Por SDR responsável'));
    const grupos = d3.groups(L, l => l._k.sdr).map(([k, rows]) => ({ key: k, nome: S.rotulo('sdr', k), m: mVel(rows) }));
    const wv = E('div', 'sr-motw');
    tabelaRanking(wv, { dim: 'sdr', nomeCol: 'SDR', grupos, cols: COLS_VEL, ord: st.ordV, semMedalha: true, total: T,
      aoOrdenar: (k, dir) => { st.ordV = { k, dir }; dash.draw('ciclo'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads', recorte: ['SDR: ' + g.nome], rows: g.m.leads, kind: 'l', cols: DC_VEL }) }) });
    dt.appendChild(wv); g2.className = 'sr-gvel'; g2.append(dt, dv); box.appendChild(g2);
    box.appendChild(E('p', 'sr-hint', 'O CRM não registra a hora do primeiro contato, só o agendamento. Por isso a velocidade é medida até o primeiro agendamento de call.'));

    /* --- coortes semanais --- */
    const q = S.per();
    let ini = semanaDe(q.ini); const fimS = semanaDe(q.fim);
    if (S.difDias(ini, fimS) < 7 * 5) ini = S.addDias(fimS, -7 * 7);
    const vendaPorLead = new Map(); N.filter(o => o._venda).forEach(o => { const a = vendaPorLead.get(o.lead_id); if (!a || (o._df || '') < (a._df || '')) vendaPorLead.set(o.lead_id, o); });
    const LC = velocidade(D.leads.filter(l => l._ld >= ini && l._ld <= S.addDias(fimS, 6) && S.passa(l, 'l', null, f)));
    const semanas = d3.groups(LC, l => semanaDe(l.data_entrada)).filter(([s]) => s).sort((a, b) => b[0].localeCompare(a[0]));
    sec('Coortes semanais', 'leads agrupados pela semana em que entraram e o que aconteceu com eles até hoje');
    if (!semanas.length) box.appendChild(E('div', 'sr-empty', 'Sem leads nas semanas do período.'));
    else {
      const tw = E('div', 'sr-tw'), tbl = E('table', 'sr-t sr-coorte'), th = E('thead'), trh = E('tr');
      const CC = [['Leads', null], ['Agendaram na 1ª semana', 'p'], ['Agendaram até hoje', 'p'], ['Call realizada', 'p'], ['Vendas', 'p'], ['Valor vendido', null]];
      trh.appendChild(E('th', 'nome', 'Semana de entrada')); CC.forEach(([t]) => trh.appendChild(E('th', 'n', t))); th.appendChild(trh); tbl.appendChild(th);
      const tb = E('tbody');
      const cel = (tr, txt, rows, tit, taxa) => {
        const td = E('td', 'n');
        if (taxa != null) { td.style.background = HEAT(Math.min(1, taxa * 1.6)); td.style.color = corNum(Math.min(1, taxa * 1.6)); }
        if (rows && rows.length) { const b = E('button', 'sr-cell', txt); b.type = 'button'; b.addEventListener('click', () => S.abrir({ titulo: tit, rows, kind: 'l', cols: DC_VEL.concat(['status', 'resultado']) })); td.appendChild(b); } else td.appendChild(E('span', '', txt));
        tr.appendChild(td);
      };
      semanas.forEach(([s, rows]) => {
        const tr = E('tr'), fimW = S.addDias(s, 6);
        const ag = rows.filter(l => l._hAg != null), ag7 = ag.filter(l => l._hAg <= 168);
        const re = rows.filter(l => (D.porLead.get(l.lead_id) || []).some(c => c._g === 'realizada'));
        const vd = rows.filter(l => vendaPorLead.has(l.lead_id)), valor = d3.sum(vd, l => vendaPorLead.get(l.lead_id).valor || 0);
        const atual = fimW >= S.hoje();
        const tn = E('td', 'nome'); tn.append(E('span', '', `${S.fDM(s)} a ${S.fDM(fimW)}`)); if (atual) tn.appendChild(E('span', 'sr-mae', 'semana em andamento')); tr.appendChild(tn);
        cel(tr, S.fInt(rows.length), rows, `Leads da semana ${S.fDM(s)}`);
        const tx = (sub) => S.pct(sub.length, rows.length);
        cel(tr, S.fP(tx(ag7)), ag7, `Agendaram na 1ª semana · semana ${S.fDM(s)}`, tx(ag7));
        cel(tr, S.fP(tx(ag)), ag, `Agendaram call · semana ${S.fDM(s)}`, tx(ag));
        cel(tr, S.fP(tx(re)), re, `Tiveram call realizada · semana ${S.fDM(s)}`, tx(re));
        cel(tr, vd.length ? `${S.fInt(vd.length)} · ${S.fP(tx(vd))}` : '0', vd, `Viraram venda · semana ${S.fDM(s)}`, tx(vd) && tx(vd) * 8);
        cel(tr, valor ? S.fBRL(valor) : '—', null);
        tb.appendChild(tr);
      });
      tbl.appendChild(tb); tw.appendChild(tbl); box.appendChild(tw);
      box.appendChild(E('p', 'sr-hint', 'Cada linha acompanha os leads de uma semana até hoje: semanas recentes ainda estão amadurecendo. Quando o período tem menos de 5 semanas, a tabela mostra as últimas 8 semanas até o fim do período.'));
    }

    /* --- ciclo de venda --- */
    sec('Ciclo de venda', 'vendas fechadas no período (aba negócios), da entrada do lead até o fechamento');
    const V = vendasEntre(F.a, F.b), porLeadL = new Map(D.leads.map(l => [l.lead_id, l]));
    const vend = (V ? V.vendas : []).map(o => {
      const l = porLeadL.get(o.lead_id) || {}, cs = (D.porLead.get(o.lead_id) || []);
      const re = cs.filter(c => c._g === 'realizada').map(c => c.data_reuniao || c.data_agendamento).filter(Boolean).sort();
      const ag = cs.map(c => c.data_agendamento).filter(Boolean).sort();
      const ent = o.data_entrada || l.data_entrada || '';
      const dv = S.difDias(ent, o.data_fechamento), dr = re.length ? S.difDias(re[re.length - 1], o.data_fechamento) : null, da = ag.length ? S.difDias(ent, ag[0]) : null;
      return Object.assign(o, { _dVenda: dv != null && dv >= 0 ? dv : null, _dReuVenda: dr != null && dr >= 0 ? dr : null, _dAg: da != null && da >= 0 ? da : null, dias_ate_venda: dv != null && dv >= 0 ? Math.round(dv * 10) / 10 : '' });
    });
    if (!vend.length) box.appendChild(E('div', 'sr-empty', 'Nenhuma venda fechada no período.'));
    else {
      const k2 = caixaKpis('sr-saude');
      const med = (xs) => quantil(xs, .5), p75 = xs => quantil(xs, .75);
      const xV = vend.map(o => o._dVenda), xR = vend.map(o => o._dReuVenda), xA = vend.map(o => o._dAg);
      k2.kpi('Entrada → venda', S.fDias(med(xV)), `mediana · 3 em cada 4 em até ${S.fDias(p75(xV))}`, () => S.abrir({ titulo: 'Vendas do período', rows: vend, kind: 'l', cols: DC_CIC }));
      k2.kpi('Entrada → 1º agendamento', fHoras(med(xA) == null ? null : med(xA) * 24), 'mediana dos leads que viraram venda', null);
      k2.kpi('Reunião → fechamento', S.fDias(med(xR)), `mediana · 3 em cada 4 em até ${S.fDias(p75(xR))}`, null);
      const tk = V.comValor.length ? V.valor / V.comValor.length : null;
      k2.kpi('Ticket médio', tk == null ? '—' : S.fBRL(tk), `${S.fInt(V.comValor.length)} vendas com valor`, () => S.abrir({ titulo: 'Vendas com valor', rows: V.comValor, kind: 'l', cols: DC_CIC }));
      box.appendChild(k2.ks);
      const gruposC = d3.groups(vend, o => o._k.closer).map(([k, rows]) => ({ key: k, nome: k === S.SEMK ? 'Sem closer' : S.limpa(rows[0].closer_nome), m: { calls: rows, vendas: rows, comValor: rows.filter(o => o.valor > 0), valor: d3.sum(rows, o => o.valor), dv: med(rows.map(o => o._dVenda)), dr: med(rows.map(o => o._dReuVenda)) } }));
      const totC = { calls: vend, vendas: vend, comValor: V.comValor, valor: V.valor, dv: med(xV), dr: med(xR) };
      const COLS_CIC = [
        { k: 'vendas', t: 'Vendas', v: m => m.vendas.length, f: S.fInt, rows: m => m.vendas, tit: 'Vendas', kind: 'l', dcols: DC_CIC },
        { k: 'valor', t: 'Valor', v: m => m.valor, f: v => v ? S.fBRL(v) : '—', rows: m => m.comValor, tit: 'Vendas com valor', kind: 'l', dcols: DC_CIC },
        { k: 'tk', t: 'Ticket médio', v: m => m.comValor.length ? m.valor / m.comValor.length : null, f: v => v == null ? '—' : S.fBRL(v) },
        { k: 'dr', t: 'Reunião → fechamento', v: m => m.dr, f: S.fDias },
        { k: 'dv', t: 'Entrada → venda', v: m => m.dv, f: S.fDias }
      ];
      const wc = E('div', 'sr-motw');
      tabelaRanking(wc, { dim: 'closer', nomeCol: 'Closer', grupos: gruposC, cols: COLS_CIC, ord: st.ordC, semMedalha: true, total: totC,
        aoOrdenar: (k, dir) => { st.ordC = { k, dir }; dash.draw('ciclo'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Vendas', recorte: ['Closer: ' + g.nome], rows: g.m.vendas, kind: 'l', cols: DC_CIC }) }) });
      box.appendChild(wc);
    }
    el.replaceChildren(box);
  });

  /* =================== METAS DO MÊS =================== */
  const MET_SDR = [['agendadas', 'Agendadas'], ['realizadas', 'Realizadas']];
  const MET_CLO = [['realizadas', 'Realizadas'], ['vendas', 'Vendas'], ['valor', 'Valor vendido']];
  const MET_TIME = [['leads', 'Leads'], ['agendadas', 'Agendadas'], ['realizadas', 'Realizadas'], ['vendas', 'Vendas'], ['valor', 'Valor vendido']];
  function diasUteis(a, b) { const ok = (CFGX.metas || {}).diasUteis || [1, 2, 3, 4, 5]; let n = 0; for (let d = a; d <= b; d = S.addDias(d, 1)) if (ok.includes(S.parse(d).getDay())) n++; return n; }
  function metaDe(papel, nome, k) {
    const M = (CFGX.metas || {})[papel] || {};
    if (papel === 'time') { const v = M[k]; return v > 0 ? Number(v) : null; }
    const norm = s => semAcento(S.limpa(s));
    const pessoa = Object.keys(M).find(x => x !== 'padrao' && norm(x) === norm(nome));
    const v = ((pessoa && M[pessoa]) || {})[k] != null ? M[pessoa][k] : (M.padrao || {})[k];
    return v > 0 ? Number(v) : null;
  }
  dash.draw('metas', el => {
    const D = S.dados(), N = negocios();
    if (!D.ok || !N) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const q = S.per(), ref = S.parse(q.fim), mIni = S.iso(new Date(ref.getFullYear(), ref.getMonth(), 1)), mFim = S.iso(new Date(ref.getFullYear(), ref.getMonth() + 1, 0));
    const hoje = S.hoje(), ate = hoje < mFim ? (hoje < mIni ? mIni : hoje) : mFim;
    const w = S.janela(mIni, ate), V = vendasEntre(mIni, ate) || { vendas: [], comValor: [], valor: 0 };
    const duTot = diasUteis(mIni, mFim), duPass = Math.max(1, diasUteis(mIni, ate)), fator = ate >= mFim ? 1 : duTot / duPass;
    const box = E('div', 'sr-nps');
    const temMeta = !!CFGX.metas && ['sdr', 'closer', 'time'].some(p => { const o = CFGX.metas[p] || {}; return JSON.stringify(o).match(/:\s*[1-9]/); });
    box.appendChild(E('p', 'sr-hint', `Mês de ${S.MESL[ref.getMonth()]} de ${ref.getFullYear()} · ${S.fInt(duPass)} de ${S.fInt(duTot)} dias úteis${ate >= mFim ? ' (mês fechado)' : ''} · projeção = ritmo de hoje até o fim do mês`));
    if (!temMeta) box.appendChild(cardMetaX('Nenhuma meta cadastrada ainda.', 'Por enquanto a página mostra o realizado e a projeção do mês. Para comparar com a meta, me passe os números (do time, por SDR e por closer) que eu cadastro.'));
    const calls = w.calls, real = calls.filter(r => r._g === 'realizada');
    const valTime = { leads: w.leads.length, agendadas: S.umPorLead(calls).length, realizadas: real.length, vendas: V.vendas.length, valor: V.valor };
    const rowsTime = { leads: [w.leads, 'l'], agendadas: [S.umPorLead(calls), 'c'], realizadas: [real, 'c'], vendas: [V.vendas, 'l', DC_VENDA], valor: [V.comValor, 'l', DC_VENDA] };
    const fmt = k => k === 'valor' ? (v => v ? S.fBRL(v) : '—') : S.fInt;
    /* cartões do time */
    const ks = E('div', 'sr-metas');
    MET_TIME.forEach(([k, t]) => {
      const v = valTime[k], meta = metaDe('time', '', k), proj = v * fator, c = E('button', 'sr-meta'); c.type = 'button';
      c.addEventListener('click', () => S.abrir({ titulo: t + ' do mês', rows: rowsTime[k][0], kind: rowsTime[k][1], cols: rowsTime[k][2], periodo: [mIni, ate] }));
      c.append(E('span', 'l', t), E('span', 'n', fmt(k)(v)));
      const bar = E('span', 'br'), fl = E('i'), pj = E('b'); const base = meta || proj || 1;
      fl.style.width = Math.min(100, 100 * v / base) + '%'; pj.style.left = Math.min(100, 100 * proj / Math.max(base, proj)) + '%'; if (meta) bar.appendChild(pj); bar.appendChild(fl); c.appendChild(bar);
      c.appendChild(E('span', 'v', meta ? `${S.fP(v / meta)} da meta de ${fmt(k)(meta)} · projeção ${fmt(k)(proj)}` : `projeção para o mês: ${fmt(k)(proj)}`));
      if (meta && proj < meta) c.classList.add('atras');
      ks.appendChild(c);
    });
    box.appendChild(ks);
    /* tabelas por pessoa */
    const pessoas = (papel, defs, grupos) => {
      const tw = E('div', 'sr-tw'), tbl = E('table', 'sr-t sr-tmeta'), th = E('thead'), tr = E('tr');
      tr.append(E('th', 'pos', '#'), E('th', 'nome', papel === 'sdr' ? 'SDR' : 'Closer')); defs.forEach(([, t]) => tr.appendChild(E('th', 'n', t))); th.appendChild(tr); tbl.appendChild(th);
      const tb = E('tbody');
      grupos.sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.v[defs[0][0]] - a.v[defs[0][0]]).forEach((g, i) => {
        const r = E('tr', g.key === S.SEMK ? 'sem' : ''); r.append(E('td', 'pos', g.key === S.SEMK ? '—' : String(i + 1)));
        const tn = E('td', 'nome'); tn.appendChild(E('span', '', g.nome)); r.appendChild(tn);
        defs.forEach(([k]) => {
          const v = g.v[k], meta = g.key === S.SEMK ? null : metaDe(papel, g.nome, k), proj = v * fator, td = E('td', 'n sr-mcel');
          const b = E('button', 'sr-cell', fmt(k)(v)); b.type = 'button'; b.addEventListener('click', () => S.abrir({ titulo: k, recorte: [(papel === 'sdr' ? 'SDR: ' : 'Closer: ') + g.nome], rows: g.rows[k][0], kind: g.rows[k][1], cols: g.rows[k][2], periodo: [mIni, ate] }));
          td.appendChild(b);
          const sub = E('small', meta && proj < meta ? 'atras' : '', meta ? `${S.fP(v / meta)} de ${fmt(k)(meta)} · proj. ${fmt(k)(proj)}` : `proj. ${fmt(k)(proj)}`); td.appendChild(sub);
          if (meta) { const br = E('span', 'br'), fl = E('i'); fl.style.width = Math.min(100, 100 * v / meta) + '%'; br.appendChild(fl); td.appendChild(br); }
          r.appendChild(td);
        });
        tb.appendChild(r);
      });
      tbl.appendChild(tb); tw.appendChild(tbl); return tw;
    };
    const gS = d3.groups(calls, r => r._k.sdr).map(([k, rows]) => { const ag = S.umPorLead(rows), re = rows.filter(r => r._g === 'realizada'); return { key: k, nome: S.rotulo('sdr', k), v: { agendadas: ag.length, realizadas: re.length }, rows: { agendadas: [ag, 'c'], realizadas: [re, 'c'] } }; });
    const vPorC = d3.group(V.vendas, o => o._k.closer);
    const keysC = new Set(calls.map(r => r._k.closer).concat([...vPorC.keys()]));
    const gC = [...keysC].map(k => { const rows = calls.filter(r => r._k.closer === k), re = rows.filter(r => r._g === 'realizada'), vd = vPorC.get(k) || [], cv = vd.filter(o => o.valor > 0);
      return { key: k, nome: k === S.SEMK ? 'Sem closer' : (rows[0] ? S.rotulo('closer', k) : S.limpa(vd[0].closer_nome)), v: { realizadas: re.length, vendas: vd.length, valor: d3.sum(cv, o => o.valor) }, rows: { realizadas: [re, 'c'], vendas: [vd, 'l', DC_VENDA], valor: [cv, 'l', DC_VENDA] } }; });
    const g2 = E('div', 'sr-g2'), a = E('div'), b = E('div');
    a.append(E('h3', 'sr-sub3', 'SDRs'), pessoas('sdr', MET_SDR, gS)); b.append(E('h3', 'sr-sub3', 'Closers'), pessoas('closer', MET_CLO, gC));
    g2.append(a, b); box.appendChild(g2);
    box.appendChild(E('p', 'sr-hint', 'As metas são do mês da data final do período e seguem os filtros escolhidos. Projeção = realizado ÷ dias úteis que já passaram × dias úteis do mês. Em laranja: abaixo do ritmo da meta.'));
    el.replaceChildren(box);
  });
  function cardMetaX(txt, sub) { const c = E('div', 'sr-metainfo'); c.append(E('b', '', txt)); if (sub) c.appendChild(E('span', '', sub)); return c; }

  /* =================== META: TENDÊNCIA DIÁRIA E RETORNO POR CAMPANHA (dentro do Gerenciador de anúncios) =================== */
  function extrasMeta(box, MG, B, st, sec) {
    const j = S.st.meta.dados, fG = st.sel ? (r => r.gestor === st.sel) : (() => true);
    const gestorConta = c => c.gestor || MAPA_CONTA.get(normNome(c.nome)) || '';
    const contasG = new Map((j.contas || []).map(c => [c.id, gestorConta(c)]));
    const LM = so(B.leads, r => fG(r) && r.canal_geral === META_CANAL);
    /* tendência diária */
    sec('Tendência diária' + (st.sel ? ' · ' + st.sel : ''), 'investimento do Meta por dia contra os leads do Meta e os leads de canal Meta que chegaram no CRM');
    const diario = (j.diario || []).filter(d => !st.sel || (contasG.get(d.conta) || '') === st.sel);
    if (!j.diario) box.appendChild(cardMetaX('A tendência diária aparece depois da próxima atualização dos dados do Meta.', 'Clique em "Atualizar agora" acima.'));
    else {
      const ds = S.dias().filter(d => d <= S.hoje()), porDia = d3.rollup(diario, v => ({ gasto: d3.sum(v, x => x.gasto), lm: d3.sum(v, x => x.leads_meta) }), d => d.dia), lc = d3.group(LM, r => r._ld);
      const data = ds.map(d => { const x = porDia.get(d) || { gasto: 0, lm: 0 }, l = lc.get(d) || []; return { dia: d, gasto: x.gasto, lm: x.lm, lc: l.length, rows: l }; });
      const host = E('div', 'sr-trend'); box.appendChild(host);
      const leg = E('div', 'sr-leg'); [['Investimento', 'var(--azul20)', 'q'], ['Leads Meta', 'var(--c-ag)', 'l'], ['Leads CRM (canal Meta)', 'var(--laranja)', 'l']].forEach(([t, c, tipo]) => { const s = E('span', 'it'); const i = E('i', tipo); i.style.background = c; s.append(i, document.createTextNode(t)); leg.appendChild(s); });
      box.appendChild(leg);
      requestAnimationFrame(() => {
        const W = Math.max(320, host.clientWidth || 900), Hh = 240, ml = 64, mr = 40, mt = 12, mb = 28;
        const x = d3.scaleBand().domain(data.map(d => d.dia)).range([ml, W - mr]).padding(.25);
        const yG = d3.scaleLinear().domain([0, (d3.max(data, d => d.gasto) || 1) * 1.1]).nice().range([Hh - mb, mt]);
        const yL = d3.scaleLinear().domain([0, (d3.max(data, d => Math.max(d.lm, d.lc)) || 1) * 1.1]).nice().range([Hh - mb, mt]);
        const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${Hh}`).attr('width', '100%').attr('height', Hh).attr('role', 'img').attr('aria-label', 'Investimento e leads por dia');
        svg.append('g').attr('class', 'ax').attr('transform', `translate(${ml},0)`).call(d3.axisLeft(yG).ticks(4).tickFormat(v => 'R$ ' + S.fInt(v)).tickSize(-(W - ml - mr))).call(g => g.select('.domain').remove());
        svg.append('g').attr('class', 'ax').attr('transform', `translate(${W - mr},0)`).call(d3.axisRight(yL).ticks(4).tickFormat(S.fInt)).call(g => g.select('.domain').remove()).call(g => g.selectAll('line').remove());
        const passo = Math.ceil(data.length / Math.max(1, Math.floor((W - ml - mr) / 56)));
        svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${Hh - mb})`).call(d3.axisBottom(x).tickValues(data.map(d => d.dia).filter((d, i) => i % passo === 0)).tickFormat(S.fDM).tickSize(0)).call(g => g.select('.domain').remove());
        svg.append('g').selectAll('rect').data(data).join('rect').attr('x', d => x(d.dia)).attr('width', x.bandwidth()).attr('y', d => yG(d.gasto)).attr('height', d => yG(0) - yG(d.gasto)).attr('rx', 3).style('fill', 'var(--azul20)');
        const ln = (k, cor, tr) => { svg.append('path').datum(data).attr('fill', 'none').attr('stroke', cor).attr('stroke-width', 2.2).attr('stroke-dasharray', tr || null).attr('d', d3.line().x(d => x(d.dia) + x.bandwidth() / 2).y(d => yL(d[k])));
          svg.append('g').selectAll('circle').data(data).join('circle').attr('cx', d => x(d.dia) + x.bandwidth() / 2).attr('cy', d => yL(d[k])).attr('r', 2.6).style('fill', cor); };
        ln('lm', 'var(--c-ag)', '5 4'); ln('lc', 'var(--laranja)');
        const tp = S.tip(host);
        svg.append('g').selectAll('rect').data(data).join('rect').attr('x', d => x(d.dia)).attr('width', x.step()).attr('transform', `translate(${-x.step() * x.padding() / 2},0)`).attr('y', mt).attr('height', Hh - mb - mt).style('fill', 'transparent').style('cursor', 'pointer')
          .on('pointermove', (ev, d) => tp.show(ev, S.fCurto(d.dia), [['Investimento', S.fBRL(d.gasto)], ['Leads Meta', S.fInt(d.lm)], ['Leads CRM', S.fInt(d.lc)], ['CPL Meta', d.lm ? S.fBRL(d.gasto / d.lm) : '—'], ['CPL CRM', d.lc ? S.fBRL(d.gasto / d.lc) : '—']]))
          .on('pointerleave', () => tp.hide())
          .on('click', (ev, d) => { if (d.rows.length) S.abrir({ titulo: 'Leads de canal Meta', recorte: [S.fData(d.dia)].concat(st.sel ? ['Gestor: ' + st.sel] : []), rows: d.rows, kind: 'l', cols: DC_GL, periodo: [d.dia, d.dia] }); });
        host.replaceChildren(svg.node());
      });
      /* resumo: primeira metade x segunda metade do período */
      const meio = Math.floor(data.length / 2), A1 = data.slice(0, meio), A2 = data.slice(meio).filter(d => d.dia <= S.hoje());
      const cpl = arr => { const g = d3.sum(arr, d => d.gasto), l = d3.sum(arr, d => d.lc); return l ? g / l : null; };
      const c1 = cpl(A1), c2 = cpl(A2);
      if (c1 && c2 && A1.length >= 3 && A2.length >= 3) { const v = (c2 - c1) / c1; box.appendChild(E('p', 'sr-note', `CPL CRM na segunda metade do período: ${S.fBRL(c2)} (${v >= 0 ? '▲' : '▼'} ${S.fP(Math.abs(v))} contra ${S.fBRL(c1)} na primeira metade).`)); }
    }
    /* retorno por campanha do Meta */
    sec('Retorno por campanha' + (st.sel ? ' · ' + st.sel : ''), 'campanhas do Meta com o que viraram no CRM: leads, calls, vendas, valor, CAC e retorno sobre o investimento');
    const ads = MG.ads.filter(a => !st.sel || a.gestor === st.sel);
    const porCamp = d3.group(ads, a => normNome(a.campanha));
    const adParaCamp = new Map(); d3.groups(ads, a => a._k).forEach(([k, v]) => { const g = d3.rollups(v, x => d3.sum(x, y => y.gasto), a => normNome(a.campanha)).sort((a, b) => b[1] - a[1]); if (g.length) adParaCamp.set(k, g[0][0]); });
    const campDe = r => { const u = normNome(r.utm_campaign); if (u && porCamp.has(u)) return u; return adParaCamp.get(normNome(r.utm_content)) || ''; };
    const CM = so(B.calls, r => fG(r) && r.canal_geral === META_CANAL), VM = so(B.vend, r => fG(r) && r.canal_geral === META_CANAL);
    const gL = d3.group(LM, campDe), gC = d3.group(CM, campDe), gV = d3.group(VM, campDe);
    const div = (a, b) => b > 0 && a > 0 ? a / b : null, fR = v => v == null ? '—' : S.fBRL(v);
    const mC = (adsC, leads, calls, vend) => { const m = S.M(calls, leads); m.gasto = d3.sum(adsC, a => a.gasto); m.leadsMeta = d3.sum(adsC, a => a.leads_meta); m.vend = vend; m.valorV = d3.sum(vend, o => o.valor); return m; };
    const grupos = [...porCamp.entries()].map(([k, adsC]) => ({ key: k, nome: adsC[0].campanha || '(sem nome)', mae: [...new Set(adsC.map(a => a.gestor))].join(' · '), m: mC(adsC, gL.get(k) || [], gC.get(k) || [], gV.get(k) || []) })).filter(g => g.m.gasto > 0 || g.m.leads.length);
    if (!grupos.length) box.appendChild(E('div', 'sr-empty', 'Nenhuma campanha com investimento no período.'));
    else {
      const COLS_ROI = [
        { k: 'gasto', t: 'Investimento', v: m => m.gasto, f: S.fBRL },
        Object.assign({}, C.leads, { t: 'Leads CRM', dcols: DC_GL }),
        { k: 'cpl', t: 'CPL CRM', v: m => div(m.gasto, m.leads.length), f: fR },
        Object.assign({}, C.calls, { t: 'Agendadas', dcols: DC_GC }),
        Object.assign({}, C.realizadas, { dcols: DC_GC }),
        { k: 'vend', t: 'Vendas', v: m => m.vend.length, f: S.fInt, rows: m => m.vend, tit: 'Vendas', kind: 'l', dcols: DC_GV },
        { k: 'valorV', t: 'Valor vendido', v: m => m.valorV, f: v => v ? S.fBRL(v) : '—', rows: m => m.vend.filter(o => o.valor > 0), tit: 'Vendas com valor', kind: 'l', dcols: DC_GV },
        { k: 'cac', t: 'CAC', v: m => div(m.gasto, m.vend.length), f: fR },
        { k: 'roas', t: 'ROAS', v: m => m.gasto > 0 && m.valorV > 0 ? m.valorV / m.gasto : null, f: v => v == null ? '—' : S.f1(v).replace(/,0$/, '') + 'x' }
      ];
      const tot = mC(ads, LM.filter(r => campDe(r)), CM.filter(r => campDe(r)), VM.filter(r => campDe(r)));
      const nCamp = grupos.length; let gs = grupos;
      if (!st.todasCamp && nCamp > 15) { const ok = (st.ordRoi || { k: 'gasto' }); gs = grupos.slice().sort((a, b) => b.m.gasto - a.m.gasto).slice(0, 15); }
      const w = E('div', 'sr-motw sr-roi');
      tabelaRanking(w, { dim: 'camp', nomeCol: 'Campanha do Meta', grupos: gs, cols: COLS_ROI, ord: st.ordRoi || (st.ordRoi = { k: 'gasto', dir: -1 }), semMedalha: true, total: tot,
        aoOrdenar: (k, dir) => { st.ordRoi = { k, dir }; dash.draw('anuncios'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads da campanha', recorte: [g.nome], rows: g.m.leads, kind: 'l', cols: DC_GL }), tip: 'Ver os leads desta campanha' }) });
      box.appendChild(w);
      if (nCamp > 15) { const mb = E('button', 'sr-link', st.todasCamp ? 'Mostrar só as 15 com mais investimento' : `Mostrar todas as ${S.fInt(nCamp)} campanhas`); mb.type = 'button'; mb.addEventListener('click', () => { st.todasCamp = !st.todasCamp; dash.draw('anuncios'); }); box.appendChild(mb); }
      const semCamp = LM.filter(r => !campDe(r)).length;
      box.appendChild(E('p', 'sr-hint', `Cada lead entra na campanha pelo utm_campaign ou, sem ele, pelo anúncio (utm_content). ROAS = valor vendido ÷ investimento.${semCamp ? ` ${S.fInt(semCamp)} leads de canal Meta não foram ligados a nenhuma campanha com gasto no período.` : ''}`));
    }
  }


  /* =================== CUSTO POR VENDEDOR (SDR e closer) ===================
     Cada lead de canal Meta recebe um custo: o investimento da campanha do Meta dele ÷ os leads do CRM ligados
     à mesma campanha. O que o gestor gastou em campanhas sem lead ligado é dividido entre os leads dele que não
     foram ligados a nenhuma campanha (ou, sem eles, entre todos os leads dele). Assim todo o investimento do gestor
     vira custo de lead. Google e outros canais não têm o investimento no relatório e ficam sem custo. */
  const DC_CUSTO = ['lead_nome', 'campanha_gestor', 'gestor', 'custo_lead', 'sdr_responsavel_nome', 'closer_nome', 'data_entrada', 'etapa_atual', 'utm_campaign', 'utm_content'];
  function custoLeads(B, MG) {
    const ads = MG.ads, porCamp = d3.group(ads, a => normNome(a.campanha));
    const adParaCamp = new Map(); d3.groups(ads, a => a._k).forEach(([k, v]) => { const g = d3.rollups(v, x => d3.sum(x, y => y.gasto), a => normNome(a.campanha)).sort((a, b) => b[1] - a[1]); if (g.length) adParaCamp.set(k, g[0][0]); });
    const campDe = r => { const u = normNome(r.utm_campaign); if (u && porCamp.has(u)) return u; return adParaCamp.get(normNome(r.utm_content)) || ''; };
    const LM = B.leads.filter(r => r.canal_geral === META_CANAL);
    B.leads.forEach(l => { l._custo = null; });
    const ligados = d3.group(LM, campDe);
    let atribuido = 0;
    /* 1) campanha com leads ligados */
    porCamp.forEach((adsC, k) => { const ls = ligados.get(k) || []; if (!ls.length) return; const g = d3.sum(adsC, a => a.gasto); ls.forEach(l => { l._custo = g / ls.length; }); atribuido += g; });
    /* 2) por gestor: o gasto em campanhas sem lead vai para os leads do gestor sem campanha (ou todos do gestor) */
    const semLead = new Map(); porCamp.forEach((adsC, k) => { if ((ligados.get(k) || []).length) return; adsC.forEach(a => semLead.set(a.gestor, (semLead.get(a.gestor) || 0) + a.gasto)); });
    let semDestino = 0;
    semLead.forEach((g, gestor) => {
      const doG = LM.filter(l => (l.gestor || SEM_GEST) === gestor || (gestor === SEM_GEST && !l.gestor));
      const alvo = doG.filter(l => l._custo == null).length ? doG.filter(l => l._custo == null) : doG;
      if (!alvo.length) { semDestino += g; return; }
      alvo.forEach(l => { l._custo = (l._custo || 0) + g / alvo.length; }); atribuido += g;
    });
    LM.forEach(l => { if (l._custo == null) l._custo = 0; });
    return { total: d3.sum(ads, a => a.gasto), atribuido, semDestino, LM };
  }
  S.st.cv = S.st.cv || { papel: 'sdr', sel: '', ord: { k: 'custo', dir: -1 }, ordT: { k: 'custo', dir: -1 } };
  dash.draw('custo', el => {
    const D = S.dados(), B = baseGestores(), N = negocios();
    if (!B || !N) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const st = S.st.cv, box = E('div', 'sr-nps');
    const topo = E('div', 'sr-row'); topo.style.justifyContent = 'space-between';
    topo.append(segmento([['sdr', 'SDRs'], ['closer', 'Closers']], st.papel, v => { st.papel = v; dash.draw('custo'); }),
      segmento([['', 'Todos os gestores']].concat(NOMES_GEST.map(n => [n, n])), st.sel, v => { st.sel = v; dash.draw('custo'); }));
    box.appendChild(topo);
    carregarMeta(B.F);
    const MS = S.st.meta;
    if (MS.estado !== 'ok') {
      const msgs = { carregando: ['Buscando os dados do Meta…', ''], indisponivel: ['O custo por vendedor aparece só no site do relatório.', 'Ele usa o investimento do Meta, que esta versão não acessa.'],
        desconectado: ['O Meta ainda não está conectado.', 'Falta guardar o token do usuário do sistema (META_TOKEN) no Cloudflare.'], erro: ['Não foi possível ler os dados do Meta.', MS.erro], nada: ['Buscando os dados do Meta…', ''] };
      const [t1, t2] = msgs[MS.estado] || msgs.nada; box.appendChild(cardMetaX(t1, t2)); el.replaceChildren(box); return;
    }
    const MG = metaPorGestor(B), K = custoLeads(B, MG);
    const fG = st.sel ? (l => l.gestor === st.sel) : (() => true);
    const L = B.leads.filter(fG), LC = L.filter(l => l._custo != null), semCusto = L.filter(l => l._custo == null);
    const vendaLead = new Set(N.filter(o => o._venda).map(o => o.lead_id));
    const papel = st.papel, dim = papel === 'sdr' ? 'sdr' : 'closer';
    const m = rows => {
      const comC = rows.filter(l => l._custo != null), custo = d3.sum(comC, l => l._custo);
      const call = rows.filter(l => D.porLead.has(l.lead_id)), real = rows.filter(l => (D.porLead.get(l.lead_id) || []).some(c => c._g === 'realizada')), vend = rows.filter(l => vendaLead.has(l.lead_id));
      return { calls: rows, leads: rows, comC, custo, call, real, vend, semC: rows.filter(l => l._custo == null) };
    };
    const div = (a, b) => b > 0 && a > 0 ? a / b : null, fR = v => v == null ? '—' : S.fBRL(v);
    /* KPIs */
    const T = m(L), { ks, kpi } = caixaKpis('sr-saude');
    const gastoSel = st.sel ? d3.sum(MG.ads.filter(a => a.gestor === st.sel), a => a.gasto) : K.total;
    kpi('Investimento do Meta', S.fBRL(gastoSel), st.sel ? 'contas e campanhas de ' + st.sel : 'todas as contas no período');
    kpi('Custo distribuído nos leads', S.fBRL(T.custo), `${S.fInt(T.comC.length)} leads de canal Meta`, () => S.abrir({ titulo: 'Leads com custo', rows: T.comC, kind: 'l', cols: DC_CUSTO }));
    kpi('Custo médio por lead', fR(div(T.custo, T.comC.length)), 'investimento ÷ leads do Meta no CRM');
    kpi('Leads sem custo', S.fInt(semCusto.length), 'Google e outros canais: sem investimento no relatório', () => S.abrir({ titulo: 'Leads sem custo (Google e outros canais)', rows: semCusto, kind: 'l', cols: DC_CUSTO }));
    box.appendChild(ks);
    /* ranking por pessoa */
    const nomeCol = papel === 'sdr' ? 'SDR responsável' : 'Closer';
    const h = E('h3', 'sr-sub3', 'Custo por ' + (papel === 'sdr' ? 'SDR' : 'closer')); h.appendChild(E('span', 'sr-hint', ' · ' + (papel === 'sdr' ? 'leads que cada SDR recebeu (SDR responsável)' : 'leads que chegaram a cada closer (closer da call ou da oportunidade)') + ' e quanto o investimento neles custou')); box.appendChild(h);
    const grupos = d3.groups(L, l => l._k[dim]).map(([k, rows]) => ({ key: k, nome: S.rotulo(dim, k), m: m(rows) })).filter(g => g.m.comC.length || papel === 'sdr');
    const COLS_CV = [
      { k: 'leads', t: 'Leads recebidos', v: m => m.leads.length, f: S.fInt, rows: m => m.leads, tit: 'Leads recebidos', kind: 'l', dcols: DC_CUSTO },
      { k: 'meta', t: 'Leads do Meta', v: m => m.comC.length, f: S.fInt, rows: m => m.comC, tit: 'Leads do Meta (com custo)', kind: 'l', dcols: DC_CUSTO },
      { k: 'custo', t: 'Custo total', v: m => m.custo, f: v => v ? S.fBRL(v) : '—', rows: m => m.comC, tit: 'Leads com custo', kind: 'l', dcols: DC_CUSTO },
      { k: 'cpl', t: 'Custo por lead', v: m => div(m.custo, m.comC.length), f: fR },
      { k: 'call', t: 'Com call', v: m => m.call.length, f: S.fInt, rows: m => m.call, tit: 'Leads com call', kind: 'l', dcols: DC_CUSTO },
      { k: 'real', t: 'Call realizada', v: m => m.real.length, f: S.fInt, rows: m => m.real, tit: 'Leads com call realizada', kind: 'l', dcols: DC_CUSTO },
      { k: 'vend', t: 'Vendas', v: m => m.vend.length, f: S.fInt, rows: m => m.vend, tit: 'Leads que viraram venda', kind: 'l', dcols: DC_CUSTO },
      { k: 'cpr', t: 'Custo por call realizada', v: m => div(m.custo, m.real.filter(l => l._custo != null).length), f: fR },
      { k: 'cac', t: 'Custo por venda', v: m => div(m.custo, m.vend.filter(l => l._custo != null).length), f: fR }
    ];
    const w = E('div', 'sr-motw sr-cvt');
    tabelaRanking(w, { dim, nomeCol, grupos, cols: COLS_CV, ord: st.ord, semMedalha: true, total: T,
      aoOrdenar: (k, dir) => { st.ord = { k, dir }; dash.draw('custo'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads recebidos', recorte: [nomeCol + ': ' + g.nome], rows: g.m.leads, kind: 'l', cols: DC_CUSTO }) }) });
    box.appendChild(w);
    /* leads e custo por campanha (tag) de cada pessoa */
    const h2 = E('h3', 'sr-sub3', 'Leads e custo por campanha'); h2.appendChild(E('span', 'sr-hint', ' · campanha da tag do lead (tabela dos gestores) · em cada célula: leads recebidos e o custo deles')); box.appendChild(h2);
    const campL = l => l.campanha_gestor || (l.canal_geral === META_CANAL ? 'Meta sem campanha na tabela' : 'Outras origens');
    const porCampT = d3.rollups(L, v => ({ n: v.length, custo: d3.sum(v, l => l._custo || 0) }), campL).sort((a, b) => b[1].custo - a[1].custo || b[1].n - a[1].n);
    const TOP = porCampT.slice(0, 7).map(d => d[0]), OUT = 'Demais campanhas';
    const colsC = TOP.concat(porCampT.length > 7 ? [OUT] : []);
    const campCol = l => TOP.includes(campL(l)) ? campL(l) : OUT;
    const tw = E('div', 'sr-tw'), tbl = E('table', 'sr-t sr-cmx'), th = E('thead'), trh = E('tr');
    trh.append(E('th', 'nome', nomeCol)); colsC.forEach(c => { const x = E('th', 'n', c); x.title = c; trh.appendChild(x); }); trh.appendChild(E('th', 'n tot', 'Total')); th.appendChild(trh); tbl.appendChild(th);
    const tb = E('tbody');
    const celC = (tr, rows, rec, cls) => {
      const td = E('td', 'n' + (cls ? ' ' + cls : ''));
      if (!rows.length) { td.appendChild(E('span', 'z', '·')); tr.appendChild(td); return; }
      const c = d3.sum(rows, l => l._custo || 0);
      const b = E('button', 'sr-cell'); b.type = 'button'; b.append(E('b', '', S.fInt(rows.length)), E('small', '', rows.some(l => l._custo != null) ? S.fBRL(c) : 'sem custo'));
      b.addEventListener('click', () => S.abrir({ titulo: 'Leads recebidos', recorte: rec, rows, kind: 'l', cols: DC_CUSTO })); td.appendChild(b); tr.appendChild(td);
    };
    const linhas = grupos.slice().sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.m.custo - a.m.custo || b.m.leads.length - a.m.leads.length);
    const totLin = (nome, rows, cls) => { const tr = E('tr', cls || ''); tr.appendChild(E('td', 'nome', nome)); const pc = d3.group(rows, campCol); colsC.forEach(c => celC(tr, pc.get(c) || [], [nome, c])); celC(tr, rows, [nome], 'tot'); return tr; };
    linhas.forEach(g => tb.appendChild(totLin(g.nome, g.m.leads, g.key === S.SEMK ? 'sem' : '')));
    tbl.appendChild(tb);
    const tf = E('tfoot'); tf.appendChild(totLin('Total', L, 'tot')); tbl.appendChild(tf);
    tw.appendChild(tbl); box.appendChild(tw);
    const avisos = ['O custo de cada lead vem do investimento do Meta na campanha dele (utm_campaign ou o anúncio do utm_content) dividido pelos leads do CRM dessa campanha. O gasto em campanhas sem lead ligado é dividido entre os leads do mesmo gestor.'];
    if (K.semDestino > 0 && !st.sel) avisos.push(`${S.fBRL(K.semDestino)} do investimento não tiveram nenhum lead no CRM para receber o custo.`);
    if (papel === 'closer') avisos.push('Para closer contam só os leads que chegaram a ele; os que nunca tiveram call ficam em "Sem closer".');
    avisos.push('Leads do Google e de outros canais ficam sem custo porque o investimento deles não está no relatório.');
    box.appendChild(E('p', 'sr-hint', avisos.join(' ')));
    el.replaceChildren(box);
  });
  S._extrasMeta = extrasMeta;
})();
