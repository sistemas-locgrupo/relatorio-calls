/* Núcleo do Super Relatório: datas, filtros, métricas, drill-down e exportação. */
window.SR = (function () {
  const C = window.SR_CONFIG || {};
  const loc = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['R$ ', ''] });
  const fInt = loc.format(',d'), fBRL = loc.format('$,.2f'), fPct = loc.format(',.1%'), f1 = loc.format(',.1f');
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDias = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const hoje = () => iso(new Date());
  const agora = () => { const d = new Date(); return `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dia = s => (s || '').slice(0, 10);
  const okDia = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
  const fData = s => { const d = dia(s); if (!okDia(d)) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };
  const fDataHora = s => { const d = fData(s); const h = (s || '').slice(11, 16); return d ? (h ? `${d} ${h}` : d) : ''; };
  const fDiaMes = s => { const d = parse(s); return `${pad(d.getDate())}/${MES[d.getMonth()]}`; };
  const fCurto = s => { const d = parse(s); return `${pad(d.getDate())}/${MES[d.getMonth()]} · ${SEM[d.getDay()]}`; };
  const fDM = s => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
  const toDate = s => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
  const difDias = (a, b) => { const x = toDate(a), y = toDate(b); return x && y ? (y - x) / 864e5 : null; };
  const limpa = s => String(s == null ? '' : s).replace(/​/g, '').trim().replace(/\s+/g, ' ');
  const norm = s => limpa(s).toLowerCase();
  const fDias = v => v == null ? '—' : `${f1(v)} ${Math.abs(v) >= 0.95 && Math.abs(v) < 1.05 ? 'dia' : 'dias'}`;
  const pct = (a, b) => b > 0 ? a / b : null;
  const fP = v => v == null ? '—' : fPct(v);
  const reduz = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- grupos de status: vêm prontos da base unificada (config.js) ---------- */
  const ROT = Object.assign({ agendada: 'Agendada', realizada: 'Realizada', no_show: 'No-show', cancelada: 'Cancelada', remarcada: 'Remarcada', ganho: 'Ganho', perdido: 'Perdido', aberto: 'Em aberto' }, C.rotulos || {});
  const COR = Object.assign({ realizada: '#2103CE', no_show: '#FFA92E', agendada: '#0096FF', cancelada: '#C9C3E6' }, C.cores || {});
  const CODIGO = {}; Object.keys(ROT).forEach(k => { CODIGO[norm(ROT[k])] = k; });
  const codigo = v => CODIGO[norm(v)] || '';

  /* ---------- dimensões de origem / pessoas (c = linha de call, l = linha de lead) ---------- */
  const fm = r => { const s = limpa(r.utm_source), m = limpa(r.utm_medium); return (s && s !== 'Sem UTM') || (m && m !== 'Sem UTM') ? `${s || '—'} / ${m || '—'}` : ''; };
  const DIMS = {
    tag: { nome: 'Tag de campanha', c: r => r.tag_campanha, l: r => r.tag_campanha, sem: 'Sem tag' },
    src: { nome: 'utm_source', c: r => r.utm_source, l: r => r.utm_source, sem: 'Sem UTM' },
    camp: { nome: 'Campanha', c: r => r.utm_campaign, l: r => r.utm_campaign, sem: 'Sem UTM' },
    cri: { nome: 'Criativo', c: r => r.utm_content, l: r => r.utm_content, sem: 'Sem UTM' },
    sdr: { nome: 'SDR', c: r => r.sdr_agendou_nome, l: r => r.sdr_responsavel_nome, sem: 'Sem SDR' },
    closer: { nome: 'Closer', c: r => r.closer_nome, l: r => r.closer_nome, sem: 'Sem closer' },
    pipe: { nome: 'Pipeline', c: r => r.pipeline_atual, l: r => r.pipeline_atual, sem: 'Sem pipeline' },
    modelo: { nome: 'Modelo de franquia', c: r => r.modelo_franquia, l: r => r.modelo_franquia, sem: 'Sem modelo' },
    med: { nome: 'utm_source / medium', c: fm, l: fm, sem: 'Sem UTM' },
    fonte: { nome: 'Fonte', c: r => r.fonte, l: r => r.fonte, sem: 'Sem fonte' }
  };
  const FDIMS = ['tag', 'src', 'camp', 'cri', 'sdr', 'closer', 'pipe', 'modelo'];
  const SEMK = '∅';
  const chave = (dim, row, kind) => { const k = norm(kind === 'l' ? DIMS[dim].l(row) : DIMS[dim].c(row)); return !k || k === norm(DIMS[dim].sem) ? SEMK : k; };

  /* ---------- leitura da base unificada (única fonte da página) ---------- */
  let cache = {};
  /* com a data da reunião filtrada, a página inteira passa a contar pela data da reunião */
  function base() { const p = dash.params(); return p.db === 're' || okDia(p.fr_ini) ? 're' : 'ag'; }
  function dados() {
    const b = dash.data('base_unificada');
    if (b.status !== 'ok' || !Array.isArray(b.data)) return { ok: false, status: b.status || 'loading' };
    const db = base();
    if (cache.b === b.data && cache.db === db) return cache.v;
    const prep = r => {
      const o = Object.assign({}, r);
      /* pela data da reunião: reunião sem data mas com link de gravação usa a data do agendamento */
      o._d = db === 're' ? (r.data_reuniao || (limpa(r.link_gravacao) ? r.data_agendamento : '')) : r.data_agendamento;
      o._dia = dia(o._d);
      o._g = codigo(r.status_reuniao_grupo);
      o._res = codigo(r.resultado_grupo);
      o._rem = (Number(r.remarcacoes) || 0) > 0;
      o.valor = Number(r.valor) || 0;
      return o;
    };
    const rows = b.data.map(prep);
    const calls = rows.filter(r => r.tem_reuniao === 'sim');
    calls.forEach(o => { o._k = {}; for (const k in DIMS) o._k[k] = chave(k, o, 'c'); });
    /* um lead = a linha da sua call mais recente (ou a linha sem call) */
    const ml = new Map();
    for (const r of rows) { if (!r.lead_id) continue; const a = ml.get(r.lead_id); if (!a || (r.tem_reuniao === 'sim' && (a.tem_reuniao !== 'sim' || r._d > a._d))) ml.set(r.lead_id, r); }
    const leads = [...ml.values()].map(r => { const o = Object.assign({}, r); o._ld = dia(r.data_entrada); o._k = {}; for (const k in DIMS) o._k[k] = chave(k, o, 'l'); return o; });
    const porLead = d3.group(calls, r => r.lead_id);
    const rot = {};
    for (const k in DIMS) {
      const m = new Map();
      const add = (raw, key) => { if (key !== SEMK && !m.has(key)) m.set(key, limpa(raw)); };
      calls.forEach(r => add(DIMS[k].c(r), r._k[k]));
      leads.forEach(x => add(DIMS[k].l(x), x._k[k]));
      rot[k] = m;
    }
    cache = { b: b.data, db, v: { ok: true, status: 'ok', rows, calls, leads, porLead, rot } };
    return cache.v;
  }
  const rotulo = (dim, key) => key === SEMK ? DIMS[dim].sem : ((dados().rot || {})[dim] || new Map()).get(key) || key;

  /* ---------- período, slider e filtros ---------- */
  function presets() {
    const h = hoje(), d = new Date(), y = d.getFullYear(), m = d.getMonth();
    return {
      hoje: [h, h], ontem: [addDias(h, -1), addDias(h, -1)], '7': [addDias(h, -6), h],
      mes: [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))],
      mesant: [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))]
    };
  }
  function per() {
    const fr = filtroReuniao();
    if (fr) return { ini: fr.a, fim: fr.b };
    const p = dash.params(), def = presets().mes;
    let ini = okDia(p.ini) ? p.ini : def[0], fim = okDia(p.fim) ? p.fim : def[1];
    if (fim < ini) [ini, fim] = [fim, ini];
    if (addDias(ini, 366) < fim) fim = addDias(ini, 366);
    return { ini, fim };
  }
  function dias() { const q = per(), o = []; for (let d = q.ini; d <= q.fim; d = addDias(d, 1)) o.push(d); return o; }
  const st = { idx: null, key: '', playing: false, timer: null, rk: { k: 'calls', dir: -1 }, dr: null };
  function idxPadrao() { const ds = dias(), h = hoje(); if (h < ds[0]) return 0; const i = ds.indexOf(h); return i >= 0 ? i : ds.length - 1; }
  function idx() { const n = dias().length; if (st.idx == null || st.idx > n - 1) st.idx = idxPadrao(); return Math.max(0, st.idx); }
  function ate() { return dias()[idx()]; }
  function filtros() { const p = dash.params(), o = {}; FDIMS.forEach(k => { const v = p['f_' + k]; if (Array.isArray(v) && v.length) o[k] = v; }); return o; }
  /* filtro de data da reunião (fr_ini / fr_fim) */
  function filtroReuniao() {
    const p = dash.params();
    if (!okDia(p.fr_ini)) return null;
    let a = p.fr_ini, b = okDia(p.fr_fim) ? p.fr_fim : p.fr_ini;
    if (b < a) [a, b] = [b, a];
    return { a, b };
  }
  const fDataRe = fr => fr.a === fr.b ? fData(fr.a) : `${fData(fr.a)} a ${fData(fr.b)}`;
  function passa(row, kind, pular, fx, frx) {
    const f = fx || filtros();
    for (const k in f) { if (k === pular) continue; if (!f[k].includes(row._k[k])) return false; }
    return true;
  }
  function janela(a, b) {
    const D = dados(); if (!D.ok) return null;
    const f = filtros(), fr = filtroReuniao();
    /* com data da reunião: leads = quem tem reunião na janela; sem ela: leads que entraram na janela */
    const temReuniao = x => (D.porLead.get(x.lead_id) || []).some(c => { const d = dia(c.data_reuniao); return d && d >= a && d <= b; });
    return {
      a, b,
      calls: D.calls.filter(r => r._dia >= a && r._dia <= b && passa(r, 'c', null, f)),
      leads: D.leads.filter(x => (fr ? temReuniao(x) : x._ld >= a && x._ld <= b) && passa(x, 'l', null, f))
    };
  }

  /* ---------- métricas ---------- */
  /* coorte: dos leads da janela, quem agendou call dentro da janela [a, b] */
  function coorte(leads, a, b) {
    const D = dados(), ag = [], depois = [], semCall = [], cs = [], realL = [], nsL = [];
    for (const l of leads) {
      const todas = D.porLead.get(l.lead_id) || [];
      const dentro = todas.filter(c => { const d = dia(c.data_agendamento); return d && (a == null || (d >= a && d <= b)); });
      if (dentro.length) { ag.push(l); cs.push(...dentro); if (dentro.some(c => c._g === 'realizada')) realL.push(l); if (dentro.some(c => c._g === 'no_show')) nsL.push(l); }
      else if (b != null && todas.some(c => dia(c.data_agendamento) > b)) depois.push(l);
      else semCall.push(l);
    }
    return { ag, depois, semCall, calls: cs, realL, nsL };
  }
  /* agendadas: o mesmo lead conta uma vez dentro do recorte */
  function umPorLead(rows) { const v = new Set(); return rows.filter(r => { const k = r.lead_id || r.reuniao_id; if (v.has(k)) return false; v.add(k); return true; }); }
  function M(todas, leads, a, b) {
    const D = dados();
    const calls = umPorLead(todas);
    /* realizadas: toda reunião com link de gravação, sem tirar repetição */
    const realizadas = todas.filter(r => r._g === 'realizada');
    const noshow = todas.filter(r => r._g === 'no_show');
    const remarc = calls.filter(r => r._rem);
    const om = new Map();
    for (const r of todas) if (r.oportunidade_id) { const a = om.get(r.oportunidade_id); if (!a || r._d > a._d) om.set(r.oportunidade_id, r); }
    const opps = [...om.values()];
    const vendas = opps.filter(r => r._res === 'ganho');
    const perdidas = opps.filter(r => r._res === 'perdido');
    const vendasValor = vendas.filter(r => Number(r.valor) > 0);
    const valor = d3.sum(vendasValor, r => Number(r.valor));
    const leadsCall = leads.filter(x => D.porLead.has(x.lead_id));
    const tempo = (rows, campo) => { const v = []; const rs = rows.filter(r => { const d = r[campo]; if (d === '' || d == null || !isFinite(Number(d)) || Number(d) < 0) return false; v.push(Number(d)); return true; }); return { rows: rs, m: v.length ? d3.mean(v) : null }; };
    const t1 = tempo(calls, 'dias_lead_ate_agendamento');
    const t2 = tempo(calls, 'dias_agendamento_ate_reuniao');
    const t3 = tempo(opps, 'dias_reuniao_ate_fechamento');
    return { calls, leads, realizadas, noshow, remarc, opps, vendas, perdidas, vendasValor, valor, leadsCall, t1, t2, t3, comp: realizadas.concat(noshow), coorte: coorte(leads, a, b) };
  }
  const MET = {
    leads: { nome: 'Leads', info: 'Leads com data de entrada dentro do período.', v: m => m.leads.length, f: fInt, rows: m => m.leads, kind: 'l' },
    calls: { nome: 'Calls agendadas', info: 'Leads com reunião criada no período (cada lead conta uma vez), incluindo canceladas.', v: m => m.calls.length, f: fInt, rows: m => m.calls, kind: 'c' },
    realizadas: { nome: 'Calls realizadas', info: 'Reuniões com link de gravação no período (cada reunião com link conta).', v: m => m.realizadas.length, f: fInt, rows: m => m.realizadas, kind: 'c' },
    noshow: { nome: 'No-shows', info: 'Reuniões marcadas como no-show.', v: m => m.noshow.length, f: fInt, rows: m => m.noshow, kind: 'c', ruim: true },
    remarc: { nome: 'Remarcações', info: 'Calls com remarcações maior que zero.', v: m => m.remarc.length, f: fInt, rows: m => m.remarc, kind: 'c', ruim: true },
    opps: { nome: 'Oportunidades', info: 'Oportunidades distintas ligadas às calls do período.', v: m => m.opps.length, f: fInt, rows: m => m.opps, kind: 'c' },
    vendas: { nome: 'Vendas', info: 'Oportunidades das calls do período com resultado ganho.', v: m => m.vendas.length, f: fInt, rows: m => m.vendas, kind: 'c' },
    valor: { nome: 'Valor vendido', info: 'Soma do valor das vendas (ganhos) com valor preenchido.', v: m => m.valor, f: fBRL, rows: m => m.vendasValor, kind: 'c' },
    leadcall: { nome: 'Lead → Call', info: 'Leads do período que têm pelo menos uma reunião ÷ leads do período.', v: m => pct(m.leadsCall.length, m.leads.length), f: fP, rows: m => m.leadsCall, kind: 'l', taxa: true },
    taxaconc: { nome: 'Taxa de conclusão', info: 'Calls concluídas (realizadas) ÷ calls agendadas.', v: m => pct(m.realizadas.length, m.calls.length), f: fP, rows: m => m.realizadas, kind: 'c', taxa: true },
    taxans: { nome: 'Taxa de no-show', info: 'No-shows ÷ (realizadas + no-show). Pendentes e futuras ficam de fora.', v: m => pct(m.noshow.length, m.comp.length), f: fP, rows: m => m.noshow, kind: 'c', taxa: true, ruim: true },
    comp: { nome: 'Comparecimento', info: 'Realizadas ÷ (realizadas + no-show). Pendentes e futuras ficam de fora.', v: m => pct(m.realizadas.length, m.comp.length), f: fP, rows: m => m.comp, kind: 'c', taxa: true },
    callvenda: { nome: 'Call → Venda', info: 'Vendas que tiveram call no período ÷ calls realizadas.', v: m => pct(m.vendas.length, m.realizadas.length), f: fP, rows: m => m.vendas, kind: 'c', taxa: true },
    ticket: { nome: 'Ticket médio', info: 'Valor vendido ÷ vendas com valor preenchido.', v: m => m.vendasValor.length ? m.valor / m.vendasValor.length : null, f: v => v == null ? '—' : fBRL(v), rows: m => m.vendasValor, kind: 'c' },
    t1: { nome: 'Lead → Agendamento', info: 'Média de dias entre a entrada do lead e o agendamento da call.', v: m => m.t1.m, f: fDias, rows: m => m.t1.rows, kind: 'c', ruim: true },
    t2: { nome: 'Agendamento → Reunião', info: 'Média de dias entre o agendamento e a data da reunião.', v: m => m.t2.m, f: fDias, rows: m => m.t2.rows, kind: 'c', ruim: true },
    lc_ag: { nome: 'Agendaram call', info: 'Leads criados no dia que agendaram pelo menos uma call no mesmo dia.', v: m => m.coorte.ag.length, f: fInt, rows: m => m.coorte.ag, kind: 'l' },
    lc_taxa: { nome: 'Taxa de agendamento', info: 'Leads que agendaram call no dia ÷ leads criados no dia.', v: m => pct(m.coorte.ag.length, m.leads.length), f: fP, rows: m => m.coorte.ag, kind: 'l', taxa: true },
    lc_real: { nome: 'Leads com call concluída', info: 'Dos leads que agendaram no dia, quantos tiveram uma call realizada (cada lead conta uma vez).', v: m => m.coorte.realL.length, f: fInt, rows: m => m.coorte.realL, kind: 'l' },
    lc_ns: { nome: 'Leads com no-show', info: 'Dos leads que agendaram no dia, quantos tiveram no-show (cada lead conta uma vez).', v: m => m.coorte.nsL.length, f: fInt, rows: m => m.coorte.nsL, kind: 'l', ruim: true },
    t3: { nome: 'Reunião → Fechamento', info: 'Média de dias entre a reunião e o fechamento (ganho ou perdido).', v: m => m.t3.m, f: fDias, rows: m => m.t3.rows, kind: 'c', ruim: true }
  };
  /* variação vs período anterior: "—" quando o anterior é zero ou tem menos de 10 registros */
  const MIN_BASE = 10;
  function baseAnterior(id, mp) {
    if (!mp) return 0;
    if (id === 'leadcall' || id === 'lc_taxa') return mp.leads.length;
    if (id === 'comp' || id === 'taxans') return mp.comp.length;
    if (id === 'taxaconc') return mp.calls.length;
    if (id === 'callvenda') return mp.realizadas.length;
    return MET[id].rows(mp).length;
  }
  function variacao(id, a, b, mp) {
    const t = MET[id];
    if (a == null || b == null || b === 0 || baseAnterior(id, mp) < MIN_BASE) return { txt: '—', dir: 0, semBase: true };
    if (a === b) return { txt: '= vs período anterior', dir: 0 };
    const dir = a > b ? 1 : -1, seta = dir > 0 ? '▲' : '▼';
    if (t.taxa) return { txt: `${seta} ${f1(Math.abs(a - b) * 100)} p.p. vs período anterior`, dir };
    return { txt: `${seta} ${fPct(Math.abs(a - b) / Math.abs(b))} vs período anterior`, dir };
  }

  /* KPIs até a data do slider, com o período anterior equivalente */
  let kc = {};
  function kpis() {
    const D = dados(); if (!D.ok) return null;
    const q = per(), a = ate(), n = Math.round(difDias(q.ini, a)) + 1;
    const key = JSON.stringify(dash.params()) + '|' + a;
    if (kc.D === D && kc.key === key) return kc.v;
    const cur = janela(q.ini, a), prev = janela(addDias(q.ini, -n), addDias(q.ini, -1));
    const v = { cur: M(cur.calls, cur.leads, q.ini, a), prev: M(prev.calls, prev.leads, prev.a, prev.b), a: q.ini, b: a, pa: prev.a, pb: prev.b };
    kc = { D, key, v };
    return v;
  }
  /* período completo (blocos 3 a 9) */
  let fc = {};
  function full() {
    const D = dados(); if (!D.ok) return null;
    const q = per(), key = JSON.stringify(dash.params());
    if (fc.D === D && fc.key === key) return fc.v;
    const w = janela(q.ini, q.fim);
    const v = { calls: w.calls, leads: w.leads, m: M(w.calls, w.leads, q.ini, q.fim), a: q.ini, b: q.fim };
    fc = { D, key, v };
    return v;
  }
  function agrupa(calls, leads, dim) {
    const g = new Map();
    const pega = k => { if (!g.has(k)) g.set(k, { key: k, nome: rotulo(dim, k), calls: [], leads: [] }); return g.get(k); };
    calls.forEach(r => pega(r._k[dim]).calls.push(r));
    leads.forEach(x => pega(x._k[dim]).leads.push(x));
    return [...g.values()];
  }

  /* ---------- filtros: alterar ---------- */
  function addFiltro(dim, key) {
    const cur = filtros()[dim] || [];
    if (cur.includes(key)) return;
    dash.setParams({ ['f_' + dim]: cur.concat([key]) });
  }
  function tiraFiltro(dim, key) {
    const cur = (filtros()[dim] || []).filter(k => k !== key);
    dash.setParams({ ['f_' + dim]: cur.length ? cur : null });
  }
  function limpaFiltros() { const o = { fr_ini: null, fr_fim: null }; FDIMS.forEach(k => o['f_' + k] = null); dash.setParams(o); }
  function descFiltros(semData) {
    const f = filtros(), out = [], fr = semData ? null : filtroReuniao();
    if (fr) out.push(`Data da reunião: ${fDataRe(fr)}`);
    for (const k in f) out.push(`${DIMS[k].nome}: ${f[k].map(v => rotulo(k, v)).join(', ')}`);
    return out;
  }

  /* ---------- linhas da lista de leads (colunas unificadas) ---------- */
  function linha(r) { return r; }
  const txt = v => limpa(v);
  const COLS = [
    { k: 'lead_nome', t: 'Nome', g: r => txt(r.lead_nome) },
    { k: 'data_entrada', t: 'Data de entrada', g: r => fData(r.data_entrada), s: r => r.data_entrada || '' },
    { k: 'fonte', t: 'Fonte', g: r => txt(r.fonte) },
    { k: 'utm_source', t: 'utm_source', g: r => txt(r.utm_source) },
    { k: 'utm_medium', t: 'utm_medium', g: r => txt(r.utm_medium) },
    { k: 'utm_campaign', t: 'utm_campaign', g: r => txt(r.utm_campaign) },
    { k: 'utm_content', t: 'utm_content', g: r => txt(r.utm_content) },
    { k: 'tag_campanha', t: 'Tag de campanha', g: r => txt(r.tag_campanha) },
    { k: 'sdr_agendou_nome', t: 'SDR que agendou', g: r => txt(r.sdr_agendou_nome) },
    { k: 'closer_nome', t: 'Closer', g: r => txt(r.closer_nome) },
    { k: 'closer_agendado', t: 'Closer da agenda', g: r => txt(r.closer_agendado) },
    { k: 'data_agendamento', t: 'Data do agendamento', g: r => fDataHora(r.data_agendamento), s: r => r.data_agendamento || '' },
    { k: 'data_reuniao', t: 'Data da reunião', g: r => fDataHora(r.data_reuniao), s: r => r.data_reuniao || '' },
    { k: 'data_fechamento', t: 'Data de fechamento', g: r => fDataHora(r.data_fechamento), s: r => r.data_fechamento || '' },
    { k: 'remarcacoes', t: 'Remarcações', g: r => r.remarcacoes === '' || r.remarcacoes == null ? '' : String(Number(r.remarcacoes) || 0), s: r => Number(r.remarcacoes) || 0, n: true, x: r => r.remarcacoes === '' || r.remarcacoes == null ? '' : Number(r.remarcacoes) || 0 },
    { k: 'status', t: 'Status da reunião', g: r => r._g ? ROT[r._g] + (r._rem ? ' · ' + ROT.remarcada : '') : '' },
    { k: 'etapa_atual', t: 'Etapa atual', g: r => txt(r.etapa_atual) },
    { k: 'resultado', t: 'Resultado', g: r => r._res ? ROT[r._res] : '' },
    { k: 'valor', t: 'Valor', g: r => Number(r.valor) > 0 ? fBRL(Number(r.valor)) : '', s: r => Number(r.valor) || 0, n: true, x: r => Number(r.valor) > 0 ? Number(r.valor) : '' },
    { k: 'modelo_franquia', t: 'Modelo de franquia', g: r => txt(r.modelo_franquia) },
    { k: 'motivo_perda', t: 'Motivo de perda', g: r => txt(r.motivo_perda) },
    { k: 'motivo_unificado', t: 'Motivo (unificado)', g: r => txt(r.motivo_unificado) || 'Sem motivo no CRM' },
    { k: 'motivo_perda_custom', t: 'Motivo personalizado', g: r => txt(r.motivo_perda_custom) },
    { k: 'motivo_perda_nativo', t: 'Motivo nativo do CRM', g: r => txt(r.motivo_perda_nativo) },
    { k: 'tag_principal', t: 'Tag (1ª tag)', g: r => txt(r.tag_principal) },
    { k: 'vendedor', t: 'Vendedor', g: r => txt(r.vendedor) },
    { k: 'tags', t: 'Tags', g: r => txt(r.tags) },
    { k: 'gestor', t: 'Gestor de tráfego', g: r => txt(r.gestor) || 'Sem gestor' },
    { k: 'campanha_gestor', t: 'Campanha (gestor)', g: r => txt(r.campanha_gestor) },
    { k: 'canal_geral', t: 'Canal (geral)', g: r => txt(r.canal_geral) },
    { k: 'canal_gestor', t: 'Canal', g: r => txt(r.canal_gestor) },
    { k: 'campanha', t: 'Campanha (1ª tag)', g: r => txt(String(r.tags || '').split('|')[0]).toLowerCase() || 'Sem tag' },
    { k: 'dono_atual_nome', t: 'Proprietário', g: r => txt(r.dono_atual_nome) },
    { k: 'data_ultima_movimentacao', t: 'Última movimentação', g: r => fDataHora(r.data_ultima_movimentacao), s: r => r.data_ultima_movimentacao || '' },
    { k: 'nota_closer', t: 'Nota do closer (1–5)', g: r => r.nota_closer_qualificacao_sdr === '' || r.nota_closer_qualificacao_sdr == null ? '' : String(r.nota_closer_qualificacao_sdr), s: r => Number(r.nota_closer_qualificacao_sdr) || 0, n: true, x: r => r.nota_closer_qualificacao_sdr === '' ? '' : Number(r.nota_closer_qualificacao_sdr) },
    { k: 'gravacao', t: 'Gravação', g: r => r.link_gravacao_situacao === 'valido' ? 'OK' : (r.link_gravacao_motivo || '') },
    { k: 'link_gravacao', t: 'Link da gravação', g: r => txt(r.link_gravacao) },
    { k: 'sdr_responsavel_nome', t: 'SDR responsável', g: r => txt(r.sdr_responsavel_nome) },
    { k: 'sdr_origem_nome', t: 'SDR de origem', g: r => txt(r.sdr_origem_nome) },
    { k: 'pipeline', t: 'Pipeline', g: r => txt(r.pipeline) },
    { k: 'data_criacao', t: 'Criação da oportunidade', g: r => fDataHora(r.data_criacao), s: r => r.data_criacao || '' },
    { k: 'resultado_neg', t: 'Resultado da oportunidade', g: r => txt(r.resultado) },
    { k: 'dias_parado', t: 'Dias sem movimentação', g: r => r._parado == null ? '' : String(Math.floor(r._parado)), s: r => r._parado || 0, n: true, x: r => r._parado == null ? '' : Math.floor(r._parado) }
  ];
  const COLS_PADRAO = ['lead_nome', 'data_entrada', 'utm_campaign', 'utm_content', 'tag_campanha', 'sdr_agendou_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'status', 'resultado', 'valor'];
  const slug = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'lista';

  /* abre a lista de leads */
  function abrir(o) {
    const rows = (o.rows || []).slice();
    const partes = [o.titulo].concat(o.recorte || []).concat(descFiltros(o.semData));
    const periodo = o.periodo || [per().ini, per().fim];
    st.dr = {
      titulo: partes.filter(Boolean).join(' · '),
      periodo: `${fDM(periodo[0])} a ${fDM(periodo[1])}`,
      slug: slug([o.titulo].concat(o.recorte || []).join(' ')),
      rows, q: '', sort: { k: o.kind === 'l' ? 'data_entrada' : 'data_agendamento', dir: -1 }, page: 0,
      cols: o.cols ? new Set(o.cols) : (st.dr && st.dr.cols && !st.dr.proprias) ? st.dr.cols : new Set(COLS_PADRAO), proprias: !!o.cols, escolher: false
    };
    document.querySelectorAll('.sr').forEach(e => { e.classList.add('drill-on'); e.classList.remove('painel-on'); });
    document.querySelectorAll('[data-draw="painel"]').forEach(e => { e.hidden = true; });
    document.querySelectorAll('[data-draw="drawer"]').forEach(e => { e.hidden = false; });
    dash.draw('drawer');
    const d = document.querySelector('.sr-modal-box'); if (d && d.scrollTo) d.scrollTo(0, 0);
    const x = document.querySelector('.sr-modal-box .sr-fechar'); if (x) x.focus({ preventScroll: true });
  }
  function fechar() {
    st.dr = null;
    document.querySelectorAll('.sr').forEach(e => e.classList.remove('drill-on'));
    document.querySelectorAll('[data-draw="drawer"]').forEach(e => { e.hidden = true; });
  }
  function abrirMetrica(id, w, extra) {
    const t = MET[id], m = w && w.m ? w.m : (w || kpis().cur);
    abrir(Object.assign({ titulo: t.nome, rows: t.rows(m), kind: t.kind }, extra || {}));
  }
  function linhasFiltradas() {
    const d = st.dr; if (!d) return [];
    const q = norm(d.q);
    let rows = q ? d.rows.filter(r => norm(r.lead_nome).includes(q)) : d.rows.slice();
    const c = COLS.find(x => x.k === d.sort.k) || COLS[0];
    const val = c.s || c.g;
    rows.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * d.sort.dir; });
    return rows;
  }

  /* ---------- downloads ---------- */
  let avisoMsg = '', avisoT = null;
  function aviso(m) { avisoMsg = m; dash.draw('aviso'); if (avisoT) clearTimeout(avisoT); avisoT = setTimeout(() => { avisoMsg = ''; dash.draw('aviso'); }, 4500); }
  const lerAviso = () => avisoMsg;
  async function salvar(nome, data) {
    try {
      const c = window.claude;
      const dl = c && c.use ? await c.use('downloads') : null;
      if (!dl) { aviso('Faça login no claude.ai e abra o painel por lá para baixar arquivos.'); return; }
      await dl.save({ filename: nome, data });
      aviso('Arquivo pronto: ' + nome);
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') return;
      if (code === 'rate_limited') return aviso('Já tem um download aguardando confirmação.');
      aviso('Não foi possível baixar aqui.');
    }
  }
  const dataArq = () => { const h = hoje().split('-'); return `${h[2]}-${h[1]}-${h[0]}`; };
  function tabelaDrill(todas) {
    const d = st.dr; if (!d) return [];
    const cols = COLS.filter(c => todas || d.cols.has(c.k));
    const rows = linhasFiltradas();
    return [cols.map(c => c.t)].concat(rows.map(r => cols.map(c => c.x ? c.x(r) : c.g(r))));
  }
  function baixarDrill(fmt) {
    const d = st.dr; if (!d || !d.rows.length) return;
    const linhas = tabelaDrill(false);
    const nome = `calls_${d.slug}_${dataArq()}.${fmt}`;
    if (fmt === 'csv') salvar(nome, window.SRX.csv(linhas));
    else salvar(nome, window.SRX.xlsx([{ nome: 'Leads', linhas }]));
  }

  /* contagem animada */
  function contar(el, alvo, fmt) {
    if (alvo == null || !isFinite(alvo)) { d3.select(el).interrupt('conta'); el.__v = undefined; el.textContent = fmt(null); return; }
    const de = typeof el.__v === 'number' ? el.__v : 0;
    const s = d3.select(el); s.interrupt('conta');
    if (reduz() || de === alvo) { el.__v = alvo; el.textContent = fmt(alvo); return; }
    s.transition('conta').duration(300).ease(d3.easeCubicOut).tween('t', () => {
      const it = d3.interpolateNumber(de, alvo);
      return t => { const v = it(t); el.__v = v; el.textContent = fmt(v); };
    }).on('end', () => { el.__v = alvo; el.textContent = fmt(alvo); });
  }

  /* tooltip dentro de um contêiner relativo */
  function tip(host) {
    let t = host.querySelector(':scope > .sr-tip');
    if (!t) { t = document.createElement('div'); t.className = 'sr-tip'; t.hidden = true; host.appendChild(t); }
    return {
      show(ev, titulo, linhas) {
        const b = document.createElement('b'); b.textContent = titulo;
        t.replaceChildren(b, ...linhas.map(([a, v, cor]) => {
          const r = document.createElement('div'); const x = document.createElement('span');
          if (cor) { const i = document.createElement('i'); i.className = 'sr-sw'; i.style.background = cor; x.appendChild(i); }
          x.appendChild(document.createTextNode(a)); const y = document.createElement('span'); y.textContent = v; r.append(x, y); return r;
        }));
        t.hidden = false;
        const hb = host.getBoundingClientRect();
        let x = ev.clientX - hb.left + 14, y = ev.clientY - hb.top + 14;
        if (x + t.offsetWidth > hb.width) x = Math.max(0, ev.clientX - hb.left - t.offsetWidth - 14);
        if (y + t.offsetHeight > hb.height + 30) y = Math.max(0, ev.clientY - hb.top - t.offsetHeight - 14);
        t.style.left = x + 'px'; t.style.top = y + 'px';
      },
      hide() { t.hidden = true; }
    };
  }
  /* pequeno helper de DOM para dentro de desenhos */
  function el(tag, cls, texto) { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; }
  function vazio(host, msg) { host.replaceChildren(el('div', 'sr-empty', msg)); }
  function estado(D) { return D && D.status === 'error' ? 'Falha ao carregar os dados.' : 'Carregando…'; }

  /* ---------- atualização automática ---------- */
  const FONTES = ['leads', 'reunioes', 'negocios'];
  st.ultima = null;
  function atualizar() { st.atualizando = true; FONTES.forEach(id => dash.refresh(id)); dash.draw('atualizado'); }

  return {
    atualizar, FONTES, codigo, filtroReuniao, fDataRe,
    C, ROT, COR, DIMS, FDIMS, SEMK, MET, fInt, fBRL, fPct, f1, fP, fDias, fData, fDataHora, fDiaMes, fCurto, fDM, MESL, MES, SEM, pad, iso, parse, addDias, hoje, agora, dia, okDia,
    umPorLead, norm, limpa, difDias, toDate, pct, reduz, dados, rotulo, presets, per, dias, st, idx, idxPadrao, ate, filtros, passa, janela, M, variacao, kpis, full, agrupa,
    addFiltro, tiraFiltro, limpaFiltros, descFiltros, linha, COLS, COLS_PADRAO, abrir, fechar, abrirMetrica, linhasFiltradas, salvar, aviso, lerAviso, dataArq,
    tabelaDrill, baixarDrill, contar, tip, el, vazio, estado, slug
  };
})();
