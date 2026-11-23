/* Blocos do Super Relatório de Calls (layout B.I.). Tudo lê da base unificada via SR. */
(function () {
  const S = window.SR, E = S.el;
  /* cores pelo tema (claro/escuro): as variáveis ficam no CSS da página */
  const AZUL = 'var(--azul)', PROF = 'var(--linha)', TXT = 'var(--txt)', TXT2 = 'var(--txt2)', BORDA = 'var(--borda)';
  const COR = { realizada: 'var(--c-real)', agendada: 'var(--c-ag)', no_show: 'var(--c-ns)', cancelada: 'var(--c-can)' };
  const KEYS = ['realizada', 'agendada', 'no_show', 'cancelada'];
  const MEDALHA = ['#C9A227', '#A0A4AB', '#B87333'];
  const HEAT_C = d3.scaleLinear().domain([0, 1]).range(['#EEF0FF', '#2103CE']).interpolate(d3.interpolateRgb);
  const HEAT_E = d3.scaleLinear().domain([0, 1]).range(['#2E2E38', '#8F84FF']).interpolate(d3.interpolateRgb);
  const AVCOR = ['#2103CE', '#2F7FE0', '#7B3FE4', '#0E8F63', '#C2620A', '#C8323E', '#0B7EA8', '#5B5F84'];
  const escuro = () => { const r = document.querySelector('.sr'); return !!(r && r.classList.contains('escuro')); };
  const HEAT = t => (escuro() ? HEAT_E : HEAT_C)(t);
  const corNum = t => escuro() ? '#EEF1FF' : (t > 0.55 ? '#FFFFFF' : '#141414');
  const NS = 'http://www.w3.org/2000/svg';
  const ICONES = {
    cal: [['rect', { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ['path', { d: 'M16 2v4M8 2v4M3 10h18' }]],
    play: [['polygon', { points: '6 3 20 12 6 21 6 3' }]],
    pause: [['rect', { x: 14, y: 4, width: 4, height: 16, rx: 1 }], ['rect', { x: 6, y: 4, width: 4, height: 16, rx: 1 }]],
    x: [['path', { d: 'M18 6 6 18M6 6l12 12' }]],
    esq: [['path', { d: 'm15 18-6-6 6-6' }]],
    dir: [['path', { d: 'm9 18 6-6-6-6' }]],
    down: [['path', { d: 'm6 9 6 6 6-6' }]],
    cols: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['path', { d: 'M9 3v18M15 3v18' }]],
    dl: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }], ['path', { d: 'm7 10 5 5 5-5' }], ['path', { d: 'M12 15V3' }]]
  };
  function icone(nome, extra) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic' + (extra ? ' ' + extra : '')); s.setAttribute('aria-hidden', 'true');
    (ICONES[nome] || []).forEach(([tag, at]) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); s.appendChild(e); });
    return s;
  }
  function botao(cls, txt, ic) { const b = E('button', cls); b.type = 'button'; if (ic) b.appendChild(icone(ic)); if (txt != null) b.appendChild(E('span', '', txt)); return b; }

  /* ---------- período padrão: este mês ---------- */
  (function () { const p = dash.params(); if (!S.okDia(p.ini) || !S.okDia(p.fim)) { const m = S.presets().mes; dash.setParams({ ini: m[0], fim: m[1] }); } })();

  S.st.ord = { sdr: { k: 'realizadas', dir: -1 }, closer: { k: 'vendas', dir: -1 }, rk: { k: 'calls', dir: -1 }, nps: { k: 'nota', dir: -1 }, grav: { k: 'pend', dir: -1 } };

  /* ---------- slider (linha do tempo) ---------- */
  const KPI_MAIN = ['calls', 'realizadas', 'taxaconc', 'comp', 'noshow', 'taxans', 'leads', 'lc_ag', 'lc_taxa', 'lc_real', 'lc_ns', 'callvenda'];
  const KPI_SEC = ['remarc', 'opps', 'leadcall', 't1', 't2'];
  const DRAWS = ['prog', 'k-sec', 'k-periodo', 'vd-sub', 'vd-lista', 'lc-sub'].concat(KPI_MAIN.map(k => 'k-' + k), KPI_MAIN.map(k => 'v-' + k));
  function setIdx(i) {
    const n = S.dias().length, v = Math.max(0, Math.min(n - 1, Math.round(i)));
    if (v === S.st.idx) return;
    S.st.idx = v;
    DRAWS.forEach(k => dash.draw(k));
  }
  function iconePlay(tocando) {
    document.querySelectorAll('.sr-tlplay').forEach(b => {
      b.setAttribute('aria-pressed', String(tocando)); b.setAttribute('aria-label', tocando ? 'Pausar a progressão' : 'Reproduzir a progressão');
      b.querySelectorAll('.i-play').forEach(x => { x.hidden = tocando; }); b.querySelectorAll('.i-pause').forEach(x => { x.hidden = !tocando; });
    });
    document.querySelectorAll('.sr-tlbar').forEach(x => x.classList.toggle('ativo', tocando));
  }
  function parar() { if (S.st.timer) clearInterval(S.st.timer); S.st.timer = null; S.st.playing = false; iconePlay(false); }
  function tocar() {
    const n = S.dias().length; if (n < 2) return;
    if (S.idx() >= n - 1) setIdx(0);
    S.st.playing = true; iconePlay(true);
    S.st.timer = setInterval(() => { const m = S.dias().length; if (S.idx() >= m - 1) return parar(); setIdx(S.idx() + 1); if (S.idx() >= m - 1) parar(); }, 250);
  }

  /* ---------- controles fixos (só escutam) ---------- */
  document.querySelectorAll('[data-acao="atualizar"]').forEach(b => b.addEventListener('click', () => S.atualizar()));
  /* menu lateral: cada item mostra só a sua parte; "Visão geral" mostra tudo */
  (function () {
    const bts = [...document.querySelectorAll('[data-ir]')]; if (!bts.length) return;
    const VISOES = {
      progressao: null,
      geral: ['progressao', 'geral', 'leads-periodo', 'leads-camp'],
      vendas: ['vendas'],
      conversao: ['conversao'],
      saude: ['saude'],
      'leads-sdr': ['leads-sdr'],
      perdas: ['perdas', 'motivos'],
      'ranking-tags': ['ranking-tags', 'ranking-sdrs', 'ranking-closers'],
      'gravacoes-pendentes': ['gravacoes-pendentes', 'nps-closer'],
      origem: ['origem'],
      gestores: ['gestores'],
      analises: ['analises']
    };
    const secoes = [...document.querySelectorAll('.sr-body > section[id]')];
    const titulos = [...document.querySelectorAll('[data-tit]')];
    function mostra(id, rolar) {
      if (!(id in VISOES)) id = 'progressao';
      const lista = VISOES[id];
      secoes.forEach(sec => { const ver = !lista || lista.includes(sec.id); if (sec.hidden === ver) sec.hidden = !ver; });
      titulos.forEach(t => { t.hidden = t.getAttribute('data-tit') !== id; });
      bts.forEach(b => { const on = b.getAttribute('data-ir') === id; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      document.querySelectorAll('.sr-navg').forEach(g => {
        const sub = document.getElementById(g.getAttribute('aria-controls'));
        const tem = !!(sub && sub.querySelector('[data-ir="' + id + '"]'));
        g.classList.toggle('tem', tem);
        if (tem && sub.hidden) { sub.hidden = false; g.setAttribute('aria-expanded', 'true'); }
      });
      try { sessionStorage.setItem('sr-visao', id); } catch (e) { }
      /* redesenha o que acabou de aparecer (partes escondidas não são desenhadas) */
      const nomes = new Set();
      secoes.forEach(sec => { if (!sec.hidden) sec.querySelectorAll('[data-draw]').forEach(d => nomes.add(d.getAttribute('data-draw'))); });
      nomes.forEach(n => { try { dash.draw(n); } catch (e) { } });
      if (rolar) { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
    }
    bts.forEach(b => b.addEventListener('click', () => mostra(b.getAttribute('data-ir'), true)));
    /* grupos do menu: abrir/fechar e destacar o grupo da parte atual */
    document.querySelectorAll('.sr-navg').forEach(g => g.addEventListener('click', () => {
      const sub = document.getElementById(g.getAttribute('aria-controls')); if (!sub) return;
      const abrir = g.getAttribute('aria-expanded') !== 'true';
      g.setAttribute('aria-expanded', String(abrir)); sub.hidden = !abrir;
    }));
    let ini = 'progressao'; try { ini = sessionStorage.getItem('sr-visao') || ini; } catch (e) { }
    mostra(ini, false);
  })();

  /* modo claro / escuro (escolha guardada só neste navegador) */
  (function () {
    const raiz = document.querySelector('.sr'); if (!raiz) return;
    let esc = false;
    try { esc = localStorage.getItem('sr-tema') === 'escuro'; } catch (e) { }
    const aplica = () => {
      raiz.classList.toggle('escuro', esc);
      document.querySelectorAll('[data-acao="tema"]').forEach(b => { b.setAttribute('aria-pressed', String(esc)); b.setAttribute('aria-label', esc ? 'Usar modo claro' : 'Usar modo escuro'); });
    };
    aplica();
    document.querySelectorAll('[data-acao="tema"]').forEach(b => b.addEventListener('click', () => {
      esc = !esc;
      try { localStorage.setItem('sr-tema', esc ? 'escuro' : 'claro'); } catch (e) { }
      aplica(); dash.draw('matriz'); dash.draw('horas');
    }));
  })();
  document.querySelectorAll('[data-acao="filtros"]').forEach(b => b.addEventListener('click', () => abrirFiltros()));
  const menu = document.getElementById('menu-exportar');
  document.querySelectorAll('[data-acao="exportar"]').forEach(b => b.addEventListener('click', () => {
    if (!menu) return; menu.hidden = !menu.hidden; b.setAttribute('aria-expanded', String(!menu.hidden));
  }));
  document.addEventListener('pointerdown', ev => {
    if (menu && !menu.hidden && !(ev.target.closest && ev.target.closest('.sr-menuwrap'))) { menu.hidden = true; document.querySelectorAll('[data-acao="exportar"]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  });
  document.querySelectorAll('[data-exp]').forEach(b => b.addEventListener('click', () => {
    if (menu) menu.hidden = true;
    const t = b.getAttribute('data-exp');
    if (t === 'xlsx') relatorio(); else if (t === 'criativo') porCriativo(); else baseCSV();
  }));
  document.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
    const k = S.kpis(); if (!k) return;
    const id = b.getAttribute('data-m');
    if (id === 'vendas' || id === 'valor') { const v = vendasK(); if (!v) return; S.abrir({ titulo: id === 'valor' ? 'Vendas com valor' : 'Vendas', rows: id === 'valor' ? v.cur.comValor : v.cur.vendas, kind: 'l', cols: DC_VENDA, periodo: [v.a, v.b] }); return; }
    S.abrirMetrica(id, k.cur, { periodo: [k.a, k.b] });
  }));
  document.querySelectorAll('#sr-rk').forEach(s => s.addEventListener('change', () => { S.st.ord.rk = { k: 'calls', dir: -1 }; dash.setParams({ rk: s.value === 'tag' ? null : s.value }); }));
  document.querySelectorAll('#ord-sdr').forEach(s => s.addEventListener('change', () => { S.st.ord.sdr = { k: s.value, dir: -1 }; dash.draw('rk-sdr'); }));
  document.querySelectorAll('#ord-closer').forEach(s => s.addEventListener('change', () => { S.st.ord.closer = { k: s.value, dir: -1 }; dash.draw('rk-closer'); }));
  document.querySelectorAll('[data-hm]').forEach(b => b.addEventListener('click', () => dash.setParams({ hm: b.getAttribute('data-hm') === 'comp' ? 'comp' : null })));
  document.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => { const a = b.getAttribute('data-aba'); dash.setParams({ aba: a === 'funil' ? null : a }); }));
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { if (S.st.perfil) fecharPerfil(); else if (S.st.dr) S.fechar(); else if (S.st.painel) fecharFiltros(); } });

  /* ---------- atualização automática: a cada 5 min e ao voltar para a aba ---------- */
  setInterval(() => S.atualizar(), 5 * 60 * 1000);
  const aoFocar = () => { if (document.visibilityState === 'visible' && (!S.st.ultima || Date.now() - S.st.ultima > 60 * 1000)) S.atualizar(); };
  document.addEventListener('visibilitychange', aoFocar);
  window.addEventListener('focus', aoFocar);
  setInterval(() => dash.draw('atualizado'), 30 * 1000);

  let ultimaRef = null;
  const ABAS = ['funil', 'matriz', 'horas', 'perdas', 'pipeline'];
  dash.onData(() => {
    const b = dash.data('base_unificada');
    if (b.status === 'ok' && b.data !== ultimaRef) { ultimaRef = b.data; S.st.ultima = Date.now(); S.st.atualizando = false; }
    if (b.status === 'error') S.st.atualizando = false;
    const q = S.per(), key = q.ini + '|' + q.fim, p = dash.params();
    if (key !== S.st.key) { S.st.key = key; parar(); S.st.idx = null; }
    document.querySelectorAll('[data-hm]').forEach(x => { const on = (x.getAttribute('data-hm') === 'comp') === (p.hm === 'comp'); x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('#sr-rk').forEach(s => { if (document.activeElement !== s) s.value = p.rk || 'tag'; });
    const aba = ABAS.includes(p.aba) ? p.aba : 'funil';
    document.querySelectorAll('[data-aba]').forEach(x => x.setAttribute('aria-selected', String(x.getAttribute('data-aba') === aba)));
    document.querySelectorAll('[data-pane]').forEach(x => { x.hidden = x.getAttribute('data-pane') !== aba; });
    const n = nFiltros(), fr = S.filtroReuniao();
    document.querySelectorAll('[data-acao="filtros"]').forEach(x => x.classList.toggle('on', n > 0));
  });

  /* =================== CABEÇALHO =================== */
  dash.draw('atualizado', el => {
    if (S.st.atualizando) { el.textContent = 'Atualizando…'; return; }
    if (!S.st.ultima) { el.textContent = 'Carregando dados…'; return; }
    const d = new Date(S.st.ultima);
    el.textContent = `Atualizado às ${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`;
  });
  function nFiltros() { return Object.values(S.filtros()).reduce((a, v) => a + v.length, 0) + (S.filtroReuniao() ? 1 : 0); }
  dash.draw('nfiltros', el => { const n = nFiltros(); el.textContent = n ? `(${n})` : ''; });

  /* campo único de data: atalhos + calendário duplo + data base */
  const ATALHOS = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7', 'Últimos 7 dias'], ['mes', 'Este mês'], ['mesant', 'Mês passado']];
  dash.draw('periodo', {
    mount(el) {
      const btn = E('button', 'sr-date'); btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
      const lab = E('span'), db = E('span', 'db');
      btn.append(icone('cal'), lab, db, icone('down'));
      const pop = E('div', 'sr-pop sr-datepop'); pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Escolher período');
      const at = E('div', 'sr-atalhos'), meses = E('div', 'sr-meses');
      const foot = E('div', 'sr-popfoot');
      const lb = E('label'); lb.appendChild(document.createTextNode('Data base'));
      const sel = E('select', 'sr-sel'); sel.append(new Option('Agendamento', 'ag'), new Option('Reunião', 're')); lb.appendChild(sel);
      const bts = E('div', 'bts'); const canc = botao('sr-btn', 'Cancelar'), apl = botao('sr-btn prim', 'Aplicar'); bts.append(canc, apl);
      foot.append(lb, bts);
      pop.append(at, meses, foot);
      el.append(btn, pop);
      const m = { btn, lab, db, pop, at, meses, sel, tmp: null, primeiro: null, hover: null, view: null };
      m.mes = (base, lado) => {
        const y = base.getFullYear(), mo = base.getMonth();
        const box = E('div', 'sr-mes'), head = E('div', 'sr-meshead');
        const pv = botao('sr-navm' + (lado === 'esq' ? '' : ' vazio'), null, 'esq'); pv.setAttribute('aria-label', 'Mês anterior');
        const nx = botao('sr-navm' + (lado === 'dir' ? '' : ' vazio'), null, 'dir'); nx.setAttribute('aria-label', 'Próximo mês');
        pv.addEventListener('click', () => { m.view = new Date(m.view.getFullYear(), m.view.getMonth() - 1, 1); m.render(); });
        nx.addEventListener('click', () => { m.view = new Date(m.view.getFullYear(), m.view.getMonth() + 1, 1); m.render(); });
        head.append(pv, E('span', '', `${S.MESL[mo]} ${y}`), nx);
        const g = E('div', 'sr-cgrid');
        ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].forEach(t => g.appendChild(E('span', 'sr-wd', t)));
        const off = (new Date(y, mo, 1).getDay() + 6) % 7, h = S.hoje();
        let a = m.tmp.ini, b = m.tmp.fim;
        if (m.primeiro) { const x = m.hover || m.primeiro; a = m.primeiro < x ? m.primeiro : x; b = m.primeiro < x ? x : m.primeiro; }
        for (let k = 0; k < 42; k++) {
          const d = S.iso(new Date(y, mo, 1 - off + k));
          const bt = E('button', 'sr-d', String(Number(d.slice(8)))); bt.type = 'button'; bt.setAttribute('aria-label', S.fData(d));
          if (Number(d.slice(5, 7)) !== mo + 1) { bt.classList.add('out'); bt.tabIndex = -1; }
          if (d > a && d < b) bt.classList.add('in');
          if (d === a) bt.classList.add('ini');
          if (d === b) bt.classList.add('fim');
          if (d === h) bt.classList.add('hoje');
          bt.addEventListener('click', () => {
            if (!m.primeiro) { m.primeiro = d; m.hover = d; m.render(); return; }
            m.tmp.ini = m.primeiro < d ? m.primeiro : d; m.tmp.fim = m.primeiro < d ? d : m.primeiro; m.primeiro = null; m.hover = null; m.render();
          });
          bt.addEventListener('pointerenter', () => { if (m.primeiro && m.hover !== d) { m.hover = d; m.render(); } });
          g.appendChild(bt);
        }
        box.append(head, g);
        return box;
      };
      m.render = () => {
        const pr = S.presets();
        m.at.replaceChildren(...ATALHOS.map(([k, t]) => {
          const b = botao(!m.primeiro && pr[k][0] === m.tmp.ini && pr[k][1] === m.tmp.fim ? 'on' : '', t);
          b.addEventListener('click', () => { m.tmp.ini = pr[k][0]; m.tmp.fim = pr[k][1]; m.primeiro = null; m.hover = null; m.view = S.parse(pr[k][0]); m.view.setDate(1); m.render(); });
          return b;
        }));
        const dir = new Date(m.view.getFullYear(), m.view.getMonth() + 1, 1);
        m.meses.replaceChildren(m.mes(m.view, 'esq'), m.mes(dir, 'dir'));
      };
      m.open = () => {
        const q = S.per();
        m.tmp = { ini: q.ini, fim: q.fim }; m.primeiro = null; m.hover = null;
        m.view = S.parse(q.ini); m.view.setDate(1);
        m.sel.value = dash.params().db === 're' ? 're' : 'ag';
        m.pop.hidden = false; m.btn.setAttribute('aria-expanded', 'true'); m.render();
      };
      m.close = () => { m.pop.hidden = true; m.btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', () => (m.pop.hidden ? m.open() : m.close()));
      canc.addEventListener('click', () => m.close());
      apl.addEventListener('click', () => {
        let ini = m.tmp.ini, fim = m.tmp.fim;
        if (m.primeiro) { ini = m.primeiro; fim = m.primeiro; }
        m.close(); dash.setParams({ ini, fim, db: m.sel.value === 're' ? 're' : null, fr_ini: null, fr_fim: null });
      });
      m.onDoc = ev => { if (!m.pop.hidden && !el.contains(ev.target)) m.close(); };
      m.onKey = ev => { if (ev.key === 'Escape' && !m.pop.hidden) { m.close(); m.btn.focus(); } };
      document.addEventListener('pointerdown', m.onDoc); document.addEventListener('keydown', m.onKey);
      return m;
    },
    update(el, m) {
      const q = S.per();
      m.lab.textContent = `${S.fData(q.ini)} – ${S.fData(q.fim)}`;
      m.db.textContent = dash.params().db === 're' || S.filtroReuniao() ? 'Reunião' : 'Agendamento';
    },
    unmount(el, m) { document.removeEventListener('pointerdown', m.onDoc); document.removeEventListener('keydown', m.onKey); }
  });

  dash.draw('ativos', el => {
    const f = S.filtros(), out = [], fr = S.filtroReuniao();
    if (fr) {
      const c = E('span', 'sr-ativo'); c.append(E('span', 'd', 'Data da reunião:'), E('span', 'v', S.fDataRe(fr)));
      const x = botao('x', null, 'x'); x.setAttribute('aria-label', 'Remover filtro de data da reunião');
      x.addEventListener('click', () => dash.setParams({ fr_ini: null, fr_fim: null }));
      c.appendChild(x); out.push(c);
    }
    for (const dim in f) f[dim].forEach(k => {
      const c = E('span', 'sr-ativo'); c.append(E('span', 'd', S.DIMS[dim].nome + ':'), E('span', 'v', S.rotulo(dim, k)));
      const x = botao('x', null, 'x'); x.setAttribute('aria-label', 'Remover filtro ' + S.rotulo(dim, k));
      x.addEventListener('click', () => S.tiraFiltro(dim, k));
      c.appendChild(x); out.push(c);
    });
    if (out.length) { const l = botao('limpar', 'Limpar filtros'); l.addEventListener('click', () => S.limpaFiltros()); out.push(l); }
    el.replaceChildren(...out);
  });

  /* painel lateral de filtros (seleciona e só aplica no fim) */
  function abrirFiltros() {
    S.fechar();
    const fr = S.filtroReuniao();
    S.st.painel = { fx: Object.fromEntries(S.FDIMS.map(d => [d, new Set(S.filtros()[d] || [])])), q: {}, abertos: new Set(Object.keys(S.filtros()).concat(['data'])), fr: fr ? { a: fr.a, b: fr.b } : { a: '', b: '' } };
    document.querySelectorAll('.sr').forEach(e => { e.classList.add('painel-on'); e.classList.remove('drill-on'); });
    document.querySelectorAll('[data-draw="painel"]').forEach(e => { e.hidden = false; });
    dash.draw('painel');
  }
  function fecharFiltros() {
    S.st.painel = null;
    document.querySelectorAll('.sr').forEach(e => e.classList.remove('painel-on'));
    document.querySelectorAll('[data-draw="painel"]').forEach(e => { e.hidden = true; });
  }
  function valoresDim(dim) {
    const D = S.dados(); if (!D.ok) return [];
    const q = S.per(), cnt = new Map(), f = S.filtros();
    D.calls.forEach(r => { if (r._dia >= q.ini && r._dia <= q.fim && S.passa(r, 'c', dim, f)) cnt.set(r._k[dim], (cnt.get(r._k[dim]) || 0) + 1); });
    D.leads.forEach(x => { if (x._ld >= q.ini && x._ld <= q.fim && S.passa(x, 'l', dim, f) && !cnt.has(x._k[dim])) cnt.set(x._k[dim], 0); });
    (f[dim] || []).forEach(k => { if (!cnt.has(k)) cnt.set(k, 0); });
    return [...cnt].map(([k, n]) => ({ k, n, t: S.rotulo(dim, k) })).sort((a, b) => b.n - a.n || a.t.localeCompare(b.t));
  }
  const qtdTxt = n => (n ? `${n} selecionado${n > 1 ? 's' : ''}` : 'Todos');
  dash.draw('painel', {
    mount(el) {
      const h = E('div', 'sr-sideh'); const x = botao('sr-btn ico', null, 'x'); x.setAttribute('aria-label', 'Fechar filtros');
      h.append(E('h2', 'sr-sidet', 'Filtros'), x);
      const body = E('div', 'sr-sideb');
      const foot = E('div', 'sr-sidef'); const lim = botao('sr-btn', 'Limpar'), apl = botao('sr-btn prim', 'Aplicar'); foot.append(lim, apl);
      el.append(h, body, foot);
      x.addEventListener('click', () => fecharFiltros());
      lim.addEventListener('click', () => { const p = S.st.painel; if (!p) return; S.FDIMS.forEach(d => p.fx[d].clear()); p.fr = { a: '', b: '' }; dash.draw('painel'); });
      apl.addEventListener('click', () => {
        const p = S.st.painel; if (!p) return;
        const o = {}; S.FDIMS.forEach(d => { const v = [...p.fx[d]]; o['f_' + d] = v.length ? v : null; });
        const a = S.okDia(p.fr.a) ? p.fr.a : (S.okDia(p.fr.b) ? p.fr.b : null);
        let b = S.okDia(p.fr.b) ? p.fr.b : a;
        if (a && b < a) { o.fr_ini = b; o.fr_fim = a; } else { o.fr_ini = a; o.fr_fim = a ? b : null; }
        fecharFiltros(); dash.setParams(o);
      });
      return { body };
    },
    update(el, m) {
      const p = S.st.painel; if (!p) { m.body.replaceChildren(); return; }
      /* data da reunião */
      const dd = E('details', 'sr-fdim'); dd.open = p.abertos.has('data');
      const ds = E('summary'); const dq = E('span', 'q');
      const atual = () => { const tem = S.okDia(p.fr.a) || S.okDia(p.fr.b); dq.textContent = tem ? (p.fr.b && p.fr.b !== p.fr.a ? `${S.fData(p.fr.a || p.fr.b)} a ${S.fData(p.fr.b)}` : S.fData(p.fr.a || p.fr.b)) : 'Qualquer data'; dq.classList.toggle('on', tem); };
      ds.append(E('span', '', 'Data da reunião'), dq);
      const db = E('div', 'sr-fdimb');
      const linha = E('div', 'sr-row');
      const campo = (rot, k) => {
        const lb = E('label', 'sr-lbl'); lb.appendChild(document.createTextNode(rot));
        const i = E('input', 'sr-busca'); i.type = 'date'; i.min = '2024-01-01'; i.max = '2030-12-31'; i.value = p.fr[k] || ''; i.style.flex = '0 0 150px';
        i.addEventListener('change', () => { if (!i.value) { p.fr[k] = ''; atual(); return; } if (i.validity.valid) { p.fr[k] = i.value; if (k === 'a' && (!p.fr.b || p.fr.b < i.value)) { p.fr.b = i.value; fim.value = i.value; } atual(); } });
        lb.appendChild(i); linha.appendChild(lb); return i;
      };
      const ini = campo('De', 'a'), fim = campo('Até', 'b');
      const atalhos = E('div', 'sr-row');
      [['Ontem', -1], ['Hoje', 0], ['Amanhã', 1]].forEach(([t2, n]) => {
        const b = botao('sr-btn', t2); b.style.height = '28px';
        b.addEventListener('click', () => { const d = S.addDias(S.hoje(), n); p.fr = { a: d, b: d }; ini.value = d; fim.value = d; atual(); });
        atalhos.appendChild(b);
      });
      const limpaD = botao('sr-link', 'Limpar data'); limpaD.addEventListener('click', () => { p.fr = { a: '', b: '' }; ini.value = ''; fim.value = ''; atual(); });
      atalhos.appendChild(limpaD);
      db.append(linha, atalhos, E('p', 'sr-hint', 'Filtra a página inteira pelas reuniões marcadas para esse dia (ou intervalo). Enquanto estiver ativo, o período do topo passa a ser essa data.'));
      dd.append(ds, db);
      dd.addEventListener('toggle', () => { if (dd.open) p.abertos.add('data'); else p.abertos.delete('data'); });
      atual();
      m.body.replaceChildren(dd, ...S.FDIMS.map(dim => {
        const det = E('details', 'sr-fdim'); det.open = p.abertos.has(dim);
        const sum = E('summary'); const qtd = E('span', 'q' + (p.fx[dim].size ? ' on' : ''), qtdTxt(p.fx[dim].size));
        sum.append(E('span', '', S.DIMS[dim].nome), qtd);
        const box = E('div', 'sr-fdimb');
        const busca = E('input', 'sr-busca'); busca.type = 'search'; busca.placeholder = 'Buscar…'; busca.value = p.q[dim] || ''; busca.setAttribute('aria-label', 'Buscar em ' + S.DIMS[dim].nome);
        const lista = E('div', 'sr-flista');
        const desenhaLista = () => {
          const q = S.norm(busca.value);
          const vs = valoresDim(dim).filter(v => !q || S.norm(v.t).includes(q)).slice(0, 150);
          if (!vs.length) { lista.replaceChildren(E('div', 'sr-empty', 'Nada encontrado.')); return; }
          lista.replaceChildren(...vs.map(v => {
            const lb = E('label', 'sr-opt'); const cb = E('input'); cb.type = 'checkbox'; cb.checked = p.fx[dim].has(v.k);
            cb.addEventListener('change', () => { if (cb.checked) p.fx[dim].add(v.k); else p.fx[dim].delete(v.k); qtd.textContent = qtdTxt(p.fx[dim].size); qtd.classList.toggle('on', p.fx[dim].size > 0); });
            lb.append(cb, E('span', 't', v.t), E('span', 'c', S.fInt(v.n)));
            return lb;
          }));
        };
        busca.addEventListener('input', () => { p.q[dim] = busca.value; desenhaLista(); });
        det.addEventListener('toggle', () => { if (det.open) { p.abertos.add(dim); if (!lista.childNodes.length) desenhaLista(); } else p.abertos.delete(dim); });
        if (det.open) desenhaLista();
        box.append(busca, lista);
        det.append(sum, box);
        return det;
      }));
    }
  });

  /* =================== [A] KPIs =================== */
  dash.draw('k-periodo', el => { const k = S.kpis(); el.textContent = k ? `${S.fData(k.a)} a ${S.fData(k.b)} · comparado com ${S.fData(k.pa)} a ${S.fData(k.pb)} · pela data ${dash.params().db === 're' ? 'da reunião' : 'do agendamento'}` : ''; });
  KPI_MAIN.forEach(id => {
    const t = S.MET[id];
    dash.draw('k-' + id, el => {
      const k = S.kpis();
      if (!k) { if (S.dados().status !== 'loading') el.classList.remove('dash-skeleton'); el.__v = undefined; el.textContent = '—'; return; }
      el.classList.remove('dash-skeleton');
      S.contar(el, t.v(k.cur), t.f);
    });
    dash.draw('v-' + id, el => {
      const k = S.kpis(); el.classList.remove('up', 'down'); el.removeAttribute('data-tip');
      if (!k) { el.textContent = ''; return; }
      const v = S.variacao(id, t.v(k.cur), t.v(k.prev), k.prev);
      if (v.dir > 0) el.classList.add('up'); if (v.dir < 0) el.classList.add('down');
      el.textContent = v.txt;
      if (v.semBase) el.setAttribute('data-tip', 'sem base de comparação');
    });
  });
  dash.draw('k-sec', el => {
    const k = S.kpis(); if (!k) { el.replaceChildren(); return; }
    const out = [];
    KPI_SEC.forEach((id, i) => {
      const t = S.MET[id];
      if (i) out.push(E('span', 'sep', '·'));
      const b = botao('it'); b.replaceChildren(E('span', '', t.nome), E('b', '', t.f(t.v(k.cur))));
      b.title = t.info;
      b.addEventListener('click', () => S.abrirMetrica(id, k.cur, { periodo: [k.a, k.b] }));
      out.push(b);
    });
    el.replaceChildren(...out);
  });

  /* =================== LEADS DO PERÍODO =================== */
  dash.draw('lc-sub', el => {
    const k = S.kpis(); if (!k) { el.replaceChildren(); return; }
    const c = k.cur.coorte, per = { periodo: [k.a, k.b] };
    const b1 = E('button', 'it'); b1.type = 'button'; b1.replaceChildren(E('span', '', 'Agendaram depois do dia'), E('b', '', S.fInt(c.depois.length)));
    b1.title = 'Leads criados no dia que só agendaram a call depois dele.';
    b1.addEventListener('click', () => S.abrir(Object.assign({ titulo: 'Leads que agendaram depois do dia', rows: c.depois, kind: 'l' }, per)));
    const b2 = E('button', 'it'); b2.type = 'button'; b2.replaceChildren(E('span', '', 'Ainda sem call'), E('b', '', S.fInt(c.semCall.length)));
    b2.title = 'Leads criados no dia que ainda não têm nenhuma call agendada.';
    b2.addEventListener('click', () => S.abrir(Object.assign({ titulo: 'Leads ainda sem call', rows: c.semCall, kind: 'l' }, per)));
    el.replaceChildren(b1, E('span', 'sep', '·'), b2);
  });

  /* =================== VENDAS (dobra própria) ===================
     Vendas e valor vêm da aba negócios: oportunidade do funil CLOSER em "Negócio Vendido"
     (ou resultado ganho), pela data de fechamento, tenha ou não call. */
  const DC_VENDA = ['lead_nome', 'data_fechamento', 'closer_nome', 'sdr_origem_nome', 'tag_principal', 'valor', 'modelo_franquia', 'data_criacao'];
  function vendasEntre(a, b) {
    const todos = negocios(); if (!todos) return null;
    const f = S.filtros();
    const vendas = todos.filter(o => o._venda && o._df && o._df >= a && o._df <= b && S.passa(o, 'l', null, f));
    const comValor = vendas.filter(o => o.valor > 0);
    return { vendas, comValor, semValor: vendas.filter(o => !(o.valor > 0)), semCall: vendas.filter(o => !o._call), valor: d3.sum(comValor, o => o.valor) };
  }
  function vendasK() {
    const k = S.kpis(); if (!k) return null;
    const cur = vendasEntre(k.a, k.b), prev = vendasEntre(k.pa, k.pb); if (!cur) return null;
    return { cur, prev, a: k.a, b: k.b };
  }
  const varV = (a, b, n) => { if (!n || b == null || b === 0 || a == null) return { txt: '—', dir: 0 }; if (a === b) return { txt: '= vs período anterior', dir: 0 }; const d = a > b ? 1 : -1; return { txt: `${d > 0 ? '▲' : '▼'} ${S.fPct(Math.abs(a - b) / Math.abs(b))} vs período anterior`, dir: d }; };
  [['vendas', v => v.vendas.length, S.fInt], ['valor', v => v.valor, S.fBRL]].forEach(([id, val, fmt]) => {
    dash.draw('k-' + id, el => {
      const v = vendasK();
      if (!v) { if (S.dados().status !== 'loading' && dash.data('negocios') && dash.data('negocios').status !== 'loading') el.classList.remove('dash-skeleton'); el.__v = undefined; el.textContent = '—'; return; }
      el.classList.remove('dash-skeleton'); S.contar(el, val(v.cur), fmt);
    });
    dash.draw('v-' + id, el => {
      const v = vendasK(); el.classList.remove('up', 'down'); el.removeAttribute('data-tip');
      if (!v) { el.textContent = ''; return; }
      const r = varV(val(v.cur), val(v.prev), v.prev.vendas.length);
      if (r.dir > 0) el.classList.add('up'); if (r.dir < 0) el.classList.add('down');
      el.textContent = r.txt;
    });
  });

  function itemLinha(nome, valor, tip, abrir) {
    const b = botao('it'); b.replaceChildren(E('span', '', nome), E('b', '', valor));
    if (tip) b.title = tip;
    if (abrir) b.addEventListener('click', abrir); else b.disabled = true;
    return b;
  }
  dash.draw('vd-sub', el => {
    const k = S.kpis(); if (!k) { el.replaceChildren(); return; }
    const m = k.cur, ab = m.opps.filter(r => r._res === 'aberto'), V = vendasK();
    const per = { periodo: [k.a, k.b] };
    const vc = V ? V.cur : { vendas: [], comValor: [], semValor: [], semCall: [], valor: 0 };
    const abreV = (titulo, rows) => () => S.abrir({ titulo, rows, kind: 'l', cols: DC_VENDA, periodo: [k.a, k.b] });
    const itens = [
      itemLinha('Ticket médio', vc.comValor.length ? S.fBRL(vc.valor / vc.comValor.length) : '—', 'Valor vendido ÷ vendas com valor preenchido.', vc.comValor.length ? abreV('Vendas com valor', vc.comValor) : null),
      itemLinha('Reunião → Fechamento', S.MET.t3.f(S.MET.t3.v(m)), S.MET.t3.info, () => S.abrirMetrica('t3', m, per)),
      itemLinha('Oportunidades em aberto', S.fInt(ab.length), 'Oportunidades das calls do período ainda sem resultado.', () => S.abrir(Object.assign({ titulo: 'Oportunidades em aberto', rows: ab }, per))),
      itemLinha('Perdidas', S.fInt(m.perdidas.length), 'Oportunidades das calls do período com resultado perdido.', () => S.abrir(Object.assign({ titulo: 'Oportunidades perdidas', rows: m.perdidas }, per))),
      itemLinha('Vendas sem valor no CRM', S.fInt(vc.semValor.length), 'Vendas sem o campo valor preenchido: ficam fora do valor vendido e do ticket médio.', vc.semValor.length ? abreV('Vendas sem valor', vc.semValor) : null),
      itemLinha('Vendas sem call', S.fInt(vc.semCall.length), 'Vendas do período cujo lead não tem call válida no relatório (sem reunião, sem data da reunião ou sem closer).', vc.semCall.length ? abreV('Vendas sem call', vc.semCall) : null)
    ];
    const out = []; itens.forEach((b, i) => { if (i) out.push(E('span', 'sep', '·')); out.push(b); });
    el.replaceChildren(...out);
  });
  dash.draw('vd-lista', el => {
    const V = vendasK(), D = S.dados();
    if (!V) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const k = V;
    const vs = V.cur.vendas.slice().sort((a, b) => (b.data_fechamento || '').localeCompare(a.data_fechamento || ''));
    if (!vs.length) { S.vazio(el, 'Nenhuma venda fechada no período.'); return; }
    const tbl = E('table', 'sr-t'); tbl.setAttribute('data-source', 'base_unificada');
    const trh = E('tr'); [['Fechamento', ''], ['Cliente', ''], ['Closer', ''], ['SDR de origem', ''], ['Tag de campanha', ''], ['Valor', 'n']].forEach(([t, c]) => trh.appendChild(E('th', c, t)));
    const th = E('thead'); th.appendChild(trh); const tb = E('tbody');
    vs.slice(0, 8).forEach(r => {
      const tr = E('tr');
      const tdn = E('td', 'nome'); const bn = E('button', 'sr-cell nm sr-plink', S.limpa(r.lead_nome) || 'Sem nome'); bn.type = 'button'; bn.title = 'Ver o perfil completo do lead'; bn.addEventListener('click', () => abrirPerfil(r.lead_id)); tdn.appendChild(bn);
      tr.append(E('td', '', S.fData(r.data_fechamento) || '—'), tdn, E('td', '', S.limpa(r.closer_nome) || '—'),
        E('td', '', S.limpa(r.sdr_origem_nome) || '—'), E('td', '', S.limpa(r.tag_principal) || '—'), E('td', 'n', Number(r.valor) > 0 ? S.fBRL(Number(r.valor)) : '—'));
      tb.appendChild(tr);
    });
    tbl.append(th, tb);
    const w = E('div', 'sr-tw'); w.appendChild(tbl);
    const ver = E('button', 'sr-link', vs.length > 8 ? `Ver as ${S.fInt(vs.length)} vendas` : 'Abrir a lista de vendas'); ver.type = 'button';
    ver.addEventListener('click', () => S.abrir({ titulo: 'Vendas', rows: vs, kind: 'l', cols: DC_VENDA, periodo: [k.a, k.b] }));
    el.replaceChildren(w, ver);
  });

  /* =================== [B] PROGRESSÃO =================== */
  dash.draw('prog', {
    mount(el) {
      const chart = E('div', 'sr-chart');
      const tl = E('div', 'sr-tl');
      const play = E('button', 'sr-tlplay'); play.type = 'button'; play.setAttribute('aria-label', 'Reproduzir a progressão'); play.setAttribute('aria-pressed', 'false');
      const ip = icone('play', 'i-play'), ipa = icone('pause', 'i-pause'); ipa.setAttribute('hidden', ''); play.append(ip, ipa);
      const bar = E('div', 'sr-tlbar'), track = E('div', 'sr-tltrack'), fill = E('div', 'sr-tlfill'), tip = E('div', 'sr-tltip');
      const h = E('div', 'sr-tlh'); h.tabIndex = 0; h.setAttribute('role', 'slider'); h.setAttribute('aria-label', 'Data da progressão');
      bar.append(track, fill, tip, h); tl.append(play, bar);
      el.append(tl, chart);
      const m = { chart, play, bar, fill, tip, h, off: false };
      play.addEventListener('click', () => (S.st.playing ? parar() : tocar()));
      const idxAt = x => { const r = bar.getBoundingClientRect(), n = S.dias().length; if (n < 2 || !r.width) return 0; return Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * (n - 1)); };
      bar.addEventListener('pointerdown', ev => { if (m.off) return; parar(); if (bar.setPointerCapture) bar.setPointerCapture(ev.pointerId); bar.classList.add('drag'); h.focus({ preventScroll: true }); setIdx(idxAt(ev.clientX)); ev.preventDefault(); });
      bar.addEventListener('pointermove', ev => { if (bar.classList.contains('drag')) setIdx(idxAt(ev.clientX)); });
      const solta = () => bar.classList.remove('drag');
      bar.addEventListener('pointerup', solta); bar.addEventListener('pointercancel', solta);
      h.addEventListener('keydown', ev => {
        if (m.off) return;
        const i = S.idx(), n = S.dias().length;
        const mapa = { ArrowRight: i + 1, ArrowUp: i + 1, ArrowLeft: i - 1, ArrowDown: i - 1, Home: 0, End: n - 1, PageUp: i + 7, PageDown: i - 7 };
        if (ev.key in mapa) { parar(); setIdx(mapa[ev.key]); ev.preventDefault(); }
      });
      return m;
    },
    update(el, m) {
      const D = S.dados(), F = S.full(), host = m.chart;
      host.replaceChildren();
      const ds = S.dias(), i = S.idx(), n = ds.length;
      m.off = !D.ok || n < 2;
      m.play.disabled = m.off; m.h.tabIndex = m.off ? -1 : 0; m.h.setAttribute('aria-disabled', String(m.off));
      if (!D.ok || !F) { S.vazio(host, S.estado(D)); m.bar.hidden = true; return; }
      const por = new Map(ds.map(d => [d, { dia: d, realizada: 0, agendada: 0, no_show: 0, cancelada: 0, tot: 0, rows: [] }]));
      F.calls.forEach(r => { const o = por.get(r._dia); if (o) { if (o[r._g] != null) o[r._g]++; o.tot++; o.rows.push(r); } });
      let ac = 0; const data = ds.map(d => { const o = por.get(d); ac += o.tot; o.acum = ac; return o; });
      if (!ac) { S.vazio(host, 'Nenhuma call no período.'); m.bar.hidden = true; return; }
      m.bar.hidden = false;
      const W = Math.max(280, host.clientWidth), H = 240, mt = 8, mb = 22;
      const y = d3.scaleLinear().domain([0, Math.max(1, d3.max(data, d => d.tot))]).nice(4).range([H - mb, mt]);
      const y2 = d3.scaleLinear().domain([0, Math.max(1, ac)]).nice(4).range([H - mb, mt]);
      const svg = d3.select(host).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`)
        .attr('role', 'img').attr('aria-label', `Calls por dia por status e acumuladas de ${S.fData(ds[0])} até ${S.fData(ds[i])}.`);
      const gl = svg.append('g').call(d3.axisLeft(y).ticks(4).tickSize(0).tickFormat(S.fInt));
      const gr = svg.append('g').call(d3.axisRight(y2).ticks(4).tickSize(0).tickFormat(S.fInt));
      let wl = 0, wr = 0;
      gl.selectAll('text').each(function () { wl = Math.max(wl, this.getComputedTextLength()); });
      gr.selectAll('text').each(function () { wr = Math.max(wr, this.getComputedTextLength()); });
      const ml = Math.max(28, Math.ceil(wl) + 10), mr = Math.ceil(wr) + 10;
      gl.attr('transform', `translate(${ml},0)`).call(g => g.select('.domain').remove()).selectAll('text').attr('x', -6);
      gr.attr('transform', `translate(${W - mr},0)`).call(g => g.select('.domain').remove()).selectAll('text').attr('x', 6);
      const x = d3.scaleBand().domain(ds).range([ml, W - mr]);
      const cx = d => x(d) + x.bandwidth() / 2, bw = Math.max(2, Math.min(16, x.bandwidth() * 0.6));
      svg.insert('g', ':first-child').selectAll('line').data(y.ticks(4)).join('line').attr('x1', ml).attr('x2', W - mr).attr('y1', d => y(d)).attr('y2', d => y(d)).style('stroke', BORDA);
      const xCur = cx(ds[i]);
      if (i < n - 1) svg.insert('rect', ':first-child').attr('x', xCur + x.step() / 2).attr('y', mt).attr('width', Math.max(0, W - mr - xCur - x.step() / 2)).attr('height', H - mb - mt).style('fill', 'var(--futuro)');
      const passo = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - ml - mr) / 52))));
      svg.append('g').attr('transform', `translate(0,${H - mb})`).call(d3.axisBottom(x).tickValues(ds.filter((d, k) => k % passo === 0)).tickFormat(S.fDM).tickSize(0))
        .call(g => g.select('.domain').style('stroke', BORDA)).selectAll('text').attr('dy', '1.1em');
      const series = d3.stack().keys(KEYS)(data);
      /* leve efeito 3D: sombra suave e brilho lateral nas colunas */
      const defs = svg.append('defs');
      const sh = defs.append('filter').attr('id', 'sr-sombra').attr('x', '-20%').attr('y', '-10%').attr('width', '150%').attr('height', '130%');
      sh.append('feDropShadow').attr('dx', 1.5).attr('dy', 3).attr('stdDeviation', 2.2).attr('flood-color', '#101828').attr('flood-opacity', 0.26);
      const shl = defs.append('filter').attr('id', 'sr-sombra-linha').attr('x', '-5%').attr('y', '-20%').attr('width', '110%').attr('height', '160%');
      shl.append('feDropShadow').attr('dx', 0).attr('dy', 2).attr('stdDeviation', 2.2).attr('flood-color', '#120251').attr('flood-opacity', 0.3);
      const lg = defs.append('linearGradient').attr('id', 'sr-brilho').attr('x1', 0).attr('x2', 1).attr('y1', 0).attr('y2', 0);
      [[0, '#fff', 0.38], [0.4, '#fff', 0.04], [0.7, '#000', 0], [1, '#000', 0.2]].forEach(([o, c, op]) => lg.append('stop').attr('offset', o).attr('stop-color', c).attr('stop-opacity', op));
      /* cantos arredondados no topo e na base de cada coluna */
      const rx = Math.min(4, bw / 3);
      data.forEach((d, k) => { defs.append('clipPath').attr('id', 'sr-col' + k).append('rect').attr('x', cx(d.dia) - bw / 2).attr('width', bw).attr('y', y(d.tot)).attr('height', Math.max(0, H - mb - y(d.tot))).attr('rx', rx); });
      const barras = svg.append('g').attr('filter', 'url(#sr-sombra)');
      barras.selectAll('g').data(series).join('g').style('fill', s => COR[s.key])
        .selectAll('rect').data(s => s).join('rect')
        .attr('x', d => cx(d.data.dia) - bw / 2).attr('width', bw).attr('y', d => y(d[1])).attr('height', d => Math.max(0, y(d[0]) - y(d[1])))
        .attr('clip-path', d => 'url(#sr-col' + ds.indexOf(d.data.dia) + ')').style('opacity', d => (ds.indexOf(d.data.dia) <= i ? 1 : 0.15));
      svg.append('g').attr('pointer-events', 'none').selectAll('rect').data(data.filter((d, k) => k <= i && d.tot > 0)).join('rect')
        .attr('x', d => cx(d.dia) - bw / 2).attr('width', bw).attr('y', d => y(d.tot)).attr('height', d => Math.max(0, H - mb - y(d.tot))).attr('rx', Math.min(4, bw / 3))
        .style('fill', 'url(#sr-brilho)');
      svg.append('path').datum(data.slice(0, i + 1)).attr('d', d3.line().x(d => cx(d.dia)).y(d => y2(d.acum)).curve(d3.curveMonotoneX))
        .attr('filter', 'url(#sr-sombra-linha)').style('fill', 'none').style('stroke', PROF).style('stroke-width', 2);
      svg.append('line').attr('x1', xCur).attr('x2', xCur).attr('y1', mt).attr('y2', H - mb).style('stroke', TXT2).style('stroke-width', 1).style('stroke-dasharray', '3 3');
      const tp = S.tip(host);
      svg.append('g').selectAll('rect').data(data).join('rect').attr('x', d => x(d.dia)).attr('width', x.bandwidth()).attr('y', mt).attr('height', H - mb - mt)
        .style('fill', 'transparent').style('cursor', 'pointer')
        .on('pointermove', (ev, d) => tp.show(ev, S.fCurto(d.dia), [['Realizada', S.fInt(d.realizada), COR.realizada], ['Agendada', S.fInt(d.agendada), COR.agendada], ['No-show', S.fInt(d.no_show), COR.no_show], ['Cancelada', S.fInt(d.cancelada), COR.cancelada], ['Total do dia', S.fInt(d.tot)], ['Acumulado', S.fInt(d.acum)]]))
        .on('pointerleave', () => tp.hide())
        .on('click', (ev, d) => { parar(); setIdx(ds.indexOf(d.dia)); S.abrir({ titulo: 'Calls do dia', rows: d.rows, kind: 'c', periodo: [d.dia, d.dia] }); });
      /* linha do tempo alinhada aos dias do eixo X */
      const st = x.step();
      m.bar.style.left = (ml + st / 2) + 'px'; m.bar.style.right = (mr + st / 2) + 'px';
      const pos = n > 1 ? (i / (n - 1)) * 100 : 100;
      m.fill.style.width = pos + '%'; m.h.style.left = pos + '%'; m.tip.style.left = pos + '%';
      m.tip.textContent = S.fCurto(ds[i]);
      m.h.setAttribute('aria-valuemin', '0'); m.h.setAttribute('aria-valuemax', String(n - 1)); m.h.setAttribute('aria-valuenow', String(i)); m.h.setAttribute('aria-valuetext', S.fData(ds[i]));
    }
  });

  /* =================== tabelas no padrão de ranking =================== */
  function celula(td, txt, abrir) {
    if (!abrir || txt === '—' || txt === '') { td.appendChild(E('span', '', txt)); return; }
    const b = E('button', 'sr-cell', txt); b.type = 'button'; b.addEventListener('click', abrir); td.appendChild(b);
  }
  function tabelaRanking(el, o) {
    const col = o.cols.find(c => c.k === o.ord.k) || o.cols[0], dir = o.ord.dir;
    const val = g => { const v = col.v(g.m); return v == null ? -Infinity : v; };
    const reais = o.grupos.filter(g => g.key !== S.SEMK).sort((a, b) => (val(a) - val(b)) * dir || b.m.calls.length - a.m.calls.length);
    const sem = o.grupos.find(g => g.key === S.SEMK);
    const maxV = Math.max(0, d3.max(o.grupos, g => { const v = col.v(g.m); return v == null ? 0 : v; }) || 0);
    const nomeCol = o.nomeCol || S.DIMS[o.dim].nome;
    const tbl = E('table', 'sr-t'); tbl.setAttribute('data-source', 'base_unificada');
    const trh = E('tr'); trh.appendChild(E('th', 'pos', '#'));
    trh.appendChild(E('th', 'nome', nomeCol));
    o.cols.forEach(c => {
      const h = E('th', 'n');
      const b = E('button', 'sr-sort' + (c.k === col.k ? ' on' : ''), c.t + (c.k === col.k ? (dir < 0 ? ' ↓' : ' ↑') : '')); b.type = 'button';
      b.addEventListener('click', () => o.aoOrdenar(c.k, c.k === col.k ? -dir : -1));
      h.setAttribute('aria-sort', c.k === col.k ? (dir < 0 ? 'descending' : 'ascending') : 'none');
      h.appendChild(b); trh.appendChild(h);
    });
    const th = E('thead'); th.appendChild(trh);
    const tb = E('tbody');
    const linha = (g, pos) => {
      const tr = E('tr', g.key === S.SEMK ? 'sem' : '');
      const tp = E('td', 'pos');
      if (pos && pos <= 3 && !o.semMedalha) { const q = E('span', 'sr-medal'); q.style.background = MEDALHA[pos - 1]; tp.appendChild(q); }
      tp.appendChild(document.createTextNode(pos ? String(pos) : '—'));
      tr.appendChild(tp);
      const tn = E('td', 'nome' + (g.mae ? ' duas' : ''));
      if ((o.dim === 'sdr' || o.dim === 'closer') && g.key !== S.SEMK) {
        const av = E('span', 'sr-av', String(g.nome || '').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase());
        av.style.background = AVCOR[[...String(g.nome)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVCOR.length];
        av.setAttribute('aria-hidden', 'true'); tn.appendChild(av);
      }
      const nb = E('button', 'sr-cell nm', g.nome); nb.type = 'button';
      const ac = o.nomeAcao(g); nb.addEventListener('click', ac.fn); if (ac.tip) nb.title = ac.tip;
      tn.appendChild(nb); if (g.mae) tn.appendChild(E('span', 'sr-mae', g.mae));
      tr.appendChild(tn);
      o.cols.forEach(c => {
        const v = c.v(g.m), td = E('td', 'n' + (c.k === col.k ? ' sr-bar' : '')), txt = c.f(v);
        if (c.k === col.k && maxV > 0 && v != null && v > 0) {
          /* a barra fica à esquerda do número; números largos (R$) empurram a barra */
          const off = Math.max(56, Math.round(String(txt).length * 7.4) + 14);
          const i = E('i'); i.style.right = off + 'px'; i.style.width = `calc((100% - ${off + 10}px) * ${(v / maxV).toFixed(4)})`; td.appendChild(i);
        }
        celula(td, txt, c.rows ? () => S.abrir({ titulo: c.tit, recorte: [nomeCol + ': ' + g.nome], rows: c.rows(g.m), kind: c.kind || 'c', cols: c.dcols }) : null);
        tr.appendChild(td);
      });
      return tr;
    };
    reais.forEach((g, i) => tb.appendChild(linha(g, i + 1)));
    if (o.semSempre || sem) tb.appendChild(linha(sem || { key: S.SEMK, nome: S.DIMS[o.dim].sem, m: S.M([], []) }, 0));
    tbl.append(th, tb);
    if (o.total) {
      const tm = o.total, tf = E('tfoot'), tr = E('tr');
      tr.append(E('td', 'pos', ''), E('td', 'nome', 'Total'));
      o.cols.forEach(c => { const td = E('td', 'n'); celula(td, c.f(c.v(tm)), c.rows ? () => S.abrir({ titulo: c.tit, rows: c.rows(tm), kind: c.kind || 'c', cols: c.dcols }) : null); tr.appendChild(td); });
      tf.appendChild(tr); tbl.appendChild(tf);
    }
    const w = E('div', 'sr-tw'); w.appendChild(tbl); el.replaceChildren(w);
  }
  const C = {
    leads: { k: 'leads', t: 'Leads', v: m => m.leads.length, f: S.fInt, rows: m => m.leads, tit: 'Leads', kind: 'l' },
    calls: { k: 'calls', t: 'Calls', v: m => m.calls.length, f: S.fInt, rows: m => m.calls, tit: 'Calls' },
    realizadas: { k: 'realizadas', dcols: ['lead_nome', 'sdr_agendou_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'link_gravacao'], t: 'Realizadas', v: m => m.realizadas.length, f: S.fInt, rows: m => m.realizadas, tit: 'Calls realizadas' },
    comp: { k: 'comp', t: 'Comparec. %', v: m => S.pct(m.realizadas.length, m.comp.length), f: S.fP, rows: m => m.comp, tit: 'Realizadas + no-show' },
    vendas: { k: 'vendas', t: 'Vendas', v: m => m.vendas.length, f: S.fInt, rows: m => m.vendas, tit: 'Vendas' },
    valor: { k: 'valor', t: 'Valor', v: m => m.valor, f: S.fBRL, rows: m => m.vendasValor, tit: 'Vendas com valor' },
    leadcall: { k: 'leadcall', t: 'Lead→Call %', v: m => S.pct(m.leadsCall.length, m.leads.length), f: S.fP, rows: m => m.leadsCall, tit: 'Leads com call', kind: 'l' },
    callvenda: { k: 'callvenda', t: 'Call→Venda %', v: m => S.pct(m.vendas.length, m.realizadas.length), f: S.fP, rows: m => m.vendas, tit: 'Vendas' }
  };
  const COLS_SDR = [Object.assign({}, C.calls, { t: 'Agendadas', tit: 'Calls agendadas' }), C.realizadas, C.comp, C.vendas, C.valor];
  const COLS_CLOSER = [Object.assign({}, C.calls, { t: 'Reuniões', tit: 'Reuniões recebidas' }), C.realizadas, C.vendas, C.callvenda, C.valor];
  const COLS_ORIGEM = [C.leads, C.calls, C.realizadas, C.comp, C.vendas, C.valor, C.leadcall, C.callvenda];

  /* =================== RANKING DE CALLS POR TAG =================== */
  dash.draw('rk-tag', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    if (!F.calls.length) { S.vazio(el, 'Nenhuma call no período.'); return; }
    const total = S.umPorLead(F.calls).length;
    const gs = d3.groups(F.calls, r => r._k.tag).map(([k, rows]) => ({ k, nome: S.rotulo('tag', k), rows: S.umPorLead(rows) }));
    const reais = gs.filter(g => g.k !== S.SEMK).sort((a, b) => b.rows.length - a.rows.length);
    const sem = gs.find(g => g.k === S.SEMK);
    const lista = reais.slice(0, 15).concat(sem ? [sem] : []);
    const max = Math.max(1, d3.max(lista, g => g.rows.length));
    const box = E('div', 'sr-tr'), tp = S.tip(el);
    const cab = E('div', 'sr-trow cab'); cab.append(E('span', '', '#'), E('span', '', 'Tag de campanha'), E('span', '', 'Calls por status'), E('span', 'n', 'Calls'), E('span', 'p', '% total'));
    box.appendChild(cab);
    lista.forEach((g, i) => {
      const semTag = g.k === S.SEMK;
      const row = E('div', 'sr-trow' + (semTag ? ' sem' : ''));
      const pos = E('span', 'pos');
      if (!semTag && i < 3) { const q = E('span', 'sr-medal'); q.style.background = MEDALHA[i]; pos.appendChild(q); }
      pos.appendChild(document.createTextNode(semTag ? '—' : String(i + 1)));
      const nm = E('button', 'sr-cell nm', g.nome); nm.type = 'button'; nm.title = g.nome;
      nm.addEventListener('click', () => S.abrir({ titulo: 'Calls', recorte: ['Tag: ' + g.nome], rows: g.rows }));
      const barra = E('div', 'sr-tbar'); barra.style.width = (100 * g.rows.length / max) + '%';
      KEYS.forEach(st => {
        const rs = g.rows.filter(r => r._g === st); if (!rs.length) return;
        const b = E('button'); b.type = 'button'; b.style.flex = String(rs.length); b.style.background = COR[st];
        b.setAttribute('aria-label', `${g.nome}: ${S.ROT[st]} ${rs.length}`);
        b.addEventListener('pointermove', ev => tp.show(ev, g.nome, KEYS.map(k => [S.ROT[k], S.fInt(g.rows.filter(r => r._g === k).length), COR[k]]).concat([['Total', S.fInt(g.rows.length)]])));
        b.addEventListener('pointerleave', () => tp.hide());
        b.addEventListener('click', () => S.abrir({ titulo: 'Calls · ' + S.ROT[st], recorte: ['Tag: ' + g.nome], rows: rs }));
        barra.appendChild(b);
      });
      const n = E('span', 'n'); const nb = E('button', 'sr-cell', S.fInt(g.rows.length)); nb.type = 'button';
      nb.addEventListener('click', () => S.abrir({ titulo: 'Calls', recorte: ['Tag: ' + g.nome], rows: g.rows })); n.appendChild(nb);
      const wrap = E('div'); wrap.appendChild(barra);
      row.append(pos, nm, wrap, n, E('span', 'p', S.fP(g.rows.length / total)));
      box.appendChild(row);
    });
    const nota = reais.length > 15 ? E('p', 'sr-note', `Mostrando as 15 tags com mais calls de ${S.fInt(reais.length)}. A lista completa está em Origem das calls.`) : null;
    el.replaceChildren(...[box, nota].filter(Boolean));
  });

  /* =================== [C] RANKINGS DE PESSOAS =================== */
  function pessoas(el, dim, cols, ordKey, selId) {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const grupos = d3.groups(F.calls, r => r._k[dim]).map(([k, rows]) => ({ key: k, nome: S.rotulo(dim, k), m: S.M(rows, []) }));
    if (!grupos.length) { S.vazio(el, 'Nenhuma call no período.'); return; }
    document.querySelectorAll('#' + selId).forEach(s => { if (document.activeElement !== s) s.value = S.st.ord[ordKey].k; });
    tabelaRanking(el, {
      dim, grupos, cols, ord: S.st.ord[ordKey], total: S.M(F.calls, []),
      aoOrdenar: (k, dir) => { S.st.ord[ordKey] = { k, dir }; dash.draw(el.getAttribute('data-draw')); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Calls', recorte: [S.DIMS[dim].nome + ': ' + g.nome], rows: g.m.calls }) })
    });
  }
  /* =================== GESTORES DE TRÁFEGO (campanhas por tag) ===================
     Cada lead vai para o gestor da primeira tag dele que está nesta tabela.
     Quando o lead tem page_model2_rei (Google Ads do Rei), essa vale antes de form-rei. */
  const GESTORES = [
    { g: 'Rei do Tráfego', camp: 'FORMS REI - FRANQUIA', canal: 'Meta Ads', funil: 'Franquia', tags: ['form-rei'] },
    { g: 'Rei do Tráfego', camp: 'GOOGLE - ADS', canal: 'Google Ads', funil: 'Franquia', tags: ['page_model2_rei'], prio: true },
    { g: 'Gabriel', camp: 'G2 - FRANQUIA', canal: 'Meta Ads', funil: 'Franquia', tags: ['g2 - franquia', 'g2'] },
    { g: 'Gabriel', camp: 'G3 - FRANQUIA', canal: 'Google Ads', funil: 'Franquia', tags: ['g3 - franquia', 'g3'] },
    { g: 'Gabriel', camp: 'G4 - FRANQUIA', canal: 'Meta Ads', funil: 'Franquia', tags: ['g4 - franquia', 'g4'] },
    { g: 'Gabriel', camp: 'BLACK-2', canal: 'Meta Ads', funil: 'Black Friday', tags: ['black-2', 'black 2', 'black2'] },
    { g: 'Gabriel', camp: 'MODEL-2', canal: 'Meta Ads', funil: 'Franquia', tags: ['page_model2', 'model-2', 'model2'] },
    { g: 'Matheus', camp: 'QUIZ-MT-EUROLOC', canal: 'Meta Ads', funil: 'Franquia', tags: ['quiz-mt-euroloc'] },
    { g: 'Matheus', camp: 'FORMS MT - PAGINA 01', canal: 'Meta Ads', funil: 'Franquia', tags: ['forms mt-pagina 01', 'forms mt - pagina 01'] },
    { g: 'Matheus', camp: '[FORMS] FRANQUIA LOCAÇÃO EUA - MT07', canal: 'Meta Ads (Form. instantâneo)', funil: 'Franquia', tags: ['forms franquia locacao eua - mt07'] },
    { g: 'Matheus', camp: 'BLACK-1', canal: 'Meta Ads', funil: 'Black Friday', tags: ['black-1', 'black 1', 'black1'] },
    { g: 'Matheus', camp: 'V2M - FRANQUIA', canal: 'Meta Ads', funil: 'Franquia', tags: ['v2m - franquia', 'v2m'] },
    { g: 'Matheus', camp: 'MT2 - FRANQUIA', canal: 'Meta Ads', funil: 'Franquia', tags: ['mt2 - franquia', 'mt2'] },
    { g: 'Matheus', camp: 'Fillipe Felix - [FORMS] Euro Loc - MT01', canal: 'Meta Ads', funil: 'Franquia', tags: ['forms euro loc - mt01'] },
    { g: 'Matheus', camp: '[FORMS] Franquia Locação - MT04', canal: 'Meta Ads', funil: 'Franquia', tags: ['forms franquia locacao - mt04'] },
    { g: 'Matheus', camp: 'Quiz-Investidor MT', canal: 'Meta Ads', funil: 'Cotas', tags: ['quiz_investidor_mt', 'quiz-investidor mt', 'quiz-investidor-mt'] },
    { g: 'Matheus', camp: 'MODEL-1', canal: 'Meta Ads', funil: 'Franquia', tags: ['page_model1', 'model-1', 'model1'] },
    { g: 'Matheus', camp: 'OFICIAL - LOCAGORAFRANQUIAS', canal: 'Meta Ads', funil: 'Franquia', tags: ['oficial - locagorafranquias', 'oficial-locagorafranquias', 'locagorafranquias'] },
    { g: 'Matheus', camp: 'MATEUS MODEL-2', canal: 'Meta Ads', funil: 'Franquia', tags: ['page_model2_mateus'] },
    { g: 'Matheus', camp: 'LIVE-FRANQUIAS', canal: '—', funil: 'Franquia', tags: ['live-franquias'] },
    { g: 'Matheus', camp: 'PRINCIPAL-FRANQUIAS', canal: '—', funil: 'Franquia', tags: ['principal-franquias'] }
  ];
  const NOMES_GEST = [...new Set(GESTORES.map(x => x.g))];
  /* canal: Meta Ads (Facebook/Instagram), Google Ads ou Outro; sem canal na tabela, vem do utm_source */
  function canalDe(canalTab, src) {
    const c = String(canalTab || '').toLowerCase();
    if (c.startsWith('meta')) return 'Meta Ads (Facebook / Instagram)';
    if (c.startsWith('google')) return 'Google Ads';
    const u = String(src || '').toLowerCase().trim();
    if (!u || u === 'sem utm') return 'Sem UTM';
    if (/^(fb|ig|an|msg|threads)$|facebook|instagram|meta/.test(u)) return 'Meta Ads (Facebook / Instagram)';
    if (/google|gads|adwords/.test(u)) return 'Google Ads';
    return 'Outro (' + S.limpa(src) + ')';
  }
  const SEM_GEST = 'Sem gestor';
  const normTag = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const MAPA_TAG = new Map(); GESTORES.forEach(e => e.tags.forEach(t => MAPA_TAG.set(normTag(t), e)));
  const cacheGest = new Map();
  function campanhaDe(tags) {
    const key = String(tags || ''); if (cacheGest.has(key)) return cacheGest.get(key);
    const es = key.split('|').map(t => MAPA_TAG.get(normTag(t))).filter(Boolean);
    const e = es.find(x => x.prio) || es[0] || null;
    cacheGest.set(key, e); return e;
  }
  function marcaGestor(r) {
    if (r._gestOk) return r;
    const e = campanhaDe(r.tags);
    r.gestor = e ? e.g : ''; r.campanha_gestor = e ? e.camp : ''; r.funil_gestor = e ? e.funil : '';
    r.canal_gestor = e ? canalDe(e.canal, r.utm_source) : '';
    const cg = r.canal_gestor || canalDe('', r.utm_source);
    r.canal_geral = cg === 'Google Ads' ? 'Google' : cg.startsWith('Meta') ? 'Facebook / Instagram' : 'Outros';
    r._gestOk = true; return r;
  }
  const DC_GL = ['lead_nome', 'gestor', 'campanha_gestor', 'canal_geral', 'canal_gestor', 'data_entrada', 'tags', 'fonte', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'sdr_responsavel_nome', 'closer_nome', 'etapa_atual', 'data_agendamento', 'link_gravacao', 'resultado'];
  const DC_GC = ['lead_nome', 'gestor', 'campanha_gestor', 'sdr_agendou_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'status', 'link_gravacao', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'tags', 'resultado'];
  const DC_GV = ['lead_nome', 'gestor', 'campanha_gestor', 'data_fechamento', 'valor', 'closer_nome', 'sdr_origem_nome', 'modelo_franquia', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'tags'];
  const DC_GP = ['lead_nome', 'gestor', 'campanha_gestor', 'motivo_unificado', 'motivo_perda_custom', 'motivo_perda_nativo', 'etapa_atual', 'resultado_neg', 'vendedor', 'sdr_origem_nome', 'data_criacao', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'tags'];
  S.st.gest = S.st.gest || { sel: '', ordG: { k: 'leads', dir: -1 }, ordC: { k: 'leads', dir: -1 }, ordK: { k: 'calls', dir: -1 }, todosCri: false };
  function baseGestores() {
    const F = S.full(), todos = negocios(); if (!F || !todos) return null;
    const f = S.filtros();
    const leads = F.leads.map(marcaGestor), calls = F.calls.map(marcaGestor);
    const vend = (vendasEntre(F.a, F.b) || { vendas: [] }).vendas;
    const perd = todos.filter(o => o._fora && o._dc >= F.a && o._dc <= F.b && S.passa(o, 'l', null, f));
    return { F, leads, calls, vend, perd };
  }
  const so = (rows, fn) => rows.filter(fn);
  function metricasGest(B, fn) {
    const leads = so(B.leads, fn), calls = so(B.calls, fn), m = S.M(calls, leads);
    m.vend = so(B.vend, fn); m.perd = so(B.perd, fn); m.valorV = d3.sum(m.vend, o => o.valor);
    return m;
  }
  const COLS_GEST = [
    Object.assign({}, C.leads, { dcols: DC_GL }),
    Object.assign({}, C.calls, { t: 'Agendadas', dcols: DC_GC }),
    Object.assign({}, C.realizadas, { dcols: DC_GC }),
    Object.assign({}, C.leadcall, { dcols: DC_GL }),
    { k: 'vend', t: 'Vendas', v: m => m.vend.length, f: S.fInt, rows: m => m.vend, tit: 'Vendas', kind: 'l', dcols: DC_GV },
    { k: 'valorV', t: 'Valor', v: m => m.valorV, f: S.fBRL, rows: m => m.vend.filter(o => o.valor > 0), tit: 'Vendas com valor', kind: 'l', dcols: DC_GV },
    { k: 'perd', t: 'Perdas', v: m => m.perd.length, f: S.fInt, rows: m => m.perd, tit: 'Perdidas e desqualificadas', kind: 'l', dcols: DC_GP }
  ];
  /* ---------- Meta (Facebook / Instagram): gasto, leads e criativo por anúncio, via /api/meta (só no site) ---------- */
  S.st.meta = S.st.meta || { chave: '', estado: 'nada', dados: null, erro: '' };
  const normNome = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function carregarMeta(F, forcar) {
    const m = S.st.meta, chave = F.a + '|' + F.b;
    if (!forcar && m.chave === chave && m.estado !== 'nada') return;
    m.chave = chave; m.estado = 'carregando'; m.erro = '';
    fetch('/api/meta?ini=' + F.a + '&fim=' + F.b + (forcar ? '&atualizar=1' : ''), { credentials: 'same-origin', cache: 'no-store' })
      .then(r => { const tipo = r.headers.get('content-type') || ''; if (!tipo.includes('json')) { if (r.status >= 500) return { ok: false, conectado: true, erro: 'O servidor respondeu com erro ' + r.status + '. Tente de novo em alguns minutos.' }; throw new Error('indisponivel'); } return r.json(); })
      .then(j => { if (m.chave !== chave) return; if (j.ok) { m.estado = 'ok'; m.dados = j; } else { m.estado = j.conectado === false ? 'desconectado' : 'erro'; m.erro = j.erro || ''; m.dados = null; } dash.draw('gestores'); })
      .catch(() => { if (m.chave !== chave) return; m.estado = 'indisponivel'; m.dados = null; dash.draw('gestores'); });
  }
  /* liga cada anúncio a um gestor: pela conta (META_CONTAS) ou pelos leads do CRM com o mesmo utm_content */
  function metaPorGestor(B) {
    const j = S.st.meta.dados; if (!j) return null;
    const D = S.dados(), voto = new Map();
    (D.leads || []).forEach(l => { marcaGestor(l); const k = normNome(l.utm_content); if (!k || !l.gestor) return; const v = voto.get(k) || new Map(); v.set(l.gestor, (v.get(l.gestor) || 0) + 1); voto.set(k, v); });
    const gestorDe = a => {
      if (a.gestor_conta) return a.gestor_conta;
      const v = voto.get(normNome(a.anuncio)); if (v) return [...v.entries()].sort((x, y) => y[1] - x[1])[0][0];
      const e = campanhaDe(a.campanha) || campanhaDe(a.conjunto); return e ? e.g : SEM_GEST;
    };
    const ads = j.anuncios.map(a => Object.assign({}, a, { gestor: gestorDe(a), _k: normNome(a.anuncio) }));
    /* criativos: soma o mesmo anúncio rodando em vários conjuntos */
    const porNome = new Map();
    ads.forEach(a => { const c = porNome.get(a._k) || { nome: a.anuncio, _k: a._k, gestor: a.gestor, campanhas: new Set(), gasto: 0, leads_meta: 0, impressoes: 0, cliques: 0, thumb: '', imagem: '', link: '' };
      c.gasto += a.gasto; c.leads_meta += a.leads_meta; c.impressoes += a.impressoes; c.cliques += a.cliques; c.campanhas.add(a.campanha);
      if (!c.thumb && a.thumb) { c.thumb = a.thumb; c.imagem = a.imagem; c.link = a.link; } porNome.set(a._k, c); });
    return { ads, porNome };
  }
  const META_CANAL = 'Facebook / Instagram';
  function cardMeta(txt, sub) { const c = E('div', 'sr-metainfo'); c.append(E('b', '', txt)); if (sub) c.appendChild(E('span', '', sub)); return c; }

  dash.draw('gestores', el => {
    const D = S.dados(), B = baseGestores();
    if (!B) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const st = S.st.gest, box = E('div', 'sr-nps');
    const fG = st.sel ? (r => r.gestor === st.sel) : (r => !!r.gestor);
    /* escolha do gestor */
    const topo = E('div', 'sr-row'); topo.style.justifyContent = 'space-between';
    topo.appendChild(segmento([['', 'Todos']].concat(NOMES_GEST.map(n => [n, n])), st.sel, v => { st.sel = v; st.todosCri = false; dash.draw('gestores'); }));
    const bx = botao('sr-btn sr-tvbtn', 'Baixar Excel', 'dl'); bx.addEventListener('click', () => baixarGestores(B));
    topo.appendChild(bx); box.appendChild(topo);
    const sec = (t, sub) => { const h = E('h3', 'sr-sub3', t); if (sub) h.appendChild(E('span', 'sr-hint', ' · ' + sub)); box.appendChild(h); };
    /* 0. geral por canal: Google / Facebook / Outros (todos os leads, com ou sem gestor) */
    const fC = st.sel ? (r => r.gestor === st.sel) : (() => true);
    sec(st.sel ? 'Geral por canal · ' + st.sel : 'Geral por canal', 'todos os leads do período; Outros = sem UTM, direto, orgânico e demais origens');
    const CANAIS3 = ['Google', 'Facebook / Instagram', 'Outros'];
    const g3 = CANAIS3.map(c => ({ key: c, nome: c, m: metricasGest(B, r => fC(r) && r.canal_geral === c) })).filter(g => g.m.leads.length || g.m.calls.length || g.m.vend.length || g.m.perd.length);
    const w0 = E('div', 'sr-motw');
    tabelaRanking(w0, { dim: 'canal3', nomeCol: 'Canal', grupos: g3, cols: COLS_GEST, ord: st.ord3 || (st.ord3 = { k: 'leads', dir: -1 }), semMedalha: true, total: metricasGest(B, fC),
      aoOrdenar: (k, dir) => { st.ord3 = { k, dir }; dash.draw('gestores'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads criados', recorte: ['Canal: ' + g.nome].concat(st.sel ? ['Gestor: ' + st.sel] : []), rows: g.m.leads, kind: 'l', cols: DC_GL }) }) });
    box.appendChild(w0);
    /* 1. resumo por gestor */
    sec('Resumo por gestor', 'leads pela data de entrada, calls pela data base, vendas pela data de fechamento, perdas pela criação da oportunidade');
    const gs = NOMES_GEST.concat([SEM_GEST]).map(n => ({ key: n === SEM_GEST ? S.SEMK : n, nome: n, m: metricasGest(B, n === SEM_GEST ? (r => !r.gestor) : (r => r.gestor === n)) }));
    const w1 = E('div', 'sr-motw');
    tabelaRanking(w1, { dim: 'gestor', nomeCol: 'Gestor', grupos: gs, cols: COLS_GEST, ord: st.ordG, semMedalha: true, total: metricasGest(B, () => true),
      aoOrdenar: (k, dir) => { st.ordG = { k, dir }; dash.draw('gestores'); },
      nomeAcao: g => ({ fn: () => { if (g.key !== S.SEMK) { st.sel = g.nome; dash.draw('gestores'); } }, tip: 'Ver só este gestor' }) });
    box.appendChild(w1);
    /* 1b. por canal */
    sec(st.sel ? 'Canais de ' + st.sel : 'Por gestor e canal', 'Meta Ads = Facebook e Instagram');
    const pares = [];
    (st.sel ? [st.sel] : NOMES_GEST).forEach(n => {
      const canais = [...new Set(B.leads.concat(B.calls, B.vend, B.perd).filter(r => r.gestor === n).map(r => r.canal_gestor))].sort();
      canais.forEach(c => pares.push({ key: n + '|' + c, nome: st.sel ? c : `${n} · ${c}`, m: metricasGest(B, r => r.gestor === n && r.canal_gestor === c) }));
    });
    const wc = E('div', 'sr-motw');
    if (pares.length) tabelaRanking(wc, { dim: 'canal', nomeCol: st.sel ? 'Canal' : 'Gestor · Canal', grupos: pares, cols: COLS_GEST, ord: st.ordN || (st.ordN = { k: 'leads', dir: -1 }), semMedalha: true, total: metricasGest(B, fG),
      aoOrdenar: (k, dir) => { st.ordN = { k, dir }; dash.draw('gestores'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads criados', recorte: [g.nome], rows: g.m.leads, kind: 'l', cols: DC_GL }) }) });
    else wc.appendChild(E('div', 'sr-empty', 'Nenhum lead no período.'));
    box.appendChild(wc);
    /* 2. campanhas (tags) */
    sec(st.sel ? 'Campanhas de ' + st.sel : 'Campanhas de todos os gestores', 'tag de campanha · canal · funil');
    const camps = GESTORES.filter(e => !st.sel || e.g === st.sel).map(e => ({ key: e.camp, nome: e.camp + ' · ' + (e.canal === '—' ? 'canal pelo utm' : e.canal) + (st.sel ? '' : ' · ' + e.g), m: metricasGest(B, r => r.campanha_gestor === e.camp) }))
      .filter(g => g.m.leads.length || g.m.calls.length || g.m.vend.length || g.m.perd.length);
    const w2 = E('div', 'sr-motw');
    if (camps.length) tabelaRanking(w2, { dim: 'camp', nomeCol: 'Campanha', grupos: camps, cols: COLS_GEST, ord: st.ordC, semMedalha: true, total: metricasGest(B, fG),
      aoOrdenar: (k, dir) => { st.ordC = { k, dir }; dash.draw('gestores'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads criados', recorte: ['Campanha: ' + g.key], rows: g.m.leads, kind: 'l', cols: DC_GL }) }) });
    else w2.appendChild(E('div', 'sr-empty', 'Nenhum lead dessas campanhas no período.'));
    box.appendChild(w2);
    /* 2b. investimento no Meta: custo por lead, por call e CAC */
    carregarMeta(B.F);
    const MS = S.st.meta, MG = MS.estado === 'ok' ? metaPorGestor(B) : null;
    sec('Investimento no Meta' + (st.sel ? ' · ' + st.sel : ''), 'gasto do Meta (Facebook / Instagram) contra os leads, calls e vendas de canal Meta no CRM');
    if (!MG) {
      const msgs = { carregando: ['Buscando os dados do Meta…', ''], indisponivel: ['Os dados do Meta aparecem só no site do relatório.', 'Esta versão não tem acesso à conta de anúncios.'],
        desconectado: ['O Meta ainda não está conectado.', 'Falta guardar o token do usuário do sistema (META_TOKEN) no Cloudflare.'], erro: ['Não foi possível ler os dados do Meta.', MS.erro], nada: ['Buscando os dados do Meta…', ''] };
      const [t1, t2] = msgs[MS.estado] || msgs.nada; box.appendChild(cardMeta(t1, t2));
    } else {
      const nomes = st.sel ? [st.sel] : NOMES_GEST.concat([SEM_GEST]);
      const linhasM = nomes.map(n => {
        const ads = MG.ads.filter(a => a.gestor === n), fM = r => r.canal_geral === META_CANAL && (n === SEM_GEST ? !r.gestor : r.gestor === n);
        const m = metricasGest(B, fM); m.gasto = d3.sum(ads, a => a.gasto); m.leadsMeta = d3.sum(ads, a => a.leads_meta); m.ads = ads;
        return { key: n === SEM_GEST ? S.SEMK : n, nome: n, m };
      }).filter(g => g.m.gasto > 0 || g.m.leads.length);
      const tot = metricasGest(B, r => r.canal_geral === META_CANAL && (!st.sel || r.gestor === st.sel)); tot.gasto = d3.sum(linhasM, g => g.m.gasto); tot.leadsMeta = d3.sum(linhasM, g => g.m.leadsMeta);
      const div = (a, b) => b > 0 ? a / b : null, fR = v => v == null ? '—' : S.fBRL(v);
      const COLS_META = [
        { k: 'gasto', t: 'Investimento', v: m => m.gasto, f: S.fBRL },
        { k: 'lmeta', t: 'Leads Meta', v: m => m.leadsMeta, f: S.fInt },
        Object.assign({}, C.leads, { t: 'Leads CRM', dcols: DC_GL }),
        Object.assign({}, C.calls, { t: 'Agendadas', dcols: DC_GC }),
        Object.assign({}, C.realizadas, { dcols: DC_GC }),
        { k: 'vend', t: 'Vendas', v: m => m.vend.length, f: S.fInt, rows: m => m.vend, tit: 'Vendas', kind: 'l', dcols: DC_GV },
        { k: 'cpl', t: 'Custo por lead CRM', v: m => div(m.gasto, m.leads.length), f: fR },
        { k: 'cpc', t: 'Custo por call', v: m => div(m.gasto, m.calls.length), f: fR },
        { k: 'cpr', t: 'Custo por realizada', v: m => div(m.gasto, m.realizadas.length), f: fR },
        { k: 'cac', t: 'CAC', v: m => div(m.gasto, m.vend.length), f: fR }
      ];
      const wm = E('div', 'sr-motw');
      tabelaRanking(wm, { dim: 'gestor', nomeCol: 'Gestor', grupos: linhasM, cols: COLS_META, ord: st.ordM || (st.ordM = { k: 'gasto', dir: -1 }), semMedalha: true, total: st.sel ? null : tot,
        aoOrdenar: (k, dir) => { st.ordM = { k, dir }; dash.draw('gestores'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads de canal Meta', recorte: ['Gestor: ' + g.nome], rows: g.m.leads, kind: 'l', cols: DC_GL }) }) });
      box.appendChild(wm);
      if (MS.dados.aviso) box.appendChild(cardMeta('Imagens dos criativos indisponíveis', MS.dados.aviso));
      const at = E('p', 'sr-hint'); at.textContent = `Dados do Meta de ${S.fData(MS.dados.ini)} a ${S.fData(MS.dados.fim)} · atualizados às ${S.fDataHora(MS.dados.gerado).slice(-5)} · contas: ${MS.dados.contas.map(c => c.nome).join(', ')}. Leads CRM, calls e vendas contam só leads de canal Meta. `;
      const up = E('button', 'sr-link', 'Atualizar agora'); up.type = 'button'; up.addEventListener('click', () => carregarMeta(B.F, true)); at.appendChild(up);
      box.appendChild(at);
      /* galeria dos criativos do Meta */
      sec('Criativos do Meta' + (st.sel ? ' de ' + st.sel : ''), 'clique na imagem para ver o anúncio');
      const Lm = so(B.leads, fG), Cm = so(B.calls, fG), Vm = so(B.vend, fG);
      const porCri = (rows) => d3.group(rows, r => normNome(r.utm_content));
      const gL = porCri(Lm), gC = porCri(Cm), gV = porCri(Vm);
      let cards = [...MG.porNome.values()].filter(c => !st.sel || c.gestor === st.sel).map(c => {
        const calls = S.umPorLead(gC.get(c._k) || []), leads = gL.get(c._k) || [], vend = gV.get(c._k) || [];
        return Object.assign(c, { calls, leads, vend, reais: (gC.get(c._k) || []).filter(r => r._g === 'realizada') });
      }).filter(c => c.gasto > 0 || c.leads.length);
      cards.sort((a, b) => b.calls.length - a.calls.length || b.leads.length - a.leads.length || b.gasto - a.gasto);
      const totC = cards.length; if (!st.todosMeta) cards = cards.slice(0, 12);
      const gal = E('div', 'sr-gal');
      cards.forEach((c, i) => {
        const cd = E('article', 'sr-cri');
        const fig = c.link ? E('a', 'fig') : E('div', 'fig'); if (c.link) { fig.href = c.link; fig.target = '_blank'; fig.rel = 'noopener noreferrer'; fig.title = 'Ver o anúncio no Meta'; }
        if (c.thumb) { const im = E('img'); im.src = c.thumb; im.alt = 'Criativo ' + c.nome; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer'; fig.appendChild(im); } else fig.appendChild(E('span', 'sem', 'Sem prévia'));
        fig.appendChild(E('span', 'pos', String(i + 1)));
        const corpo = E('div', 'cb');
        const nm = E('div', 'nm', c.nome); nm.title = c.nome + '\n' + [...c.campanhas].join(' · ');
        corpo.append(nm, E('div', 'gs', (c.gestor || SEM_GEST) + ' · ' + [...c.campanhas][0]));
        const dl = E('dl', 'nums');
        const par = (t, v, rows, tit, cols) => { const dt = E('dt', '', t), dd = E('dd'); if (rows && rows.length) { const b = E('button', 'sr-cell nm sr-plink', v); b.type = 'button'; b.addEventListener('click', () => S.abrir({ titulo: tit, recorte: ['Criativo: ' + c.nome], rows, kind: 'l', cols })); dd.appendChild(b); } else dd.textContent = v; dl.append(dt, dd); };
        par('Investimento', S.fBRL(c.gasto)); par('Leads Meta', S.fInt(c.leads_meta)); par('Leads CRM', S.fInt(c.leads.length), c.leads, 'Leads do criativo', DC_GL);
        par('Agendadas', S.fInt(c.calls.length), c.calls, 'Calls do criativo', DC_GC); par('Realizadas', S.fInt(c.reais.length), c.reais, 'Realizadas do criativo', DC_GC);
        par('Vendas', S.fInt(c.vend.length), c.vend, 'Vendas do criativo', DC_GV);
        par('Custo por call', c.calls.length ? S.fBRL(c.gasto / c.calls.length) : '—'); par('CAC', c.vend.length ? S.fBRL(c.gasto / c.vend.length) : '—');
        corpo.appendChild(dl); cd.append(fig, corpo); gal.appendChild(cd);
      });
      if (cards.length) box.appendChild(gal); else box.appendChild(E('div', 'sr-empty', 'Nenhum anúncio com gasto no período.'));
      if (totC > 12) { const mb = E('button', 'sr-link', st.todosMeta ? 'Mostrar só os 12 melhores' : `Mostrar todos os ${S.fInt(totC)} criativos do Meta`); mb.type = 'button'; mb.addEventListener('click', () => { st.todosMeta = !st.todosMeta; dash.draw('gestores'); }); box.appendChild(mb); }
    }
    /* 3. melhores criativos */
    sec('Melhores criativos' + (st.sel ? ' de ' + st.sel : ''), 'utm_content dos leads das tags do gestor, ordenado por calls agendadas');
    const Lg = so(B.leads, fG), Cg = so(B.calls, fG), Vg = so(B.vend, fG);
    const criDe = r => S.limpa(r.utm_content) && r.utm_content !== 'Sem UTM' ? S.limpa(r.utm_content) : S.SEMK;
    const nomesCri = new Set(Lg.map(criDe).concat(Cg.map(criDe)));
    let cris = [...nomesCri].map(k => { const m = S.M(Cg.filter(r => criDe(r) === k), Lg.filter(r => criDe(r) === k)); m.vend = Vg.filter(r => criDe(r) === k); m.perd = []; m.valorV = d3.sum(m.vend, o => o.valor); return { key: k, nome: k === S.SEMK ? 'Sem criativo (utm_content)' : k, m }; });
    cris.sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.m.calls.length - a.m.calls.length || b.m.leads.length - a.m.leads.length);
    const totCri = cris.length; if (!st.todosCri) cris = cris.slice(0, 15);
    const w3 = E('div', 'sr-motw');
    if (cris.length) tabelaRanking(w3, { dim: 'cri', nomeCol: 'Criativo', grupos: cris, cols: COLS_GEST.filter(c => c.k !== 'perd'), ord: st.ordK, semMedalha: false,
      aoOrdenar: (k, dir) => { st.ordK = { k, dir }; dash.draw('gestores'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads do criativo', recorte: ['Criativo: ' + g.nome], rows: g.m.leads, kind: 'l', cols: DC_GL }) }) });
    else w3.appendChild(E('div', 'sr-empty', 'Nenhum criativo no período.'));
    box.appendChild(w3);
    if (totCri > 15) { const mb = E('button', 'sr-link', st.todosCri ? 'Mostrar só os 15 melhores' : `Mostrar todos os ${S.fInt(totCri)} criativos`); mb.type = 'button'; mb.addEventListener('click', () => { st.todosCri = !st.todosCri; dash.draw('gestores'); }); box.appendChild(mb); }
    /* 4. vendas e perdas */
    sec('Vendas e perdas' + (st.sel ? ' de ' + st.sel : ''));
    const Pg = so(B.perd, fG), duo = E('div', 'sr-pilha');
    const tv = E('div', 'sr-motw');
    if (Vg.length) {
      const t = E('table', 'sr-t'); const th = E('thead'), trh = E('tr');
      [['Fechamento', ''], ['Cliente', ''], ['Campanha', ''], ['Closer', ''], ['Valor', 'n']].forEach(([x, c]) => trh.appendChild(E('th', c, x))); th.appendChild(trh); t.appendChild(th);
      const tb = E('tbody');
      Vg.slice().sort((a, b) => (b.data_fechamento || '').localeCompare(a.data_fechamento || '')).forEach(o => {
        const tr = E('tr'); const tdn = E('td'); const bn = E('button', 'sr-cell nm sr-plink', o.lead_nome || 'Sem nome'); bn.type = 'button'; bn.addEventListener('click', () => abrirPerfil(o.lead_id)); tdn.appendChild(bn);
        tr.append(E('td', '', S.fData(o.data_fechamento) || '—'), tdn, E('td', '', o.campanha_gestor || '—'), E('td', '', o.closer_nome || '—'), E('td', 'n', o.valor > 0 ? S.fBRL(o.valor) : '—')); tb.appendChild(tr);
      });
      t.appendChild(tb); tv.appendChild(t);
    } else tv.appendChild(E('div', 'sr-empty', 'Nenhuma venda no período.'));
    const tp = E('div', 'sr-motw');
    if (Pg.length) {
      const mots = d3.rollups(Pg, v => v, o => o.motivo_unificado || SEM_MOTIVO).sort((a, b) => (a[0] === SEM_MOTIVO) - (b[0] === SEM_MOTIVO) || b[1].length - a[1].length);
      const t = E('table', 'sr-t'); const th = E('thead'), trh = E('tr');
      [['Motivo da perda', ''], ['Perdas', 'n'], ['%', 'n']].forEach(([x, c]) => trh.appendChild(E('th', c, x))); th.appendChild(trh); t.appendChild(th);
      const tb = E('tbody');
      mots.forEach(([mm, rows]) => { const tr = E('tr'); const td = E('td'); const b = E('button', 'sr-cell nm sr-plink', mm); b.type = 'button'; b.addEventListener('click', () => S.abrir({ titulo: 'Perdas', recorte: ['Motivo: ' + mm].concat(st.sel ? ['Gestor: ' + st.sel] : []), rows, kind: 'l', cols: DC_GP })); td.appendChild(b); tr.append(td, E('td', 'n', S.fInt(rows.length)), E('td', 'n', S.fP(S.pct(rows.length, Pg.length)))); tb.appendChild(tr); });
      t.appendChild(tb); tp.appendChild(t);
    } else tp.appendChild(E('div', 'sr-empty', 'Nenhuma perda no período.'));
    const cv = E('div'); cv.append(E('h4', 'sr-sub4', `Vendas (${S.fInt(Vg.length)})`), tv);
    const cp = E('div'); cp.append(E('h4', 'sr-sub4', `Perdas por motivo (${S.fInt(Pg.length)})`), tp);
    duo.append(cv, cp); box.appendChild(duo);
    el.replaceChildren(box);
  });
  function baixarGestores(B) {
    const st = S.st.gest, fG = st.sel ? (r => r.gestor === st.sel) : (() => true);
    const tab = (keys, rows) => { const cs = keys.map(k => S.COLS.find(c => c.k === k)).filter(Boolean); return [cs.map(c => c.t)].concat(rows.map(r => cs.map(c => c.x ? c.x(r) : c.g(r)))); };
    const res = [['Gestor', 'Leads', 'Agendadas', 'Realizadas', 'Lead→Call %', 'Vendas', 'Valor', 'Perdas']];
    NOMES_GEST.concat([SEM_GEST]).filter(n => !st.sel || n === st.sel).forEach(n => { const m = metricasGest(B, n === SEM_GEST ? (r => !r.gestor) : (r => r.gestor === n)); res.push([n, m.leads.length, m.calls.length, m.realizadas.length, m.leads.length ? m.leadsCall.length / m.leads.length : '', m.vend.length, m.valorV, m.perd.length]); });
    const geral = [['Canal', 'Leads', 'Agendadas', 'Realizadas', 'Lead→Call %', 'Vendas', 'Valor', 'Perdas']];
    ['Google', 'Facebook / Instagram', 'Outros'].forEach(c => { const m = metricasGest(B, r => (!st.sel || r.gestor === st.sel) && r.canal_geral === c); geral.push([c, m.leads.length, m.calls.length, m.realizadas.length, m.leads.length ? m.leadsCall.length / m.leads.length : '', m.vend.length, m.valorV, m.perd.length]); });
    const can = [['Gestor', 'Canal', 'Leads', 'Agendadas', 'Realizadas', 'Lead→Call %', 'Vendas', 'Valor', 'Perdas']];
    NOMES_GEST.filter(n => !st.sel || n === st.sel).forEach(n => [...new Set(B.leads.concat(B.calls, B.vend, B.perd).filter(r => r.gestor === n).map(r => r.canal_gestor))].sort().forEach(c => {
      const m = metricasGest(B, r => r.gestor === n && r.canal_gestor === c);
      can.push([n, c, m.leads.length, m.calls.length, m.realizadas.length, m.leads.length ? m.leadsCall.length / m.leads.length : '', m.vend.length, m.valorV, m.perd.length]);
    }));
    const cam = [['Gestor', 'Campanha', 'Canal', 'Funil', 'Leads', 'Agendadas', 'Realizadas', 'Vendas', 'Valor', 'Perdas']];
    GESTORES.filter(e => !st.sel || e.g === st.sel).forEach(e => { const m = metricasGest(B, r => r.campanha_gestor === e.camp); cam.push([e.g, e.camp, e.canal, e.funil, m.leads.length, m.calls.length, m.realizadas.length, m.vend.length, m.valorV, m.perd.length]); });
    const ord = (rows, k) => rows.slice().sort((a, b) => (b[k] || '').localeCompare(a[k] || ''));
    const p = S.per();
    const sobre = [['Relatório', 'Gestores de tráfego' + (st.sel ? ' · ' + st.sel : '')], ['Período', `${S.fData(p.ini)} a ${S.fData(p.fim)}`], ['Filtros', S.descFiltros().join(' · ') || 'Nenhum'], ['Gerado em', S.fDataHora(S.agora())], [],
      ['Gestor', 'Definido pela primeira tag de campanha do lead que está na tabela de campanhas; page_model2_rei vale antes de form-rei.']].concat(GESTORES.map(e => ['', `${e.g} · ${e.camp} · ${e.canal} · ${e.funil} · tags: ${e.tags.join(', ')}`]));
    S.salvar(`gestores${st.sel ? '-' + S.slug(st.sel) : ''}_${S.dataArq()}.xlsx`, window.SRX.xlsx([
      { nome: 'Geral por canal', linhas: geral }, { nome: 'Resumo', linhas: res }, { nome: 'Por canal', linhas: can }, { nome: 'Campanhas', linhas: cam },
      { nome: 'Leads', linhas: tab(DC_GL, ord(so(B.leads, fG), 'data_entrada')) },
      { nome: 'Calls', linhas: tab(DC_GC, ord(so(B.calls, fG), 'data_agendamento')) },
      { nome: 'Vendas', linhas: tab(DC_GV, ord(so(B.vend, fG), 'data_fechamento')) },
      { nome: 'Perdas', linhas: tab(DC_GP, ord(so(B.perd, fG), 'data_criacao')) },
      { nome: 'Sobre', linhas: sobre }
    ]));
  }

  /* =================== BAIXAR O RANKING COMPLETO (Excel) =================== */
  const DET_CALL = ['lead_nome', 'sdr_agendou_nome', 'sdr_responsavel_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'status', 'link_gravacao', 'gravacao', 'nota_closer', 'tag_campanha', 'utm_campaign', 'etapa_atual', 'resultado', 'valor'];
  const NOMES_RK = { sdr: 'SDRs', closer: 'Closers', tag: 'Tags' };
  function baixarRanking(dim) {
    const F = S.full(); if (!F || !F.calls.length) { S.aviso && S.aviso('Nenhuma call no período para baixar.'); return; }
    const num = v => v == null || (typeof v === 'number' && !isFinite(v)) ? '' : v;
    const cols = dim === 'closer' ? COLS_CLOSER : dim === 'tag' ? COLS_ORIGEM.filter(c => c.k !== 'leads' && c.k !== 'leadcall') : COLS_SDR;
    const extra = [{ t: 'No-show', v: m => m.noshow.length }, { t: 'Remarcações', v: m => m.remarc.length }];
    const ord = (S.st.ord[dim] && S.st.ord[dim].k) || (dim === 'closer' ? 'vendas' : 'calls');
    const colOrd = cols.find(c => c.k === ord) || cols[0];
    const nomeDim = S.DIMS[dim].nome;
    const grupos = d3.groups(F.calls, r => r._k[dim]).map(([k, rows]) => ({ k, nome: S.rotulo(dim, k), rows, m: S.M(rows, []) }))
      .sort((a, b) => (a.k === S.SEMK) - (b.k === S.SEMK) || ((colOrd.v(b.m) || 0) - (colOrd.v(a.m) || 0)) || b.m.calls.length - a.m.calls.length);
    /* aba 1: ranking */
    const rk = [['Posição', nomeDim].concat(cols.map(c => c.t), extra.map(c => c.t))];
    let pos = 0;
    grupos.forEach(g => rk.push([g.k === S.SEMK ? '' : ++pos, g.nome].concat(cols.map(c => num(c.v(g.m))), extra.map(c => c.v(g.m)))));
    const T = S.M(F.calls, []);
    rk.push(['', 'Total'].concat(cols.map(c => num(c.v(T))), extra.map(c => c.v(T))));
    /* abas de detalhe: agendadas (um lead por pessoa) e realizadas (toda reunião com link) */
    const colsDet = DET_CALL.map(k => S.COLS.find(c => c.k === k)).filter(Boolean);
    const cab = [nomeDim].concat(colsDet.map(c => c.t));
    const linha = (g, r) => [g.nome].concat(colsDet.map(c => c.x ? c.x(r) : c.g(r)));
    const ag = [cab], re = [cab];
    grupos.forEach(g => { g.m.calls.forEach(r => ag.push(linha(g, r))); g.m.realizadas.forEach(r => re.push(linha(g, r))); });
    /* sobre */
    const p = S.per(), fs = S.descFiltros();
    const sobre = [['Relatório', 'Ranking de ' + NOMES_RK[dim]], ['Período', `${S.fData(p.ini)} a ${S.fData(p.fim)}`],
      ['Data base', dash.params().db === 're' ? 'Data da reunião (sem data e com link: data do agendamento)' : 'Data do agendamento'],
      ['Filtros', fs.length ? fs.join(' · ') : 'Nenhum'], ['Ordenado por', colOrd.t], ['Gerado em', S.fDataHora(S.agora())], [],
      ['Agendadas', 'Leads com reunião criada no período; o mesmo lead conta uma vez por ' + nomeDim.toLowerCase() + '.'],
      ['Realizadas', 'Toda reunião com link de gravação no período (cada reunião com link conta).']];
    S.salvar(`ranking-${S.slug(NOMES_RK[dim])}_${S.dataArq()}.xlsx`, window.SRX.xlsx([
      { nome: 'Ranking', linhas: rk }, { nome: 'Agendadas', linhas: ag }, { nome: 'Realizadas', linhas: re }, { nome: 'Sobre', linhas: sobre }
    ]));
  }
  document.querySelectorAll('[data-baixar-rk]').forEach(b => b.addEventListener('click', () => baixarRanking(b.getAttribute('data-baixar-rk'))));

  dash.draw('rk-sdr', el => pessoas(el, 'sdr', COLS_SDR, 'sdr', 'ord-sdr'));
  dash.draw('rk-closer', el => pessoas(el, 'closer', COLS_CLOSER, 'closer', 'ord-closer'));


  /* =================== NPS CLOSER · QUALIDADE DOS LEADS POR SDR =================== */
  const DC_NOTA = ['lead_nome', 'sdr_agendou_nome', 'closer_nome', 'data_reuniao', 'status', 'nota_closer', 'resultado'];
  const DC_GRAV = ['lead_nome', 'sdr_agendou_nome', 'closer_nome', 'data_reuniao', 'status', 'gravacao', 'link_gravacao'];
  const temNota = r => r.nota_closer_qualificacao_sdr !== '' && r.nota_closer_qualificacao_sdr != null && isFinite(Number(r.nota_closer_qualificacao_sdr));
  const ehMeet = r => /meet\.google\.com/i.test(r.link_gravacao || '');
  function qualidade(rows) {
    const real = rows.filter(r => r._g === 'realizada');
    const aval = rows.filter(temNota), notas = aval.map(r => Number(r.nota_closer_qualificacao_sdr));
    const por = [1, 2, 3, 4, 5].map(n => aval.filter(r => Number(r.nota_closer_qualificacao_sdr) === n));
    const prom = por[4].length, det = por[0].length + por[1].length + por[2].length;
    return {
      real, aval, por, prom, det, media: notas.length ? d3.mean(notas) : null,
      nps: notas.length ? Math.round((prom - det) / notas.length * 100) : null,
      semNota: real.filter(r => !temNota(r)),
      /* conferência: só realizadas no CRM sem nenhum link + links do Meet (avaliar um a um).
         Link de outro site ou do Drive sem arquivo vale como gravação */
      ok: real.filter(r => !ehMeet(r)),
      pend: rows.filter(r => r.realizada_sem_link === 'sim').concat(real.filter(ehMeet)),
      base: real.length + rows.filter(r => r.realizada_sem_link === 'sim').length
    };
  }
  const fNota = v => v == null ? '—' : v.toFixed(1).replace('.', ',');
  const fNps = v => v == null ? '—' : (v > 0 ? '+' : '') + S.fInt(v);
  const COLS_NPS = [
    Object.assign({}, C.realizadas, { dcols: DC_GRAV }),
    { k: 'aval', t: 'Avaliadas', v: m => m.q.aval.length, f: S.fInt, rows: m => m.q.aval, tit: 'Calls avaliadas pelo closer', dcols: DC_NOTA },
    { k: 'nota', t: 'Nota média', v: m => m.q.media, f: fNota, rows: m => m.q.aval, tit: 'Calls avaliadas pelo closer', dcols: DC_NOTA },
    { k: 'nps', t: 'NPS', v: m => m.q.nps, f: fNps, rows: m => m.q.aval, tit: 'Calls avaliadas pelo closer', dcols: DC_NOTA },
    { k: 'semnota', t: 'Realizadas sem nota', v: m => m.q.semNota.length, f: S.fInt, rows: m => m.q.semNota, tit: 'Realizadas sem nota do closer', dcols: DC_NOTA },
  ];
  /* motivo da pendência, agrupado */
  const MOTIVOS = [
    { k: 'sem', t: 'Sem link' },
    { k: 'meet', t: 'Link do Meet (avaliar)' }
  ];
  const motivoDe = r => ehMeet(r) ? 'meet' : 'sem';
  const COLS_GRAV = [
    Object.assign({}, C.realizadas, { dcols: DC_GRAV }),
    { k: 'grav', t: 'Gravações OK', v: m => m.q.ok.length, f: S.fInt, rows: m => m.q.ok, tit: 'Gravações entregues', dcols: DC_GRAV },
    { k: 'pend', t: 'Pendentes', v: m => m.q.pend.length, f: S.fInt, rows: m => m.q.pend, tit: 'Gravações pendentes', dcols: DC_GRAV },
    { k: 'pendp', t: '% pendente', v: m => S.pct(m.q.pend.length, m.q.base), f: S.fP, rows: m => m.q.pend, tit: 'Gravações pendentes', dcols: DC_GRAV }
  ].concat(MOTIVOS.map(x => ({ k: 'm_' + x.k, t: x.t, v: m => m.q.pend.filter(r => motivoDe(r) === x.k).length, f: S.fInt, rows: m => m.q.pend.filter(r => motivoDe(r) === x.k), tit: 'Gravações pendentes · ' + x.t, dcols: DC_GRAV })));
  const NOTA_COR = ['var(--c-ns)', 'var(--laranja)', 'var(--cinza)', 'var(--c-ag)', 'var(--rota)'];
  dash.draw('nps', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    if (!F.calls.length) { S.vazio(el, 'Nenhuma call no período.'); return; }
    const t = qualidade(F.calls);
    const box = E('div', 'sr-nps');
    /* números do topo */
    const ks = E('div', 'sr-kpis sr-npsk tres');
    const kpi = (rot, val, sub, fn, cls) => {
      const b = E('button', 'sr-kpi' + (cls ? ' ' + cls : '')); b.type = 'button';
      b.append(E('span', 'l', rot), E('span', 'n', val), E('span', 'v', sub));
      b.addEventListener('click', fn); ks.appendChild(b);
    };
    const abre = (titulo, rows, cols) => () => S.abrir({ titulo, rows, cols });
    kpi('Nota média do closer', t.media == null ? '—' : fNota(t.media) + ' de 5', `${S.fInt(t.aval.length)} avaliações`, abre('Calls avaliadas pelo closer', t.aval, DC_NOTA));
    kpi('NPS closer', fNps(t.nps), `${S.fInt(t.prom)} notas 5 · ${S.fInt(t.det)} notas 1 a 3`, abre('Calls avaliadas pelo closer', t.aval, DC_NOTA));
    kpi('Realizadas sem nota', S.fInt(t.semNota.length), `de ${S.fInt(t.real.length)} realizadas`, abre('Realizadas sem nota do closer', t.semNota, DC_NOTA));
    box.appendChild(ks);
    /* distribuição das notas */
    if (t.aval.length) {
      const dist = E('div', 'sr-npsdist'), tp = S.tip(box);
      dist.appendChild(E('span', 'rot', 'Notas'));
      const barra = E('div', 'barra');
      [5, 4, 3, 2, 1].forEach(n => {
        const rs = t.por[n - 1]; if (!rs.length) return;
        const b = E('button', '', rs.length / t.aval.length >= 0.06 ? `${n}★ ${S.fInt(rs.length)}` : ''); b.type = 'button';
        b.style.flex = String(rs.length); b.style.background = NOTA_COR[n - 1];
        b.setAttribute('aria-label', `Nota ${n}: ${rs.length} calls`);
        b.addEventListener('pointermove', ev => tp.show(ev, `Nota ${n}`, [['Calls', S.fInt(rs.length)], ['% das avaliações', S.fP(rs.length / t.aval.length)]]));
        b.addEventListener('pointerleave', () => tp.hide());
        b.addEventListener('click', () => S.abrir({ titulo: 'Nota ' + n + ' do closer', rows: rs, cols: DC_NOTA }));
        barra.appendChild(b);
      });
      dist.appendChild(barra); box.appendChild(dist);
    }
    /* tabela por SDR */
    const tab = E('div');
    const grupos = d3.groups(F.calls, r => r._k.sdr).map(([k, rows]) => ({ key: k, nome: S.rotulo('sdr', k), m: Object.assign(S.M(rows, []), { q: qualidade(rows) }) }));
    tabelaRanking(tab, {
      dim: 'sdr', grupos, cols: COLS_NPS, ord: S.st.ord.nps, total: Object.assign(S.M(F.calls, []), { q: t }),
      aoOrdenar: (k, dir) => { S.st.ord.nps = { k, dir }; dash.draw('nps'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Calls realizadas', recorte: ['SDR: ' + g.nome], rows: g.m.q.real, cols: DC_GRAV }) })
    });
    box.appendChild(tab);
    el.replaceChildren(box);
  });

  /* =================== GRAVAÇÕES PENDENTES =================== */
  dash.draw('grav', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const t = qualidade(F.calls);
    if (!t.real.length) { S.vazio(el, 'Nenhuma call realizada no período.'); return; }
    const box = E('div', 'sr-nps');
    const ks = E('div', 'sr-kpis sr-gravk');
    const kpi = (rot, val, sub, rows, tit, cls) => {
      const b = E('button', 'sr-kpi' + (cls ? ' ' + cls : '')); b.type = 'button';
      b.append(E('span', 'l', rot), E('span', 'n', val), E('span', 'v', sub));
      b.addEventListener('click', () => S.abrir({ titulo: tit, rows, cols: DC_GRAV })); ks.appendChild(b);
    };
    kpi('Gravações pendentes', S.fInt(t.pend.length), `de ${S.fInt(t.base)} calls realizadas`, t.pend, 'Gravações pendentes', t.pend.length ? 'alerta' : '');
    kpi('% pendente', S.fP(S.pct(t.pend.length, t.base)), `${S.fInt(t.ok.length)} gravações OK`, t.pend, 'Gravações pendentes');
    const porM = MOTIVOS.map(x => ({ x, rows: t.pend.filter(r => motivoDe(r) === x.k) }));
    const top = porM.slice().sort((a, b) => b.rows.length - a.rows.length)[0];
    kpi('Principal motivo', top && top.rows.length ? top.x.t : '—', top && top.rows.length ? `${S.fInt(top.rows.length)} pendências` : 'Nenhuma pendência', top ? top.rows : [], 'Gravações pendentes · ' + (top ? top.x.t : ''));
    box.appendChild(ks);
    /* motivos em linha */
    const chips = E('div', 'sr-gravm');
    porM.forEach(({ x, rows }) => {
      const b = E('button', 'chip' + (rows.length ? '' : ' zero')); b.type = 'button'; b.disabled = !rows.length;
      b.append(E('b', '', S.fInt(rows.length)), document.createTextNode(' ' + x.t));
      b.addEventListener('click', () => S.abrir({ titulo: 'Gravações pendentes · ' + x.t, rows, cols: DC_GRAV }));
      chips.appendChild(b);
    });
    box.appendChild(chips);
    const tab = E('div');
    const grupos = d3.groups(F.calls, r => r._k.sdr).map(([k, rows]) => ({ key: k, nome: S.rotulo('sdr', k), m: Object.assign(S.M(rows, []), { q: qualidade(rows) }) }))
      .filter(g => g.m.q.real.length);
    tabelaRanking(tab, {
      dim: 'sdr', grupos, cols: COLS_GRAV, ord: S.st.ord.grav, semMedalha: true, total: Object.assign(S.M(F.calls, []), { q: t }),
      aoOrdenar: (k, dir) => { S.st.ord.grav = { k, dir }; dash.draw('grav'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Gravações pendentes', recorte: ['SDR: ' + g.nome], rows: g.m.q.pend, cols: DC_GRAV }) })
    });
    box.appendChild(tab);
    el.replaceChildren(box);
  });

  /* =================== LEADS RECEBIDOS POR SDR (aba leads) =================== */
  const DC_LEAD = ['lead_nome', 'data_entrada', 'sdr_responsavel_nome', 'etapa_atual', 'fonte', 'tag_campanha', 'utm_campaign', 'data_ultima_movimentacao'];
  const ETAPAS = ['Lead Novo', 'Em Contato', 'Contato Realizado', 'Qualificado', 'Reunião Agendada', 'Reunião Realizada', 'Agurdando link (Drive)', 'Proposta enviada', 'Negócio Vendido', 'Desqualificado', 'Negócio Perdido', 'Sem oportunidade'];
  const etapaDe = l => S.limpa(l.etapa_atual) || 'Sem oportunidade';
  const ehDesq = e => S.norm(e) === 'desqualificado';
  S.st.lsdr = S.st.lsdr || { vis: 'dia', ord: { k: 'tot', dir: -1 } };
  function segmento(op, atual, aoMudar) {
    const w = E('div', 'sr-seg'); w.setAttribute('role', 'group');
    op.forEach(([v, t]) => { const b = E('button', v === atual ? 'on' : '', t); b.type = 'button'; b.setAttribute('aria-pressed', String(v === atual)); b.addEventListener('click', () => aoMudar(v)); w.appendChild(b); });
    return w;
  }
  dash.draw('leads-sdr', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const L = F.leads; if (!L.length) { S.vazio(el, 'Nenhum lead entrou no período.'); return; }
    const st = S.st.lsdr, box = E('div', 'sr-nps');
    const topo = E('div', 'sr-row'); topo.style.justifyContent = 'space-between';
    const semSdr = L.filter(l => l._k.sdr === S.SEMK);
    const resumo = E('p', 'sr-hint', `${S.fInt(L.length)} leads no período · ${S.fInt(L.length - semSdr.length)} com SDR responsável · ${S.fInt(semSdr.length)} sem SDR (${S.fP(S.pct(semSdr.length, L.length))})`);
    resumo.style.margin = '0';
    topo.append(resumo, segmento([['dia', 'Por dia'], ['status', 'Por status']], st.vis, v => { st.vis = v; dash.draw('leads-sdr'); }));
    box.appendChild(topo);
    const grupos = d3.groups(L, l => l._k.sdr).map(([k, rows]) => ({ key: k, nome: S.rotulo('sdr', k), rows }));
    if (st.vis === 'dia') {
      const q = S.per(), dias = []; for (let d = q.ini; d <= q.fim; d = S.addDias(d, 1)) dias.push(d);
      const semana = dias.length > 35;
      const chaveT = d => semana ? S.addDias(d, -((S.parse(d).getDay() + 6) % 7)) : d;
      const cols = [...new Set(dias.map(chaveT))];
      const por = new Map(grupos.map(g => [g.key, d3.group(g.rows, l => chaveT(l._ld))]));
      const max = d3.max(grupos.filter(g => g.key !== S.SEMK), g => d3.max(cols, c => ((por.get(g.key).get(c)) || []).length)) || 1;
      const ord = grupos.slice().sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.rows.length - a.rows.length);
      const tw = E('div', 'sr-tw'), t = E('table', 'sr-t sr-ldia');
      const hr = E('tr'); hr.appendChild(E('th', 'nome', 'SDR')); hr.appendChild(E('th', 'n', 'Total'));
      cols.forEach(c => { const th = E('th', 'n dia', semana ? 'sem ' + S.fDM(c) : S.fDM(c)); if (!semana) { const sd = S.SEM[S.parse(c).getDay()]; th.title = sd; if (sd === 'sáb' || sd === 'dom') th.classList.add('fds'); } hr.appendChild(th); });
      const th = E('thead'); th.appendChild(hr); t.appendChild(th);
      const tb = E('tbody');
      const abre = (titulo, rows, rec) => () => S.abrir({ titulo, rows, kind: 'l', cols: DC_LEAD, recorte: rec });
      ord.forEach(g => {
        const tr = E('tr', g.key === S.SEMK ? 'sem' : ''), tn = E('td', 'nome');
        if (g.key !== S.SEMK) { const av = E('span', 'sr-av', g.nome.trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase()); av.style.background = AVCOR[[...g.nome].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % AVCOR.length]; av.setAttribute('aria-hidden', 'true'); tn.appendChild(av); }
        const nb = E('button', 'sr-cell nm', g.nome); nb.type = 'button'; nb.addEventListener('click', abre('Leads recebidos', g.rows, ['SDR: ' + g.nome])); tn.appendChild(nb); tr.appendChild(tn);
        const tt = E('td', 'n'); const tbn = E('button', 'sr-cell', S.fInt(g.rows.length)); tbn.type = 'button'; tbn.style.fontWeight = '800'; tbn.addEventListener('click', abre('Leads recebidos', g.rows, ['SDR: ' + g.nome])); tt.appendChild(tbn); tr.appendChild(tt);
        cols.forEach(c => {
          const rs = por.get(g.key).get(c) || [], td = E('td', 'n c');
          if (rs.length) { const t2 = Math.min(1, rs.length / max), b = E('button', 'sr-hmc', S.fInt(rs.length)); b.type = 'button'; b.style.background = HEAT(Math.max(.08, t2)); b.style.color = corNum(t2); b.addEventListener('click', abre('Leads recebidos', rs, ['SDR: ' + g.nome, (semana ? 'Semana de ' : 'Dia ') + S.fDM(c)])); td.appendChild(b); }
          else td.appendChild(E('span', 'zero', '·'));
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      const tf = E('tfoot'), fr = E('tr'); fr.appendChild(E('td', 'nome', 'Total')); fr.appendChild(E('td', 'n', S.fInt(L.length)));
      const porDia = d3.group(L, l => chaveT(l._ld));
      cols.forEach(c => { const rs = porDia.get(c) || [], td = E('td', 'n'); if (rs.length) { const b = E('button', 'sr-cell', S.fInt(rs.length)); b.type = 'button'; b.addEventListener('click', abre('Leads recebidos', rs, [(semana ? 'Semana de ' : 'Dia ') + S.fDM(c)])); td.appendChild(b); } else td.textContent = '·'; fr.appendChild(td); });
      tf.appendChild(fr); t.appendChild(tf); tw.appendChild(t); box.appendChild(tw);
      if (semana) box.appendChild(E('p', 'sr-hint', 'Período longo: os leads aparecem somados por semana (a partir da segunda-feira).'));
    } else {
      const presentes = new Set(L.map(etapaDe));
      const lista = ETAPAS.filter(e => presentes.has(e)).concat([...presentes].filter(e => !ETAPAS.includes(e)).sort());
      const mk = rows => ({ calls: rows, rows, por: d3.group(rows, etapaDe) });
      const cols = [{ k: 'tot', t: 'Recebidos', v: m => m.rows.length, f: S.fInt, rows: m => m.rows, tit: 'Leads recebidos', kind: 'l', dcols: DC_LEAD }]
        .concat(lista.map(e => ({ k: 'e_' + e, t: e === 'Agurdando link (Drive)' ? 'Aguardando link' : e, v: m => (m.por.get(e) || []).length, f: S.fInt, rows: m => m.por.get(e) || [], tit: 'Leads · ' + e, kind: 'l', dcols: DC_LEAD })))
        .concat([{ k: 'pdesq', t: '% desqualificados', v: m => S.pct((m.por.get('Desqualificado') || []).length, m.rows.length), f: S.fP, rows: m => m.por.get('Desqualificado') || [], tit: 'Leads desqualificados', kind: 'l', dcols: DC_LEAD }]);
      const tab = E('div');
      tabelaRanking(tab, {
        dim: 'sdr', nomeCol: 'SDR responsável', grupos: grupos.map(g => ({ key: g.key, nome: g.nome, m: mk(g.rows) })), cols, ord: st.ord, total: mk(L),
        aoOrdenar: (k, dir) => { st.ord = { k, dir }; dash.draw('leads-sdr'); },
        nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Leads recebidos', recorte: ['SDR: ' + g.nome], rows: g.m.rows, kind: 'l', cols: DC_LEAD }) })
      });
      box.appendChild(tab);
      box.appendChild(E('p', 'sr-hint', 'Status = etapa atual do lead no CRM. "Sem oportunidade" = o lead ainda não virou oportunidade.'));
    }
    el.replaceChildren(box);
  });

  /* =================== LEADS CRIADOS POR CAMPANHA (1ª tag) =================== */
  const DC_CAMP = ['lead_nome', 'data_entrada', 'campanha', 'dono_atual_nome', 'sdr_responsavel_nome', 'etapa_atual', 'tags', 'utm_campaign'];
  const SEM_TAG = 'Sem tag', SEM_DONO = 'Sem proprietário', TOPN = 8;
  const campDe = l => { const t = S.limpa(String(l.tags || '').split('|')[0]); return t ? t.toLowerCase() : SEM_TAG; };
  const donoDe = l => S.limpa(l.dono_atual_nome) || SEM_DONO;
  const COR_OUT = () => escuro() ? '#5B5B66' : '#C9CCD6';
  S.st.camp = S.st.camp || { sel: null };
  function pizza(alvo, itens, total, o) {
    const W = 220, R = W / 2, r0 = R * .58;
    const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${W}`).attr('class', 'sr-pz').attr('role', 'img').attr('aria-label', o.rotulo);
    const g = svg.append('g').attr('transform', `translate(${R},${R})`);
    const arcs = d3.pie().sort(null).value(d => d.rows.length).padAngle(itens.length > 1 ? .012 : 0)(itens);
    const arc = d3.arc().innerRadius(r0).outerRadius(R - 6).cornerRadius(3), arcOn = d3.arc().innerRadius(r0).outerRadius(R).cornerRadius(3);
    g.selectAll('path').data(arcs).join('path')
      .attr('d', d => (o.sel === d.data.key ? arcOn : arc)(d)).attr('fill', d => d.data.cor)
      .attr('class', d => 'fat' + (o.sel && o.sel !== d.data.key ? ' apaga' : ''))
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', d => `${d.data.nome}: ${S.fInt(d.data.rows.length)} leads (${S.fP(S.pct(d.data.rows.length, total))})`)
      .on('click', (ev, d) => o.clique(d.data))
      .on('keydown', (ev, d) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); o.clique(d.data); } })
      .append('title').text(d => `${d.data.nome}\n${S.fInt(d.data.rows.length)} leads · ${S.fP(S.pct(d.data.rows.length, total))}`);
    g.append('text').attr('class', 'pz-n').attr('text-anchor', 'middle').attr('dy', '.1em').text(S.fInt(o.centroN == null ? total : o.centroN));
    g.append('text').attr('class', 'pz-l').attr('text-anchor', 'middle').attr('dy', '1.6em').text(o.centro);
    alvo.appendChild(svg.node());
  }
  function legenda(alvo, itens, total, o) {
    const ul = E('ul', 'sr-pzl');
    itens.forEach(it => {
      const li = E('li', o.sel === it.key ? 'on' : (o.sel ? 'apaga' : ''));
      const b = E('button', 'sr-pzb'); b.type = 'button'; if (o.sel != null) b.setAttribute('aria-pressed', String(o.sel === it.key));
      const sw = E('i'); sw.style.background = it.cor;
      const nm = E('span', 'nm', it.nome); nm.title = it.nome;
      b.append(sw, nm, E('b', '', S.fInt(it.rows.length)), E('span', 'p', S.fP(S.pct(it.rows.length, total))));
      b.addEventListener('click', () => o.clique(it)); li.appendChild(b); ul.appendChild(li);
    });
    alvo.appendChild(ul);
  }
  dash.draw('leads-camp', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const L = F.leads; if (!L.length) { S.vazio(el, 'Nenhum lead entrou no período.'); return; }
    const st = S.st.camp;
    const todas = d3.groups(L, campDe).map(([k, rows]) => ({ key: k, nome: k, rows })).sort((a, b) => (a.key === SEM_TAG) - (b.key === SEM_TAG) || b.rows.length - a.rows.length);
    let camps = todas;
    if (todas.length > TOPN + 1) {
      const resto = todas.slice(TOPN);
      camps = todas.slice(0, TOPN).concat([{ key: '__outras', nome: `Outras (${resto.length} tags)`, rows: resto.flatMap(c => c.rows), outras: resto }]);
    }
    camps.forEach((c, i) => { c.cor = c.key === '__outras' || c.key === SEM_TAG ? COR_OUT() : AVCOR[i % AVCOR.length]; });
    if (!camps.some(c => c.key === st.sel)) st.sel = camps[0].key;
    const atual = camps.find(c => c.key === st.sel);
    const box = E('div', 'sr-pzbox');
    /* campanhas */
    const c1 = E('div', 'sr-pzcol');
    c1.appendChild(E('h3', 'sr-sub3', 'Leads por campanha'));
    const w1 = E('div', 'sr-pzw');
    const clique1 = it => { st.sel = it.key; dash.draw('leads-camp'); };
    pizza(w1, camps, L.length, { sel: st.sel, centro: 'leads criados', rotulo: 'Leads criados por campanha', clique: clique1 });
    legenda(w1, camps, L.length, { sel: st.sel, clique: clique1 });
    c1.appendChild(w1); box.appendChild(c1);
    /* proprietários da campanha escolhida */
    const c2 = E('div', 'sr-pzcol');
    const h = E('h3', 'sr-sub3'); h.append(document.createTextNode('Proprietários · '), E('span', 'sr-pzsel', atual.nome)); c2.appendChild(h);
    const donos = d3.groups(atual.rows, donoDe).map(([k, rows]) => ({ key: k, nome: k, rows })).sort((a, b) => (a.key === SEM_DONO) - (b.key === SEM_DONO) || b.rows.length - a.rows.length);
    const nDonos = donos.filter(d => d.key !== SEM_DONO).length;
    let fatias = donos;
    if (donos.length > TOPN + 1) {
      const resto = donos.slice(TOPN);
      fatias = donos.slice(0, TOPN).concat([{ key: '__outros', nome: `Outros (${resto.length} proprietários)`, rows: resto.flatMap(d => d.rows) }]);
    }
    fatias.forEach((d, i) => { d.cor = d.key === SEM_DONO || d.key === '__outros' ? COR_OUT() : AVCOR[i % AVCOR.length]; });
    donos.forEach((d, i) => { if (!d.cor) d.cor = i < TOPN ? AVCOR[i % AVCOR.length] : COR_OUT(); });
    const w2 = E('div', 'sr-pzw');
    const rec = d => ['Campanha: ' + atual.nome, 'Proprietário: ' + d.nome];
    const clique2 = d => S.abrir({ titulo: 'Leads criados', recorte: rec(d), rows: d.rows, kind: 'l', cols: DC_CAMP });
    pizza(w2, fatias, atual.rows.length, { centro: nDonos === 1 ? 'proprietário' : 'proprietários', centroN: nDonos, rotulo: 'Proprietários dos leads da campanha ' + atual.nome, clique: clique2 });
    const lw = E('div', 'sr-pzlw');
    legenda(lw, st.todos ? donos : fatias, atual.rows.length, { clique: clique2 });
    if (fatias !== donos) {
      const tg = E('button', 'sr-pzmais', st.todos ? 'Agrupar os menores' : `Mostrar todos os ${S.fInt(donos.length)}`); tg.type = 'button';
      tg.addEventListener('click', () => { st.todos = !st.todos; dash.draw('leads-camp'); });
      lw.appendChild(tg);
    }
    w2.appendChild(lw);
    c2.appendChild(w2);
    const ver = E('button', 'sr-btn sr-pzver', `Ver os ${S.fInt(atual.rows.length)} leads da campanha`); ver.type = 'button';
    ver.addEventListener('click', () => S.abrir({ titulo: 'Leads criados', recorte: ['Campanha: ' + atual.nome], rows: atual.rows, kind: 'l', cols: DC_CAMP }));
    c2.appendChild(ver);
    box.appendChild(c2);
    el.replaceChildren(box);
    if (atual.outras) el.appendChild(E('p', 'sr-hint', 'Outras: ' + atual.outras.map(c => `${c.nome} (${S.fInt(c.rows.length)})`).join(' · ')));
  });

  /* =================== DESQUALIFICAÇÕES E PERDAS (aba negocios) =================== */
  const DC_NEG = ['lead_nome', 'sdr_origem_nome', 'closer_nome', 'pipeline', 'etapa_atual', 'resultado_neg', 'motivo_unificado', 'tag_principal', 'data_criacao', 'data_ultima_movimentacao'];
  const DC_MOT = ['lead_nome', 'motivo_unificado', 'motivo_perda_custom', 'motivo_perda_nativo', 'tag_principal', 'vendedor', 'sdr_origem_nome', 'etapa_atual', 'resultado_neg', 'data_criacao'];
  S.st.perdas = S.st.perdas || { ordS: { k: 'desq', dir: -1 }, ordC: { k: 'perdida', dir: -1 } };
  S.st.mot = S.st.mot || { sel: '', por: 'tag', ord: { k: 'tot', dir: -1 } };
  /* motivo de perda unificado: junta o motivo personalizado (campo da equipe) e o nativo do CRM
     num nome só. Quando os dois existem, vale o personalizado. */
  const SEM_MOTIVO = 'Sem motivo no CRM';
  const MOTIVOS_U = [
    [/no.?show|nao compareceu/, 'No-show'],
    [/sem capital/, 'Sem capital disponível'],
    [/fora do perfil|perfil de locacao|alugar (uma )?moto/, 'Fora do perfil'],
    [/nao e o momento|adiar/, 'Não é o momento'],
    [/concorrente/, 'Fechou com concorrente'],
    [/sem resposta|sumiu/, 'Sem resposta / sumiu'],
    [/credito|financiamento/, 'Crédito / financiamento negado'],
    [/telefone/, 'Telefone incorreto'],
    [/duplicad|reinscri/, 'Lead duplicado'],
    [/desconfian/, 'Desconfiança no modelo']
  ];
  const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function motivoUnificado(custom, nativo) {
    const bruto = S.limpa(custom) || S.limpa(nativo);
    if (!bruto) return '';
    const n = semAcento(bruto);
    for (const [re, nome] of MOTIVOS_U) if (re.test(n)) return nome;
    const curto = bruto.replace(/:.*$/, '').trim();
    return curto.charAt(0).toUpperCase() + curto.slice(1);
  }
  let negCache = null;
  function negocios() {
    const N = dash.data('negocios'), D = S.dados();
    if (!D.ok || !N || N.status !== 'ok' || !Array.isArray(N.data)) return null;
    if (negCache && negCache.n === N.data && negCache.d === D) return negCache.v;
    const porLead = new Map(D.leads.map(l => [l.lead_id, l]));
    const k = v => { const x = S.norm(v); return x || S.SEMK; };
    const v = N.data.filter(o => o.oportunidade_id).map(o => {
      const l = porLead.get(o.lead_id) || {}, r = S.norm(o.resultado);
      const x = {
        lead_id: o.lead_id, lead_nome: S.limpa(o.nome) || l.lead_nome || '', data_entrada: l.data_entrada || '', sdr_origem_nome: S.limpa(o.sdr_origem_nome), closer_nome: S.limpa(o.closer_nome),
        pipeline: S.limpa(o.pipeline), etapa_atual: S.limpa(o.etapa), resultado: S.limpa(o.resultado), motivo_perda: S.limpa(o.motivo_perda), data_criacao: o.data_criacao || '',
        motivo_perda_custom: S.limpa(o.motivo_perda_custom), motivo_perda_nativo: S.limpa(o.motivo_perda_nativo), dono_atual_nome: S.limpa(o.dono_atual_nome),
        data_fechamento: o.data_fechamento || '', modelo_franquia: S.limpa(o.modelo_franquia), master_franquia: S.limpa(o.master_franquia), utm_source: S.limpa(o.utm_source), _df: S.dia(o.data_fechamento || o.data_ultima_movimentacao),
        data_ultima_movimentacao: o.data_ultima_movimentacao || '', valor: Number(o.valor) || 0, tag_campanha: S.limpa(o.tag_campanha), utm_campaign: S.limpa(o.utm_campaign),
        _dc: S.dia(o.data_criacao), _desq: S.norm(o.etapa) === 'desqualificado', _perd: r === 'perdido', _aband: r === 'abandonado', _ns: r === 'no_show', _ganho: r === 'ganho'
      };
      x._fora = x._desq || x._perd || x._aband || x._ns;
      x._venda = S.norm(x.pipeline) === 'closer' && (S.norm(x.etapa_atual) === 'negócio vendido' || x._ganho);
      x._call = D.porLead.has(x.lead_id);
      x.motivo_unificado = motivoUnificado(x.motivo_perda_custom || x.motivo_perda, x.motivo_perda_nativo);
      x.vendedor = x.closer_nome || x.dono_atual_nome || '';
      x.tag_principal = S.limpa(String(x.tag_campanha || (l.tags || '') || '').split('|')[0]).toLowerCase();
      x.tags = l.tags || x.tag_campanha; x.utm_medium = l.utm_medium || ''; x.utm_content = l.utm_content || ''; x.utm_campaign = x.utm_campaign || l.utm_campaign || ''; x.utm_source = x.utm_source || l.utm_source || ''; x.fonte = l.fonte || '';
      x.sdr_responsavel_nome = l.sdr_responsavel_nome || ''; marcaGestor(x);
      x._k = Object.assign({}, l._k || {}, { sdr: x.sdr_origem_nome ? k(x.sdr_origem_nome) : ((l._k || {}).sdr || S.SEMK), closer: k(x.closer_nome), pipe: k(x.pipeline) });
      S.FDIMS.forEach(d => { if (!x._k[d]) x._k[d] = S.SEMK; });
      return x;
    });
    negCache = { n: N.data, d: D, v };
    return v;
  }
  dash.draw('perdas-neg', el => {
    const F = S.full(), D = S.dados(), todos = negocios();
    if (!F || !todos) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const f = S.filtros();
    const O = todos.filter(o => o._dc >= F.a && o._dc <= F.b && S.passa(o, 'l', null, f));
    if (!O.length) { S.vazio(el, 'Nenhuma oportunidade criada no período.'); return; }
    const st = S.st.perdas, box = E('div', 'sr-nps');
    const fora = O.filter(o => o._fora), desq = O.filter(o => o._desq);
    const ks = E('div', 'sr-kpis sr-npsk');
    const kpi = (rot, val, sub, rows, tit, cls) => { const b = E('button', 'sr-kpi' + (cls ? ' ' + cls : '')); b.type = 'button'; b.append(E('span', 'l', rot), E('span', 'n', val), E('span', 'v', sub)); b.addEventListener('click', () => S.abrir({ titulo: tit, rows, kind: 'l', cols: DC_NEG })); ks.appendChild(b); };
    kpi('Oportunidades criadas', S.fInt(O.length), `${S.fInt(O.filter(o => S.norm(o.pipeline) === 'closer').length)} já no pipeline do closer`, O, 'Oportunidades criadas');
    kpi('Desqualificadas pelo SDR', S.fInt(desq.length), S.fP(S.pct(desq.length, O.length)) + ' das oportunidades', desq, 'Oportunidades desqualificadas', desq.length ? 'alerta' : '');
    const perdC = O.filter(o => o._perd || o._ns || o._aband);
    kpi('Perdidas, abandonadas e no-show', S.fInt(perdC.length), S.fP(S.pct(perdC.length, O.length)) + ' das oportunidades', perdC, 'Oportunidades perdidas');
    const ganhas = O.filter(o => o._ganho);
    kpi('Ganhas', S.fInt(ganhas.length), S.fP(S.pct(ganhas.length, O.length)) + ' das oportunidades', ganhas, 'Oportunidades ganhas');
    box.appendChild(ks);
    const g2 = E('div', 'sr-pilha');
    const mk = rows => ({ calls: rows, rows, desq: rows.filter(o => o._desq), perd: rows.filter(o => o._perd), aband: rows.filter(o => o._aband), ns: rows.filter(o => o._ns), ganho: rows.filter(o => o._ganho), fora: rows.filter(o => o._fora), aberto: rows.filter(o => !o._fora && !o._ganho) });
    const c = (k, t, sel, tit, f) => ({ k, t, v: f ? (m => f(m)) : (m => sel(m).length), f: f ? S.fP : S.fInt, rows: m => sel(m), tit, kind: 'l', dcols: DC_NEG });
    /* por SDR */
    const sBox = E('div'); sBox.appendChild(E('h3', 'sr-sub3', 'Por SDR de origem'));
    const gs = d3.groups(O, o => o._k.sdr).map(([k, rows]) => ({ key: k, nome: S.rotulo('sdr', k) === k && rows[0].sdr_origem_nome ? rows[0].sdr_origem_nome : S.rotulo('sdr', k), m: mk(rows) }));
    const tS = E('div');
    tabelaRanking(tS, {
      dim: 'sdr', nomeCol: 'SDR', grupos: gs, ord: st.ordS, total: mk(O),
      cols: [c('opps', 'Oportunidades', m => m.rows, 'Oportunidades'), c('desq', 'Desqualificadas', m => m.desq, 'Desqualificadas'), c('perd', 'Perdidas', m => m.perd, 'Perdidas'), c('aband', 'Abandonadas', m => m.aband, 'Abandonadas'), c('pdesq', '% desqualif.', m => m.desq, 'Desqualificadas', m => S.pct(m.desq.length, m.rows.length))],
      aoOrdenar: (k, dir) => { st.ordS = { k, dir }; dash.draw('perdas-neg'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Oportunidades', recorte: ['SDR: ' + g.nome], rows: g.m.rows, kind: 'l', cols: DC_NEG }) })
    });
    sBox.appendChild(tS);
    /* por closer */
    const cBox = E('div'); cBox.appendChild(E('h3', 'sr-sub3', 'Por closer'));
    const comCloser = O.filter(o => o._k.closer !== S.SEMK);
    const gc = d3.groups(comCloser, o => o._k.closer).map(([k, rows]) => ({ key: k, nome: rows[0].closer_nome || S.rotulo('closer', k), m: mk(rows) }));
    const tC = E('div');
    if (gc.length) tabelaRanking(tC, {
      dim: 'closer', nomeCol: 'Closer', grupos: gc, ord: st.ordC, total: mk(comCloser),
      cols: [c('opps', 'Recebidas', m => m.rows, 'Oportunidades do closer'), c('perdida', 'Perdidas', m => m.perd, 'Perdidas'), c('ns', 'No-show', m => m.ns, 'No-show'), c('aband', 'Abandonadas', m => m.aband, 'Abandonadas'), c('ganho', 'Ganhas', m => m.ganho, 'Ganhas'), c('pperda', '% perda', m => [...m.perd, ...m.ns, ...m.aband], 'Perdidas, no-show e abandonadas', m => S.pct(m.perd.length + m.ns.length + m.aband.length, m.rows.length))],
      aoOrdenar: (k, dir) => { st.ordC = { k, dir }; dash.draw('perdas-neg'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Oportunidades', recorte: ['Closer: ' + g.nome], rows: g.m.rows, kind: 'l', cols: DC_NEG }) })
    });
    else S.vazio(tC, 'Nenhuma oportunidade com closer no período.');
    cBox.appendChild(tC);
    g2.append(sBox, cBox); box.appendChild(g2);
    el.replaceChildren(box);
  });

  /* =================== MOTIVOS DE PERDA (unificados) por tag e por vendedor =================== */
  dash.draw('motivos', el => {
    const F = S.full(), D = S.dados(), todos = negocios();
    if (!F || !todos) { S.vazio(el, S.estado(D && D.ok ? dash.data('negocios') : D)); return; }
    const f = S.filtros();
    const O = todos.filter(o => o._dc >= F.a && o._dc <= F.b && S.passa(o, 'l', null, f) && (o._fora || o.motivo_unificado));
    if (!O.length) { S.vazio(el, 'Nenhuma oportunidade perdida ou desqualificada no período.'); return; }
    const st = S.st.mot, box = E('div', 'sr-nps');
    const motDe = o => o.motivo_unificado || SEM_MOTIVO;
    const lista = d3.rollups(O, v => v, motDe).sort((a, b) => (a[0] === SEM_MOTIVO) - (b[0] === SEM_MOTIVO) || b[1].length - a[1].length);
    if (st.sel && !lista.some(([m]) => m === st.sel)) st.sel = '';
    /* filtro de motivo */
    const fl = E('div', 'sr-motf'); fl.setAttribute('role', 'group'); fl.setAttribute('aria-label', 'Filtrar por motivo de perda');
    const chip = (rot, n, val) => {
      const b = E('button', 'chip' + (st.sel === val ? ' on' : '') + (val === SEM_MOTIVO ? ' sem' : '')); b.type = 'button';
      b.setAttribute('aria-pressed', String(st.sel === val));
      b.append(E('b', '', S.fInt(n)), document.createTextNode(' ' + rot));
      b.addEventListener('click', () => { st.sel = st.sel === val ? '' : val; st.ord = { k: st.sel ? 'foco' : 'tot', dir: -1 }; dash.draw('motivos'); });
      fl.appendChild(b);
    };
    chip('Todos os motivos', O.length, '');
    lista.forEach(([m, rows]) => chip(m, rows.length, m));
    box.appendChild(fl);
    const comMot = O.filter(o => o.motivo_unificado);
    box.appendChild(E('p', 'sr-hint', `${S.fInt(comMot.length)} de ${S.fInt(O.length)} oportunidades perdidas ou desqualificadas têm motivo (${S.fP(S.pct(comMot.length, O.length))}). Motivo = campo personalizado da equipe; quando vazio, o motivo nativo do CRM.`));
    /* por tag / por vendedor */
    const topo = E('div', 'sr-row'); topo.style.justifyContent = 'space-between';
    topo.appendChild(E('h3', 'sr-sub3', st.sel ? 'Motivo: ' + st.sel : 'Todos os motivos'));
    topo.appendChild(segmento([['tag', 'Por tag'], ['vend', 'Por vendedor']], st.por, v => { st.por = v; dash.draw('motivos'); }));
    box.appendChild(topo);
    const dimDe = st.por === 'tag' ? (o => o.tag_principal || S.SEMK) : (o => o.vendedor || S.SEMK);
    const nomeCol = st.por === 'tag' ? 'Tag (1ª tag)' : 'Vendedor';
    const semNome = st.por === 'tag' ? 'Sem tag' : 'Sem vendedor';
    const sel = st.sel;
    const mk = rows => ({ calls: rows, rows, foco: sel ? rows.filter(o => motDe(o) === sel) : rows, por: d3.group(rows, motDe) });
    let cols;
    if (sel) {
      cols = [
        { k: 'foco', t: sel, v: m => m.foco.length, f: S.fInt, rows: m => m.foco, tit: 'Motivo: ' + sel, kind: 'l', dcols: DC_MOT },
        { k: 'tot', t: 'Total perdido', v: m => m.rows.length, f: S.fInt, rows: m => m.rows, tit: 'Perdidas e desqualificadas', kind: 'l', dcols: DC_MOT },
        { k: 'pfoco', t: '% do total', v: m => S.pct(m.foco.length, m.rows.length), f: S.fP, rows: m => m.foco, tit: 'Motivo: ' + sel, kind: 'l', dcols: DC_MOT }
      ];
    } else {
      cols = [{ k: 'tot', t: 'Total', v: m => m.rows.length, f: S.fInt, rows: m => m.rows, tit: 'Perdidas e desqualificadas', kind: 'l', dcols: DC_MOT }]
        .concat(lista.map(([mm]) => ({ k: 'm_' + mm, t: mm, v: m => (m.por.get(mm) || []).length, f: S.fInt, rows: m => m.por.get(mm) || [], tit: 'Motivo: ' + mm, kind: 'l', dcols: DC_MOT })));
    }
    if (!cols.some(c => c.k === st.ord.k)) st.ord = { k: sel ? 'foco' : 'tot', dir: -1 };
    let grupos = d3.groups(O, dimDe).map(([k, rows]) => ({ key: k, nome: k === S.SEMK ? semNome : k, m: mk(rows) }));
    if (sel) grupos = grupos.filter(g => g.m.foco.length);
    const tw = E('div', 'sr-motw');
    tabelaRanking(tw, {
      dim: st.por === 'tag' ? 'tag' : 'closer', nomeCol, grupos, cols, ord: st.ord, semMedalha: true, total: mk(O),
      aoOrdenar: (k, dir) => { st.ord = { k, dir }; dash.draw('motivos'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: sel ? 'Motivo: ' + sel : 'Perdidas e desqualificadas', recorte: [nomeCol + ': ' + g.nome], rows: g.m.foco, kind: 'l', cols: DC_MOT }) })
    });
    box.appendChild(tw);
    if (st.por === 'vend') box.appendChild(E('p', 'sr-hint', 'Vendedor = closer da oportunidade; quando não tem closer (perdas no pipeline do SDR), o dono atual.'));
    el.replaceChildren(box);
  });

  /* =================== SAÚDE DO FUNIL (leads + reuniões + negócios) =================== */
  const mediana = xs => { const v = xs.filter(x => x != null && x !== '' && isFinite(x) && x >= 0).map(Number).sort((a, b) => a - b); if (!v.length) return null; const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const ETAPAS_QUALI = ['qualificado', 'reuniao agendada', 'reuniao realizada', 'agurdando link (drive)', 'proposta enviada', 'negocio vendido'];
  dash.draw('saude', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const L = F.leads, C = F.calls, agora = S.agora();
    const ks = E('div', 'sr-kpis sr-saude');
    const kpi = (rot, val, sub, rows, tit, kind, cols, cls, dica) => {
      const b = E('button', 'sr-kpi' + (cls ? ' ' + cls : '')); b.type = 'button';
      const l = E('span', 'l', rot); if (dica) l.title = dica;
      b.append(l, E('span', 'n', val), E('span', 'v', sub));
      b.addEventListener('click', () => S.abrir({ titulo: tit, rows, kind, cols })); ks.appendChild(b);
    };
    const semSdr = L.filter(l => l._k.sdr === S.SEMK);
    kpi('Leads sem SDR', S.fInt(semSdr.length), S.fP(S.pct(semSdr.length, L.length)) + ' dos leads do período', semSdr, 'Leads sem SDR responsável', 'l', DC_LEAD, semSdr.length ? 'alerta' : '', 'Leads que entraram e não têm SDR responsável no CRM');
    const parados = L.filter(l => { if (S.norm(l.status_lead) !== 'aberto') return false; const e = S.norm(l.etapa_atual); if (['desqualificado', 'negocio perdido', 'negocio vendido'].includes(e)) return false; const d = S.difDias(l.data_ultima_movimentacao || l.data_entrada, agora); l._parado = d; return d != null && d >= 3; });
    kpi('Leads parados há 3+ dias', S.fInt(parados.length), 'em aberto, sem movimentação', parados, 'Leads parados há 3 dias ou mais', 'l', DC_LEAD.concat(['dias_parado']), parados.length ? 'alerta' : '', 'Oportunidades em aberto cuja última movimentação foi há 3 dias ou mais');
    const comOpp = L.filter(l => S.limpa(l.etapa_atual));
    const quali = comOpp.filter(l => ETAPAS_QUALI.includes(S.norm(l.etapa_atual)) || (D.porLead.get(l.lead_id) || []).length);
    kpi('Taxa de qualificação', S.fP(S.pct(quali.length, comOpp.length)), `${S.fInt(quali.length)} de ${S.fInt(comOpp.length)} oportunidades`, quali, 'Leads qualificados ou com call', 'l', DC_LEAD, '', 'Dos leads do período que viraram oportunidade, quantos chegaram a Qualificado ou além (ou tiveram call)');
    const ta = mediana(C.map(r => r.dias_lead_ate_agendamento));
    kpi('Tempo até agendar', S.fDias(ta), 'mediana: entrada → call agendada', C, 'Calls do período', 'c', null, '', 'Metade das calls foi agendada em até esse tempo depois da entrada do lead');
    const tr = mediana(C.map(r => r.dias_agendamento_ate_reuniao));
    kpi('Agendamento → reunião', S.fDias(tr), 'mediana até a call acontecer', C, 'Calls do período', 'c', null, '', 'Metade das calls aconteceu em até esse tempo depois de agendada');
    const rem = C.filter(r => r._rem);
    kpi('Calls remarcadas', S.fInt(rem.length), S.fP(S.pct(rem.length, C.length)) + ' das calls', rem, 'Calls remarcadas', 'c');
    const volta = L.filter(l => S.norm(l.tag_retorno).includes('noshow'));
    kpi('No-show que voltou pro SDR', S.fInt(volta.length), 'leads com a tag de retorno', volta, 'No-show que voltou para o SDR', 'l', DC_LEAD);
    const gan = C.filter(r => r._res === 'ganho');
    const ciclo = mediana(gan.map(r => r.dias_reuniao_ate_fechamento));
    kpi('Ciclo de venda', S.fDias(ciclo), 'mediana: reunião → fechamento', gan, 'Calls que viraram venda', 'c', null, '', 'Metade das vendas fechou em até esse tempo depois da reunião');
    el.replaceChildren(ks);
  });

  /* =================== CONVERSÃO POR SDR E POR CLOSER =================== */
  S.st.conv = S.st.conv || { ordS: { k: 'calls', dir: -1 }, ordC: { k: 'vendas', dir: -1 } };
  dash.draw('conversao', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    if (!F.calls.length && !F.leads.length) { S.vazio(el, 'Nenhum lead ou call no período.'); return; }
    const st = S.st.conv, box = E('div', 'sr-nps'), t = F.m;
    /* funil resumido */
    const ks = E('div', 'sr-kpis sr-convk');
    const kpi = (rot, val, sub, rows, tit, kind) => { const b = E('button', 'sr-kpi'); b.type = 'button'; b.append(E('span', 'l', rot), E('span', 'n', val), E('span', 'v', sub)); b.addEventListener('click', () => S.abrir({ titulo: tit, rows, kind })); ks.appendChild(b); };
    kpi('Leads recebidos', S.fInt(F.leads.length), 'entraram no período', F.leads, 'Leads recebidos', 'l');
    kpi('Reuniões agendadas', S.fInt(t.calls.length), S.fP(S.pct(t.calls.length, F.leads.length)) + ' dos leads', t.calls, 'Reuniões agendadas');
    kpi('Reuniões concluídas', S.fInt(t.realizadas.length), S.fP(S.pct(t.realizadas.length, t.calls.length)) + ' das agendadas', t.realizadas, 'Reuniões concluídas');
    kpi('Vendas', S.fInt(t.vendas.length), S.fP(S.pct(t.vendas.length, t.realizadas.length)) + ' das concluídas', t.vendas, 'Vendas');
    box.appendChild(ks);
    const pct = (k, t2, num, den, rows, tit) => ({ k, t: t2, v: m => S.pct(num(m), den(m)), f: S.fP, rows, tit });
    /* SDR: leads pelo SDR responsável; reuniões e vendas pelo SDR que agendou */
    const sBox = E('div'); sBox.appendChild(E('h3', 'sr-sub3', 'SDR'));
    const cS = d3.group(F.calls, r => r._k.sdr), lS = d3.group(F.leads, l => l._k.sdr);
    const keysS = [...new Set([...cS.keys(), ...lS.keys()])];
    const gS = keysS.map(k => ({ key: k, nome: S.rotulo('sdr', k), m: S.M(cS.get(k) || [], lS.get(k) || [], F.a, F.b) }));
    const tS = E('div');
    tabelaRanking(tS, {
      dim: 'sdr', grupos: gS, ord: st.ordS, total: t,
      cols: [
        Object.assign({}, C.leads, { t: 'Leads recebidos', tit: 'Leads recebidos' }),
        Object.assign({}, C.calls, { t: 'Agendadas', tit: 'Reuniões agendadas' }),
        Object.assign({}, C.realizadas, { t: 'Concluídas', tit: 'Reuniões concluídas' }),
        C.vendas,
        pct('cag', 'Conv. agendamento', m => m.calls.length, m => m.leads.length, m => m.calls, 'Reuniões agendadas'),
        pct('ccall', 'Conv. calls', m => m.realizadas.length, m => m.calls.length, m => m.realizadas, 'Reuniões concluídas'),
        pct('cven', 'Conv. vendas', m => m.vendas.length, m => m.realizadas.length, m => m.vendas, 'Vendas')
      ],
      aoOrdenar: (k, dir) => { st.ordS = { k, dir }; dash.draw('conversao'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Reuniões agendadas', recorte: ['SDR: ' + g.nome], rows: g.m.calls }) })
    });
    sBox.appendChild(tS);
    sBox.appendChild(E('p', 'sr-hint', 'Leads recebidos contam pelo SDR responsável do lead; reuniões e vendas, pelo SDR que agendou a call. Conv. agendamento = agendadas ÷ leads · Conv. calls = concluídas ÷ agendadas · Conv. vendas = vendas ÷ concluídas.'));
    /* Closer */
    const cBox = E('div'); cBox.appendChild(E('h3', 'sr-sub3', 'Closer'));
    const comC = F.calls.filter(r => r._k.closer !== S.SEMK);
    const gC = d3.groups(F.calls, r => r._k.closer).map(([k, rows]) => ({ key: k, nome: S.rotulo('closer', k), m: S.M(rows, [], F.a, F.b) }));
    const tC = E('div');
    tabelaRanking(tC, {
      dim: 'closer', grupos: gC, ord: st.ordC, total: S.M(comC, [], F.a, F.b),
      cols: [
        Object.assign({}, C.calls, { t: 'Agendamentos recebidos', tit: 'Agendamentos recebidos' }),
        Object.assign({}, C.realizadas, { t: 'Reuniões concluídas', tit: 'Reuniões concluídas' }),
        C.vendas,
        pct('cconc', 'Taxa de conclusão', m => m.realizadas.length, m => m.calls.length, m => m.realizadas, 'Reuniões concluídas'),
        pct('cconv', 'Taxa de conversão', m => m.vendas.length, m => m.realizadas.length, m => m.vendas, 'Vendas'),
        C.valor
      ],
      aoOrdenar: (k, dir) => { st.ordC = { k, dir }; dash.draw('conversao'); },
      nomeAcao: g => ({ fn: () => S.abrir({ titulo: 'Agendamentos recebidos', recorte: ['Closer: ' + g.nome], rows: g.m.calls }) })
    });
    cBox.appendChild(tC);
    cBox.appendChild(E('p', 'sr-hint', 'Taxa de conclusão = concluídas ÷ agendamentos recebidos · Taxa de conversão = vendas ÷ reuniões concluídas.'));
    const pilha = E('div', 'sr-pilha'); pilha.append(sBox, cBox); box.appendChild(pilha);
    el.replaceChildren(box);
  });

  /* =================== MODO TV (ranking para apresentar) =================== */
  const TV = { slides: ['sdr', 'tag'], i: 0, pausa: false, ini: 0, dur: 15000, anim: true };
  const TV_NOMES = { sdr: 'Ranking de SDRs', closer: 'Ranking de Closers', tag: 'Ranking de calls por tag' };
  const COLS_TAG = [C.calls, C.realizadas, C.comp, C.vendas];
  function tvSvg(paths, extra) {
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (extra) s.setAttribute('class', extra);
    paths.forEach(([tag, at]) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); s.appendChild(e); });
    return s;
  }
  function tvDados(qual) {
    const F = S.full(); if (!F) return null;
    const dim = qual === 'sdr' ? 'sdr' : qual === 'closer' ? 'closer' : 'tag';
    const cols = qual === 'sdr' ? COLS_SDR : qual === 'closer' ? COLS_CLOSER : COLS_TAG;
    const ordK = qual === 'tag' ? 'calls' : S.st.ord[qual].k;
    const col = cols.find(c => c.k === ordK) || cols[0];
    const grupos = d3.groups(F.calls, r => r._k[dim]).filter(([k]) => k !== S.SEMK)
      .map(([k, rows]) => ({ nome: S.rotulo(dim, k), m: S.M(rows, []) }))
      .map(g => Object.assign(g, { v: col.v(g.m) }))
      .sort((a, b) => ((b.v == null ? -1 : b.v) - (a.v == null ? -1 : a.v)) || b.m.calls.length - a.m.calls.length);
    return { grupos, col, cols };
  }
  function tvPeriodo() {
    const q = S.per(), h = S.hoje();
    const base = q.ini === q.fim ? (q.ini === h ? `Hoje · ${S.fData(q.ini)}` : S.fData(q.ini)) : `${S.fData(q.ini)} a ${S.fData(q.fim)}`;
    return base;
  }
  function abrirTV(qual) {
    const el = document.querySelector('[data-draw="tv"]'); if (!el) return;
    S.fechar();
    TV.i = Math.max(0, TV.slides.indexOf(qual)); TV.pausa = false; TV.ini = Date.now(); TV.anim = true;
    el.hidden = false;
    dash.draw('tv');
    try { const r = el.requestFullscreen && el.requestFullscreen(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* sem tela cheia: segue sobreposto à página */ }
  }
  function fecharTV() {
    const el = document.querySelector('[data-draw="tv"]'); if (el) el.hidden = true;
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { }
  }
  document.querySelectorAll('[data-tv]').forEach(b => b.addEventListener('click', () => abrirTV(b.getAttribute('data-tv'))));
  dash.draw('tv', {
    mount(el) {
      const tela = E('div', 'sr-tvt');
      const top = E('div', 'tv-top'), esq = E('div', 'esq'), tit = E('div', 'tv-tit'), kick = E('span', 'k', 'Ranking comercial'), h2 = E('h2');
      const logo = document.querySelector('.sr-logo img'); if (logo) esq.appendChild(logo.cloneNode(true));
      tit.append(kick, h2); esq.appendChild(tit);
      const dir = E('div', 'tv-dir'), per = E('div', 'tv-per'), p = E('span', 'p'), f = E('span', 'f'), hora = E('div', 'tv-hora');
      per.append(p, f); dir.append(per, hora); top.append(esq, dir);
      const palco = E('div', 'tv-palco');
      const bot = E('div', 'tv-bot'), dots = E('div', 'tv-dots'), prog = E('div', 'tv-prog'), pi = E('i'); prog.appendChild(pi);
      const ctl = E('div', 'tv-ctl');
      const bAnt = E('button'); bAnt.type = 'button'; bAnt.setAttribute('aria-label', 'Ranking anterior'); bAnt.appendChild(tvSvg([['path', { d: 'm15 18-6-6 6-6' }]]));
      const bPau = E('button'); bPau.type = 'button'; bPau.setAttribute('aria-label', 'Pausar a rotação');
      const bPro = E('button'); bPro.type = 'button'; bPro.setAttribute('aria-label', 'Próximo ranking'); bPro.appendChild(tvSvg([['path', { d: 'm9 18 6-6-6-6' }]]));
      const bX = E('button'); bX.type = 'button'; bX.setAttribute('aria-label', 'Sair do modo TV'); bX.appendChild(tvSvg([['path', { d: 'M18 6 6 18M6 6l12 12' }]]));
      ctl.append(bAnt, bPau, bPro, bX);
      bot.append(dots, prog, ctl);
      tela.append(top, palco, bot); el.appendChild(tela);
      const m = { h2, p, f, hora, palco, dots, pi, bPau };
      const ir = d => { TV.i = (TV.i + d + TV.slides.length) % TV.slides.length; TV.ini = Date.now(); TV.anim = true; dash.draw('tv'); };
      bAnt.addEventListener('click', () => ir(-1)); bPro.addEventListener('click', () => ir(1));
      bPau.addEventListener('click', () => { TV.pausa = !TV.pausa; if (!TV.pausa) TV.ini = Date.now(); m.icPausa(); });
      bX.addEventListener('click', () => fecharTV());
      m.icPausa = () => { bPau.replaceChildren(tvSvg(TV.pausa ? [['polygon', { points: '7 4 20 12 7 20 7 4' }]] : [['rect', { x: 6, y: 5, width: 4, height: 14, rx: 1 }], ['rect', { x: 14, y: 5, width: 4, height: 14, rx: 1 }]])); bPau.setAttribute('aria-label', TV.pausa ? 'Retomar a rotação' : 'Pausar a rotação'); };
      m.onKey = ev => { if (el.hidden) return; if (ev.key === 'ArrowRight') ir(1); else if (ev.key === 'ArrowLeft') ir(-1); else if (ev.key === 'Escape') fecharTV(); else if (ev.key === ' ') { ev.preventDefault(); bPau.click(); } };
      document.addEventListener('keydown', m.onKey);
      m.tick = setInterval(() => {
        if (el.hidden) return;
        const d = new Date(); m.hora.textContent = `${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`;
        if (TV.pausa) return;
        const pr = Math.min(1, (Date.now() - TV.ini) / TV.dur); m.pi.style.width = (pr * 100) + '%';
        if (pr >= 1) ir(1);
      }, 250);
      return m;
    },
    update(el, m) {
      const qual = TV.slides[TV.i], d = new Date();
      m.hora.textContent = `${S.pad(d.getHours())}:${S.pad(d.getMinutes())}`;
      m.h2.textContent = TV_NOMES[qual];
      m.p.textContent = tvPeriodo();
      const fl = S.descFiltros(); m.f.textContent = fl.length ? fl.join(' · ') : (S.st.ultima ? `Atualizado às ${S.pad(new Date(S.st.ultima).getHours())}:${S.pad(new Date(S.st.ultima).getMinutes())}` : '');
      m.icPausa();
      m.dots.replaceChildren(...TV.slides.map((s, k) => { const b = E('button', 'tv-dot' + (k === TV.i ? ' on' : ''), s === 'sdr' ? 'SDRs' : s === 'closer' ? 'Closers' : 'Tags'); b.type = 'button'; b.addEventListener('click', () => { TV.i = k; TV.ini = Date.now(); TV.anim = true; dash.draw('tv'); }); return b; }));
      const R = tvDados(qual);
      if (!R) { m.palco.replaceChildren(E('div', 'tv-vazio', 'Carregando dados…')); return; }
      if (!R.grupos.length) { m.palco.replaceChildren(E('div', 'tv-vazio', 'Nenhuma call no período.')); return; }
      const anim = TV.anim; TV.anim = false;
      const top3 = R.grupos.slice(0, 3), resto = R.grupos.slice(3, 10);
      const podio = E('div', 'tv-podio' + (anim ? ' tv-anim' : ''));
      const ordem = [1, 0, 2];
      ordem.forEach(k => {
        const g = top3[k];
        const c = E('div', 'tv-pod p' + (k + 1));
        if (!g) { c.style.visibility = 'hidden'; podio.appendChild(c); return; }
        if (k === 0) c.appendChild(tvSvg([['path', { d: 'M2 18h20l-2-11-5 4-3-7-3 7-5-4-2 11z', fill: 'currentColor' }]], 'tv-coroa'));
        const med = E('div', 'tv-med', String(k + 1));
        med.style.background = ['linear-gradient(145deg,#F7DD72,#C9A227)', 'linear-gradient(145deg,#E3E6EA,#A0A4AB)', 'linear-gradient(145deg,#E2A26A,#B87333)'][k];
        const outros = R.cols.filter(cc => cc.k !== R.col.k).slice(0, 3).map(cc => { const s = E('span'); s.append(document.createTextNode(cc.t.replace(' %', '') + ' '), E('b', '', cc.f(cc.v(g.m)))); return s; });
        const mini = E('div', 'tv-mini'); mini.append(...outros);
        c.append(med, E('div', 'tv-nome', g.nome), E('div', 'tv-val', R.col.f(g.v)), E('div', 'tv-met', R.col.t.replace(' %', '')), mini);
        podio.appendChild(c);
      });
      const lista = E('div', 'tv-lista' + (anim ? ' tv-anim' : ''));
      const max = Math.max(1e-9, d3.max(R.grupos, g => g.v || 0));
      resto.forEach((g, k) => {
        const li = E('div', 'tv-li'); const md = E('div', 'md'); const br = E('div', 'br'); const i = E('i'); i.style.width = (100 * (g.v || 0) / max) + '%'; br.appendChild(i);
        md.append(E('span', 'nm', g.nome), br);
        li.append(E('span', 'ps', String(k + 4)), md, E('span', 'vl', R.col.f(g.v)));
        lista.appendChild(li);
      });
      if (R.grupos.length > 10) lista.appendChild(E('div', 'tv-mais', `+ ${S.fInt(R.grupos.length - 10)} no ranking`));
      if (!resto.length) lista.appendChild(E('div', 'tv-mais', ''));
      m.palco.replaceChildren(podio, lista);
    },
    unmount(el, m) { clearInterval(m.tick); document.removeEventListener('keydown', m.onKey); }
  });

  /* =================== [D] ORIGEM DAS CALLS =================== */
  const RK_DIMS = { tag: 'tag', camp: 'camp', cri: 'cri', med: 'med', fonte: 'fonte' };
  const RK_NOMES = { tag: 'Tag de campanha', camp: 'Campanha', cri: 'Criativo', med: 'utm_source / medium', fonte: 'Fonte' };
  function ranking(dim, F) {
    const gs = S.agrupa(F.calls, F.leads, dim).map(g => Object.assign(g, { m: S.M(g.calls, g.leads) }));
    if (dim === 'cri') gs.forEach(g => { const c = d3.rollups(g.calls.length ? g.calls : g.leads, v => v.length, r => S.limpa(r.utm_campaign)).sort((a, b) => b[1] - a[1]); g.mae = c.length ? c[0][0] : ''; });
    return gs;
  }
  dash.draw('rk-dest', el => {
    const F = S.full(); if (!F || !F.calls.length) { el.replaceChildren(); return; }
    const dim = RK_DIMS[dash.params().rk] || 'tag';
    const c = d3.rollups(F.calls.filter(r => r._k[dim] !== S.SEMK), v => S.umPorLead(v).length, r => r._k[dim]).sort((a, b) => b[1] - a[1])[0];
    if (!c) { el.replaceChildren(); return; }
    const b = botao('', S.rotulo(dim, c[0]));
    b.title = S.FDIMS.includes(dim) ? 'Filtrar a página por este valor' : 'Ver as calls';
    b.addEventListener('click', () => (S.FDIMS.includes(dim) ? S.addFiltro(dim, c[0]) : S.abrir({ titulo: 'Calls', recorte: [RK_NOMES[dim] + ': ' + S.rotulo(dim, c[0])], rows: F.calls.filter(r => r._k[dim] === c[0]) })));
    el.replaceChildren(document.createTextNode('Maior gerador de calls: '), b, document.createTextNode(' — '), E('b', '', `${S.fInt(c[1])} ${c[1] === 1 ? 'call' : 'calls'}`), document.createTextNode(` (${S.fP(c[1] / S.umPorLead(F.calls).length)})`));
  });
  dash.draw('rk', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const dim = RK_DIMS[dash.params().rk] || 'tag';
    const grupos = ranking(dim, F);
    if (!grupos.length) { S.vazio(el, 'Nenhuma origem no período.'); return; }
    tabelaRanking(el, {
      dim, grupos, cols: COLS_ORIGEM, ord: S.st.ord.rk, semSempre: true, nomeCol: RK_NOMES[dim],
      aoOrdenar: (k, dir) => { S.st.ord.rk = { k, dir }; dash.draw('rk'); },
      nomeAcao: g => S.FDIMS.includes(dim) && g.key !== S.SEMK
        ? { fn: () => S.addFiltro(dim, g.key), tip: 'Filtrar a página por este valor' }
        : { fn: () => S.abrir({ titulo: 'Calls', recorte: [RK_NOMES[dim] + ': ' + g.nome], rows: g.m.calls }) }
    });
  });

  /* =================== [E] ANÁLISES =================== */
  /* funil */
  function opcoesOrigem(sel, valor, primeira) {
    const F = S.full();
    const opts = [new Option(primeira, '')];
    let existe = !valor;
    if (F) {
      [['tag', 'Tags de campanha'], ['camp', 'Campanhas']].forEach(([dim, rot]) => {
        const og = document.createElement('optgroup'); og.label = rot;
        d3.rollups(F.calls, v => v.length, r => r._k[dim]).sort((a, b) => b[1] - a[1]).slice(0, 40)
          .forEach(([k, n]) => { if (dim + ':' + k === valor) existe = true; og.appendChild(new Option(`${S.rotulo(dim, k)} (${S.fInt(n)})`, dim + ':' + k)); });
        if (og.children.length) opts.push(og);
      });
    }
    if (!existe) { const [dim, k] = valor.split(/:(.*)/s); if (S.DIMS[dim]) opts.push(new Option(S.rotulo(dim, k), valor)); }
    sel.replaceChildren(...opts); sel.value = valor || '';
  }
  dash.draw('fn-a', sel => { opcoesOrigem(sel, dash.params().fa || '', 'Todas as origens'); sel.onchange = () => dash.setParams({ fa: sel.value || null }); });
  dash.draw('fn-b', sel => { opcoesOrigem(sel, dash.params().fb || '', 'Não comparar'); sel.onchange = () => dash.setParams({ fb: sel.value || null }); });
  function funilDe(F, valor) {
    if (!valor) return { nome: 'Todas as origens', calls: F.calls, leads: F.leads };
    const [dim, k] = valor.split(/:(.*)/s);
    if (!S.DIMS[dim]) return { nome: 'Todas as origens', calls: F.calls, leads: F.leads };
    return { nome: `${S.DIMS[dim].nome}: ${S.rotulo(dim, k)}`, calls: F.calls.filter(r => r._k[dim] === k), leads: F.leads.filter(x => x._k[dim] === k) };
  }
  dash.draw('funil', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const p = dash.params(), fs = [funilDe(F, p.fa)];
    if (p.fb) fs.push(funilDe(F, p.fb));
    el.replaceChildren(...fs.map(f => {
      const m = S.M(f.calls, f.leads);
      const et = [['Leads', m.leads, 'l'], ['Calls agendadas', m.calls, 'c'], ['Realizadas', m.realizadas, 'c'], ['Oportunidades', m.opps, 'c'], ['Ganhos', m.vendas, 'c']];
      const max = Math.max(1, d3.max(et, e => e[1].length));
      const box = E('div', 'sr-funil'); box.appendChild(E('h3', 'sr-funil-t', f.nome));
      et.forEach(([nome, rows, kind], j) => {
        const b = E('button', 'sr-etapa'); b.type = 'button';
        const tr = E('span', 'tr'); const fl = E('i'); fl.style.width = (100 * rows.length / max) + '%'; tr.appendChild(fl);
        b.append(E('span', 'l', nome), tr, E('span', 'v', S.fInt(rows.length)), E('span', 'conv', j ? `${S.fP(S.pct(rows.length, et[j - 1][1].length))} da anterior` : ''));
        b.addEventListener('click', () => S.abrir({ titulo: nome, recorte: [f.nome], rows, kind }));
        box.appendChild(b);
      });
      return box;
    }));
    el.classList.toggle('duplo', fs.length > 1);
  });
  /* criativo × SDR */
  dash.draw('matriz', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const rowsK = d3.rollups(F.calls.filter(r => r._k.cri !== S.SEMK), v => v.length, r => r._k.cri).sort((a, b) => b[1] - a[1]).slice(0, 15).map(d => d[0]);
    if (!rowsK.length) { S.vazio(el, 'Nenhuma call com criativo (utm_content) no período.'); return; }
    const base = F.calls.filter(r => rowsK.includes(r._k.cri));
    const colsK = d3.rollups(base, v => v.length, r => r._k.sdr).sort((a, b) => (a[0] === S.SEMK) - (b[0] === S.SEMK) || b[1] - a[1]).map(d => d[0]);
    const cel = d3.group(base, r => r._k.cri, r => r._k.sdr);
    const max = Math.max(1, d3.max(rowsK, rk => d3.max(colsK, ck => ((cel.get(rk) || new Map()).get(ck) || []).length)));
    const wrap = E('div', 'sr-tw sr-hmwrap');
    const tbl = E('table', 'sr-hm'); tbl.setAttribute('data-source', 'base_unificada');
    const trh = E('tr'); trh.appendChild(E('th', '', 'Criativo'));
    colsK.forEach(ck => { const h = E('th', 'col'); h.appendChild(E('span', '', S.rotulo('sdr', ck))); trh.appendChild(h); });
    const th = E('thead'); th.appendChild(trh);
    const tb = E('tbody'), tp = S.tip(wrap);
    rowsK.forEach(rk => {
      const tr = E('tr'); tr.appendChild(E('td', 'nome', S.rotulo('cri', rk)));
      colsK.forEach(ck => {
        const rows = (cel.get(rk) || new Map()).get(ck) || [], td = E('td', 'c');
        if (rows.length) {
          const t = rows.length / max, b = E('button', 'sr-hmc', S.fInt(rows.length)); b.type = 'button';
          b.style.background = HEAT(t); b.style.color = corNum(t);
          const m = S.M(rows, []);
          b.addEventListener('pointermove', ev => tp.show(ev, `${S.rotulo('cri', rk)} · ${S.rotulo('sdr', ck)}`, [['Calls', S.fInt(rows.length)], ['Realizadas', S.fInt(m.realizadas.length)], ['Vendas', S.fInt(m.vendas.length)]]));
          b.addEventListener('pointerleave', () => tp.hide());
          b.addEventListener('click', () => S.abrir({ titulo: 'Calls', recorte: ['Criativo: ' + S.rotulo('cri', rk), 'SDR: ' + S.rotulo('sdr', ck)], rows }));
          td.appendChild(b);
        } else td.appendChild(E('span', 'zero', '·'));
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tbl.append(th, tb); wrap.appendChild(tbl); el.replaceChildren(wrap);
  });
  /* dia e hora */
  const DS = [['seg', 1], ['ter', 2], ['qua', 3], ['qui', 4], ['sex', 5], ['sáb', 6], ['dom', 0]];
  dash.draw('horas', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const modo = dash.params().hm === 'comp' ? 'comp' : 'calls';
    const cs = F.calls.filter(r => /\d\d:\d\d/.test((r._d || '').slice(11, 16)));
    if (!cs.length) { S.vazio(el, 'Nenhuma call com horário no período.'); return; }
    const hr = r => Number(r._d.slice(11, 13)), wd = r => S.toDate(r._d).getDay();
    const hs = cs.map(hr), horas = d3.range(Math.min(8, d3.min(hs)), Math.max(20, d3.max(hs)) + 1);
    const g = d3.group(cs, wd, hr);
    const conc = rows => rows.filter(r => r._g === 'realizada' || r._g === 'no_show').length;
    const val = rows => modo === 'calls' ? rows.length : S.pct(rows.filter(r => r._g === 'realizada').length, conc(rows));
    const cells = [];
    DS.forEach(([n, d]) => horas.forEach(h => { const rows = ((g.get(d) || new Map()).get(h)) || []; cells.push({ n, d, h, rows, v: val(rows), base: conc(rows) }); }));
    const validas = cells.filter(c => modo === 'calls' ? c.v > 0 : c.v != null && c.base >= 3);
    const max = modo === 'calls' ? Math.max(1, d3.max(validas, c => c.v) || 1) : 1;
    const top = validas.slice().sort((a, b) => b.v - a.v || b.rows.length - a.rows.length).slice(0, 3);
    const wrap = E('div', 'sr-hhwrap'), tp = S.tip(wrap);
    const grid = E('div', 'sr-hh'); grid.style.gridTemplateColumns = `36px repeat(${horas.length}, minmax(26px, 1fr))`;
    grid.appendChild(E('span', ''));
    horas.forEach(h => grid.appendChild(E('span', 'hh-h', h + 'h')));
    DS.forEach(([n, d]) => {
      grid.appendChild(E('span', 'hh-d', n));
      horas.forEach(h => {
        const c = cells.find(x => x.d === d && x.h === h), ok = modo === 'calls' ? c.v > 0 : c.v != null;
        const b = E('button', 'hh-cell' + (top.includes(c) ? ' top' : '')); b.type = 'button';
        if (ok) {
          const t = modo === 'calls' ? c.v / max : c.v;
          b.style.background = HEAT(t); b.style.color = corNum(t);
          b.textContent = modo === 'calls' ? S.fInt(c.v) : String(Math.round(c.v * 100));
          b.addEventListener('click', () => S.abrir({ titulo: 'Calls', recorte: [`${n} ${h}h`], rows: c.rows }));
        } else b.disabled = true;
        b.addEventListener('pointermove', ev => tp.show(ev, `${n} · ${h}h`, [['Calls', S.fInt(c.rows.length)], ['Realizadas', S.fInt(c.rows.filter(r => r._g === 'realizada').length)], ['No-show', S.fInt(c.rows.filter(r => r._g === 'no_show').length)], ['Comparecimento', S.fP(S.pct(c.rows.filter(r => r._g === 'realizada').length, c.base))]]));
        b.addEventListener('pointerleave', () => tp.hide());
        grid.appendChild(b);
      });
    });
    wrap.appendChild(grid);
    const nota = E('p', 'sr-note', top.length ? 'Melhores horários: ' + top.map(c => `${c.n} ${c.h}h (${modo === 'calls' ? S.fInt(c.v) + (c.v === 1 ? ' call' : ' calls') : S.fP(c.v)})`).join(' · ') + (modo === 'comp' ? '. Só entram horários com 3 ou mais calls concluídas.' : '') : 'Poucos dados para indicar os melhores horários.');
    el.replaceChildren(wrap, nota);
  });
  /* perdas */
  function hbars(el, itens, vazioMsg) {
    if (!itens.length) { S.vazio(el, vazioMsg); return; }
    const tot = d3.sum(itens, d => d.n), max = d3.max(itens, d => d.n);
    el.replaceChildren(...itens.map(d => {
      const b = E('button', 'sr-hb'); b.type = 'button';
      const tr = E('span', 'tr'); const fl = E('i'); fl.style.width = (100 * d.n / max) + '%'; tr.appendChild(fl);
      const nv = E('span', 'nv'); nv.append(E('b', '', S.fInt(d.n)), document.createTextNode(` · ${S.fP(d.n / tot)}`));
      b.append(E('span', 'lb', d.label), tr, nv); b.title = d.label; b.addEventListener('click', d.abrir);
      return b;
    }));
  }
  dash.draw('pd-tag', sel => {
    const F = S.full(), v = dash.params().pt || '';
    const opts = [new Option('Todas as tags', '')];
    if (F) d3.rollups(F.m.perdidas, x => x.length, r => r._k.tag).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => opts.push(new Option(`${S.rotulo('tag', k)} (${S.fInt(n)})`, k)));
    if (v && !opts.some(o => o.value === v)) opts.push(new Option(S.rotulo('tag', v), v));
    sel.replaceChildren(...opts); sel.value = v;
    sel.onchange = () => dash.setParams({ pt: sel.value || null });
  });
  dash.draw('perdas', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const pt = dash.params().pt, rows = F.m.perdidas.filter(r => !pt || r._k.tag === pt);
    hbars(el, d3.groups(rows, r => S.limpa(r.motivo_perda) || '(sem motivo)').map(([label, rs]) => ({ label, n: rs.length, abrir: () => S.abrir({ titulo: 'Perdas', recorte: ['Motivo: ' + label].concat(pt ? ['Tag: ' + S.rotulo('tag', pt)] : []), rows: rs }) })).sort((a, b) => b.n - a.n), 'Nenhuma perda nas calls do período.');
  });
  function leadsComCall(F) { const m = new Map(); F.calls.forEach(r => { const a = m.get(r.lead_id); if (!a || r._d > a._d) m.set(r.lead_id, r); }); return [...m.values()]; }
  dash.draw('retorno', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const m = new Map(); F.leads.concat(leadsComCall(F)).forEach(r => { if (S.limpa(r.tag_retorno) && !m.has(r.lead_id)) m.set(r.lead_id, r); });
    const ls = [...m.values()];
    if (!ls.length) { S.vazio(el, 'Nenhum lead com tag de retorno no período.'); return; }
    const box = E('div', 'sr-hbs');
    hbars(box, d3.groups(ls, r => S.limpa(r.tag_retorno)).map(([label, rs]) => ({ label, n: rs.length, abrir: () => S.abrir({ titulo: 'Leads com tag de retorno', recorte: ['Tag: ' + label], rows: rs, kind: 'l' }) })).sort((a, b) => b.n - a.n), '');
    const ver = E('button', 'sr-link', `Ver os ${S.fInt(ls.length)} leads`); ver.type = 'button';
    ver.addEventListener('click', () => S.abrir({ titulo: 'Leads com tag de retorno', rows: ls, kind: 'l' }));
    el.replaceChildren(box, ver);
  });
  /* pipeline */
  dash.draw('etapas', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const ls = leadsComCall(F);
    if (!ls.length) { S.vazio(el, 'Nenhum lead com call no período.'); return; }
    const agora = S.agora();
    const gs = d3.groups(ls, r => `${S.limpa(r.pipeline_atual) || 'Sem pipeline'} › ${S.limpa(r.etapa_atual) || 'Sem etapa'}`).map(([nome, rs]) => {
      const ds = rs.map(r => S.difDias(r.data_ultima_movimentacao, agora)).filter(v => v != null && v >= 0);
      return { nome, rs, med: ds.length ? d3.mean(ds) : null, max: ds.length ? d3.max(ds) : null };
    }).sort((a, b) => b.rs.length - a.rs.length);
    const tbl = E('table', 'sr-t'); tbl.setAttribute('data-source', 'base_unificada');
    const trh = E('tr'); [['Pipeline › etapa', ''], ['Leads', 'n'], ['Parado (média)', 'n'], ['Mais antigo', 'n']].forEach(([t, c]) => trh.appendChild(E('th', c, t)));
    const th = E('thead'); th.appendChild(trh); const tb = E('tbody');
    gs.forEach(g => {
      const tr = E('tr'); tr.appendChild(E('td', '', g.nome));
      const td = E('td', 'n'); celula(td, S.fInt(g.rs.length), () => S.abrir({ titulo: 'Leads com call', recorte: ['Etapa: ' + g.nome], rows: g.rs, kind: 'l' })); tr.appendChild(td);
      tr.appendChild(E('td', 'n' + (g.med != null && g.med >= 7 ? ' alerta' : ''), S.fDias(g.med)));
      tr.appendChild(E('td', 'n', S.fDias(g.max)));
      tb.appendChild(tr);
    });
    tbl.append(th, tb); const w = E('div', 'sr-tw'); w.appendChild(tbl); el.replaceChildren(w);
  });
  dash.draw('modelos', el => {
    const F = S.full(), D = S.dados();
    if (!F) { S.vazio(el, S.estado(D)); return; }
    const vs = F.m.vendas;
    if (!vs.length) { S.vazio(el, 'Nenhuma venda nas calls do período.'); return; }
    const parte = (campo, rot) => {
      const gs = d3.groups(vs, r => S.limpa(r[campo]) || 'Não informado').map(([k, rs]) => ({ k, rs, v: d3.sum(rs, r => Number(r.valor) || 0) })).sort((a, b) => b.rs.length - a.rs.length);
      const tbl = E('table', 'sr-t'); const trh = E('tr'); [[rot, ''], ['Vendas', 'n'], ['Valor', 'n']].forEach(([t, c]) => trh.appendChild(E('th', c, t)));
      const th = E('thead'); th.appendChild(trh); const tb = E('tbody');
      gs.forEach(g => { const tr = E('tr'); tr.appendChild(E('td', '', g.k)); const td = E('td', 'n'); celula(td, S.fInt(g.rs.length), () => S.abrir({ titulo: 'Vendas', recorte: [rot + ': ' + g.k], rows: g.rs })); tr.appendChild(td); tr.appendChild(E('td', 'n', S.fBRL(g.v))); tb.appendChild(tr); });
      tbl.append(th, tb); tbl.setAttribute('data-source', 'base_unificada'); const w = E('div', 'sr-tw'); w.appendChild(tbl); return w;
    };
    const w = E('div', 'sr-two'); w.append(parte('modelo_franquia', 'Modelo de franquia'), parte('master_franquia', 'Master franquia'));
    el.replaceChildren(w);
  });

  /* =================== DRILL-DOWN ÚNICO =================== */
  /* =================== PERFIL COMPLETO DO LEAD (tudo das abas leads, reuniões e negócios) =================== */
  const ROT_CAMPO = {
    lead_id: 'ID do lead', nome: 'Nome', lead_nome: 'Nome', data_entrada: 'Data de entrada', fonte: 'Fonte', utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', utm_content: 'utm_content',
    tag_campanha: 'Tag de campanha', sdr_responsavel: 'ID do SDR responsável', sdr_responsavel_nome: 'SDR responsável', dono_atual: 'ID do dono atual', dono_atual_nome: 'Dono atual', oportunidade_id: 'ID da oportunidade',
    pipeline_atual: 'Pipeline atual', etapa_atual: 'Etapa atual', status: 'Status', motivo_perda: 'Motivo de perda', tag_retorno: 'Tag de retorno', data_ultima_movimentacao: 'Última movimentação', tags: 'Tags',
    atualizado_em: 'Atualizado em', removido_ghl: 'Removido do CRM', removido_em: 'Removido em', motivo_perda_custom: 'Motivo personalizado', motivo_perda_nativo: 'Motivo nativo do CRM',
    reuniao_id: 'ID da reunião', sdr_agendou: 'ID do SDR que agendou', sdr_agendou_nome: 'SDR que agendou', closer: 'ID do closer', closer_nome: 'Closer', data_agendamento: 'Data do agendamento', data_reuniao: 'Data da reunião',
    data_reuniao_original: 'Data original da reunião', remarcacoes: 'Remarcações', status_reuniao: 'Status da reunião', status_ghl: 'Status no CRM', data_ultimo_status: 'Último status em', origem_call: 'Origem da call',
    conta_agendada: 'Conta como agendada', link_gravacao: 'Link da gravação', nota_closer_qualificacao_sdr: 'Nota do closer (qualificação do SDR)', etapa_pipeline: 'Etapa do pipeline',
    pipeline: 'Pipeline', etapa: 'Etapa', resultado: 'Resultado', sdr_origem: 'ID do SDR de origem', sdr_origem_nome: 'SDR de origem', data_criacao: 'Criação da oportunidade', data_transferencia: 'Transferência para o closer',
    valor: 'Valor', data_fechamento: 'Data de fechamento', modelo_franquia: 'Modelo de franquia', master_franquia: 'Master franquia'
  };
  const rotCampo = k => ROT_CAMPO[k] || k;
  const ehData = v => /^\d{4}-\d\d-\d\d([ T]\d\d:\d\d)?/.test(v);
  const fmtCampo = (k, v) => {
    v = S.limpa(v); if (!v) return '';
    if (ehData(v)) return v.length > 10 ? S.fDataHora(v) : S.fData(v);
    if (k === 'valor') { const x = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')); return x > 0 ? S.fBRL(x) : v; }
    return v;
  };
  const ultimoPor = (rows, k) => { const m = new Map(); (rows || []).forEach(r => { const id = r[k]; if (!id) return; const a = m.get(id); if (!a || (r.atualizado_em || '') > (a.atualizado_em || '')) m.set(id, r); }); return [...m.values()]; };
  const bruto = nome => { const d = dash.data(nome); return d && d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  function perfilDe(id) {
    const lead = ultimoPor(bruto('leads').filter(l => l.lead_id === id), 'lead_id')[0] || null;
    const reun = ultimoPor(bruto('reunioes').filter(r => r.lead_id === id), 'reuniao_id').sort((a, b) => (b.data_reuniao || b.data_agendamento || '').localeCompare(a.data_reuniao || a.data_agendamento || ''));
    const negs = ultimoPor(bruto('negocios').filter(o => o.lead_id === id), 'oportunidade_id').sort((a, b) => (b.data_criacao || '').localeCompare(a.data_criacao || ''));
    const base = (S.dados().rows || []).filter(r => r.lead_id === id);
    return { id, lead, reun, negs, base };
  }
  function abrirPerfil(id) {
    if (!id) return;
    S.st.perfil = id; S.st.perfilVolta = document.activeElement;
    document.querySelectorAll('[data-draw="perfil"]').forEach(e => { e.hidden = false; });
    document.querySelectorAll('.sr').forEach(e => e.classList.add('perfil-on'));
    dash.draw('perfil');
    const b = document.querySelector('.sr-pbox'); if (b) { b.scrollTop = 0; const x = b.querySelector('.sr-pfechar'); if (x) x.focus({ preventScroll: true }); }
    const p = document.querySelector('[data-draw="perfil"]'); if (p && p.scrollIntoView) { const r = p.getBoundingClientRect(); if (r.top < 0 || r.top > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top }); }
  }
  function fecharPerfil() {
    S.st.perfil = null;
    document.querySelectorAll('[data-draw="perfil"]').forEach(e => { e.hidden = true; });
    document.querySelectorAll('.sr').forEach(e => e.classList.remove('perfil-on'));
    const v = S.st.perfilVolta; S.st.perfilVolta = null; if (v && v.focus && document.contains(v)) v.focus({ preventScroll: true });
  }
  S.perfil = abrirPerfil;
  function tabelaCampos(obj, chaves, links) {
    const dl = E('dl', 'sr-pcampos');
    chaves.forEach(k => {
      const raw = obj ? obj[k] : '', v = fmtCampo(k, raw);
      const dt = E('dt', '', rotCampo(k)), dd = E('dd', v ? '' : 'vazio');
      if (v && /^https?:\/\//i.test(S.limpa(raw))) { const a = E('a', '', S.limpa(raw)); a.href = S.limpa(raw); a.target = '_blank'; a.rel = 'noopener noreferrer'; dd.appendChild(a); }
      else dd.textContent = v || '—';
      if (/_id$|^(sdr_responsavel|dono_atual|sdr_agendou|closer|sdr_origem)$/.test(k)) dd.classList.add('id');
      dl.append(dt, dd);
    });
    return dl;
  }
  const todasChaves = (rows, prefer) => { const s = new Set(prefer || []); rows.forEach(r => Object.keys(r).forEach(k => { if (!k.startsWith('_')) s.add(k); })); return [...s]; };
  const pill = (t, cls) => E('span', 'sr-ppill' + (cls ? ' ' + cls : ''), t);
  dash.draw('perfil', {
    mount(el) {
      const box = E('div', 'sr-pbox'); box.setAttribute('role', 'document');
      el.appendChild(box);
      el.addEventListener('click', ev => { if (ev.target === el) fecharPerfil(); });
      return { box };
    },
    update(el, m) {
      const id = S.st.perfil; if (!id) { m.box.replaceChildren(); return; }
      const P = perfilDe(id), L = P.lead || {}, neg = P.negs[0] || {}, venda = P.negs.find(o => S.norm(o.resultado) === 'ganho');
      const nome = S.limpa(L.nome) || S.limpa(neg.nome) || S.limpa((P.reun[0] || {}).lead_nome) || 'Lead sem nome';
      const head = E('div', 'sr-phead');
      const av = E('span', 'sr-pav', nome.trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase()); av.setAttribute('aria-hidden', 'true');
      const tt = E('div', 'sr-ptt'); tt.append(E('h2', 'sr-pnome', nome));
      const pills = E('div', 'sr-ppills');
      if (venda) pills.appendChild(pill('Venda' + (fmtCampo('valor', venda.valor) ? ' · ' + fmtCampo('valor', venda.valor) : ''), 'ok'));
      if (S.limpa(L.etapa_atual || neg.etapa)) pills.appendChild(pill(S.limpa(L.etapa_atual || neg.etapa)));
      if (S.limpa(L.status)) pills.appendChild(pill('Status: ' + S.limpa(L.status)));
      if (S.limpa(L.removido_ghl) && S.norm(L.removido_ghl) !== 'nao' && S.norm(L.removido_ghl) !== 'false') pills.appendChild(pill('Removido do CRM', 'alerta'));
      tt.appendChild(pills);
      const x = botao('sr-btn ico sr-pfechar', null, 'x'); x.setAttribute('aria-label', 'Fechar perfil'); x.addEventListener('click', fecharPerfil);
      head.append(av, tt, x);
      const corpo = E('div', 'sr-pbody');
      if (!P.lead && !P.negs.length && !P.reun.length) { corpo.appendChild(E('div', 'sr-empty', 'Este lead não foi encontrado nas abas da planilha.')); m.box.replaceChildren(head, corpo); return; }
      /* resumo */
      const res = E('div', 'sr-presumo');
      const item = (rot, val) => { const d = E('div', 'it'); d.append(E('span', 'l', rot), E('span', 'v', val || '—')); res.appendChild(d); };
      item('Entrada', fmtCampo('data_entrada', L.data_entrada));
      item('Fonte', S.limpa(L.fonte));
      item('SDR responsável', S.limpa(L.sdr_responsavel_nome));
      item('Closer', S.limpa(neg.closer_nome) || S.limpa((P.reun[0] || {}).closer_nome));
      item('Dono atual', S.limpa(L.dono_atual_nome || neg.dono_atual_nome));
      item('Pipeline', S.limpa(L.pipeline_atual || neg.pipeline));
      if (venda) { item('Fechamento', fmtCampo('data_fechamento', venda.data_fechamento)); item('Modelo', S.limpa(venda.modelo_franquia)); }
      corpo.appendChild(res);
      const secao = (titulo, conteudo, sub) => { const s = E('section', 'sr-psec'); const h = E('h3', 'sr-psect', titulo); if (sub) h.appendChild(E('span', 'sub', sub)); s.append(h, conteudo); corpo.appendChild(s); return s; };
      /* origem e UTM */
      const utm = tabelaCampos(L.lead_id ? L : neg, ['fonte', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'tag_campanha']);
      const tags = S.limpa(L.tags); const wrapU = E('div'); wrapU.appendChild(utm);
      if (tags) { const tg = E('div', 'sr-ptags'); tags.split('|').map(t => S.limpa(t)).filter(Boolean).forEach((t, i) => tg.appendChild(pill(t, i === 0 ? 'prim' : ''))); wrapU.appendChild(tg); }
      secao('Origem e UTM', wrapU);
      /* linha do tempo */
      const ev = [];
      if (L.data_entrada) ev.push([L.data_entrada, 'Lead entrou', S.limpa(L.fonte)]);
      P.negs.forEach(o => { if (o.data_criacao) ev.push([o.data_criacao, 'Oportunidade criada', S.limpa(o.pipeline)]); if (o.data_transferencia) ev.push([o.data_transferencia, 'Transferida para o closer', S.limpa(o.closer_nome)]); if (o.data_fechamento) ev.push([o.data_fechamento, 'Fechamento: ' + (S.limpa(o.resultado) || '—'), fmtCampo('valor', o.valor)]); });
      P.reun.forEach(r => { if (r.data_agendamento) ev.push([r.data_agendamento, 'Call agendada', S.limpa(r.sdr_agendou_nome) ? 'por ' + S.limpa(r.sdr_agendou_nome) : '']); if (r.data_reuniao) ev.push([r.data_reuniao, 'Reunião' + (S.limpa(r.status_reuniao) ? ' · ' + S.limpa(r.status_reuniao) : ''), S.limpa(r.closer_nome) ? 'com ' + S.limpa(r.closer_nome) : '']); });
      if (ev.length) {
        ev.sort((a, b) => a[0].localeCompare(b[0]));
        const ol = E('ol', 'sr-ptl');
        ev.forEach(([d, t, s2]) => { const li = E('li'); li.append(E('span', 'd', fmtCampo('d', d)), E('span', 't', t)); if (s2) li.appendChild(E('span', 's', s2)); ol.appendChild(li); });
        secao('Linha do tempo', ol);
      }
      /* oportunidades */
      if (P.negs.length) {
        const w = E('div', 'sr-pcards');
        P.negs.forEach(o => { const c = E('div', 'sr-pcard'); c.appendChild(E('div', 'ct', (S.limpa(o.pipeline) || 'Oportunidade') + ' · ' + (S.limpa(o.etapa) || '—'))); c.appendChild(tabelaCampos(o, todasChaves([o], ['resultado', 'valor', 'data_criacao', 'data_transferencia', 'data_fechamento', 'sdr_origem_nome', 'closer_nome', 'dono_atual_nome', 'modelo_franquia', 'master_franquia', 'motivo_perda_custom', 'motivo_perda_nativo']).filter(k => k !== 'nome' && k !== 'lead_id'))); w.appendChild(c); });
        secao('Oportunidades', w, 'aba negócios · ' + P.negs.length);
      }
      /* reuniões */
      if (P.reun.length) {
        const w = E('div', 'sr-pcards');
        P.reun.forEach(r => { const vale = S.norm(r.conta_agendada) === 'sim'; const c = E('div', 'sr-pcard' + (vale ? '' : ' fraca')); const ct = E('div', 'ct', fmtCampo('d', r.data_reuniao) || 'Sem data da reunião'); ct.appendChild(pill(vale ? 'Conta no relatório' : 'Não conta', vale ? 'ok' : '')); c.appendChild(ct); c.appendChild(tabelaCampos(r, todasChaves([r], ['status_reuniao', 'closer_nome', 'sdr_agendou_nome', 'data_agendamento', 'data_reuniao', 'data_reuniao_original', 'remarcacoes', 'origem_call', 'link_gravacao', 'nota_closer_qualificacao_sdr']).filter(k => k !== 'lead_nome' && k !== 'lead_id'))); w.appendChild(c); });
        secao('Reuniões', w, 'aba reuniões · ' + P.reun.length);
      }
      /* tudo da aba leads */
      if (P.lead) secao('Todos os campos do lead', tabelaCampos(L, todasChaves([L])), 'aba leads');
      m.box.replaceChildren(head, corpo);
    }
  });

  dash.draw('drawer', {
    mount(el) {
      const head = E('div', 'sr-sideh');
      const tit = E('h2', 'sr-sidet');
      const acoes = E('div', 'sr-row');
      const bCsv = botao('sr-btn', 'Exportar CSV', 'dl'), bXls = botao('sr-btn', 'Exportar Excel', 'dl'), fechar = botao('sr-btn ico', null, 'x');
      fechar.setAttribute('aria-label', 'Fechar lista');
      fechar.classList.add('sr-fechar');
      acoes.append(bCsv, bXls, fechar); head.append(tit, acoes);
      const body = E('div', 'sr-sideb');
      const bar = E('div', 'sr-dbar');
      const busca = E('input', 'sr-busca'); busca.type = 'search'; busca.placeholder = 'Buscar por nome'; busca.setAttribute('aria-label', 'Buscar por nome');
      const bCols = botao('sr-btn', 'Colunas', 'cols');
      const meta = E('span', 'sr-hint');
      bar.append(busca, bCols, meta);
      const colsBox = E('div', 'sr-dcols'); colsBox.hidden = true;
      const tw = E('div', 'sr-tw');
      const pager = E('div', 'sr-pager');
      body.append(bar, colsBox, tw, pager);
      const caixa = E('div', 'sr-modal-box');
      caixa.append(head, body);
      el.append(caixa);
      fechar.addEventListener('click', () => S.fechar());
      el.addEventListener('click', ev => { if (ev.target === el) S.fechar(); });
      busca.addEventListener('input', () => { if (S.st.dr) { S.st.dr.q = busca.value; S.st.dr.page = 0; dash.draw('drawer'); } });
      bCols.addEventListener('click', () => { if (S.st.dr) { S.st.dr.escolher = !S.st.dr.escolher; dash.draw('drawer'); } });
      bCsv.addEventListener('click', () => S.baixarDrill('csv'));
      bXls.addEventListener('click', () => S.baixarDrill('xlsx'));
      return { tit, meta, busca, colsBox, tw, pager, bCsv, bXls, ultimo: null };
    },
    update(el, m) {
      const d = S.st.dr;
      if (!d) { m.tw.replaceChildren(); return; }
      if (m.ultimo !== d) { m.ultimo = d; m.busca.value = d.q || ''; }
      const rows = S.linhasFiltradas();
      m.tit.textContent = `${d.titulo} · ${d.periodo} · ${S.fInt(d.rows.length)} ${d.rows.length === 1 ? 'lead' : 'leads'}`;
      m.meta.textContent = d.q ? `${S.fInt(rows.length)} encontrados` : '';
      m.bCsv.disabled = m.bXls.disabled = !rows.length;
      m.colsBox.hidden = !d.escolher;
      if (d.escolher) {
        m.colsBox.replaceChildren(...S.COLS.map(c => {
          const lb = E('label', 'sr-opt'); const cb = E('input'); cb.type = 'checkbox'; cb.checked = d.cols.has(c.k);
          cb.addEventListener('change', () => { if (cb.checked) d.cols.add(c.k); else if (d.cols.size > 1) d.cols.delete(c.k); dash.draw('drawer'); });
          lb.append(cb, E('span', 't', c.t)); return lb;
        }));
      }
      const cols = S.COLS.filter(c => d.cols.has(c.k));
      if (!rows.length) { m.tw.replaceChildren(E('div', 'sr-empty', d.rows.length ? 'Ninguém com esse nome na lista.' : 'Nenhum lead neste recorte.')); m.pager.replaceChildren(); return; }
      const pags = Math.ceil(rows.length / 50); d.page = Math.min(d.page, pags - 1);
      const vis = rows.slice(d.page * 50, d.page * 50 + 50);
      const tbl = E('table', 'sr-t sr-dtable'); tbl.setAttribute('data-source', 'base_unificada');
      const trh = E('tr');
      cols.forEach(c => {
        const h = E('th', c.n ? 'n' : ''); const b = E('button', 'sr-sort' + (d.sort.k === c.k ? ' on' : ''), c.t + (d.sort.k === c.k ? (d.sort.dir < 0 ? ' ↓' : ' ↑') : '')); b.type = 'button';
        b.addEventListener('click', () => { d.sort = { k: c.k, dir: d.sort.k === c.k ? -d.sort.dir : 1 }; dash.draw('drawer'); });
        h.appendChild(b); trh.appendChild(h);
      });
      const th = E('thead'); th.appendChild(trh);
      const tb = E('tbody');
      vis.forEach(r => {
        const tr = E('tr');
        cols.forEach(c => {
          if (c.k === 'lead_nome' && r.lead_id) { const td = E('td'); const b = E('button', 'sr-cell nm sr-plink', c.g(r) || 'Sem nome'); b.type = 'button'; b.title = 'Ver o perfil completo do lead'; b.addEventListener('click', () => abrirPerfil(r.lead_id)); td.appendChild(b); tr.appendChild(td); }
          else if (c.k === 'link_gravacao' && /^https?:\/\//i.test(S.limpa(r.link_gravacao))) { const td = E('td'); const a = E('a', 'sr-plink', c.g(r)); a.href = S.limpa(r.link_gravacao); a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = 'Abrir a gravação'; td.appendChild(a); tr.appendChild(td); }
          else tr.appendChild(E('td', c.n ? 'n' : '', c.g(r) || '—'));
        });
        tb.appendChild(tr);
      });
      tbl.append(th, tb); m.tw.replaceChildren(tbl);
      const ant = botao('sr-btn', 'Anterior', 'esq'); ant.disabled = d.page === 0;
      const prox = botao('sr-btn', 'Próxima', 'dir'); prox.disabled = d.page >= pags - 1;
      ant.addEventListener('click', () => { d.page--; dash.draw('drawer'); });
      prox.addEventListener('click', () => { d.page++; dash.draw('drawer'); });
      m.pager.replaceChildren(ant, E('span', '', `Página ${d.page + 1} de ${pags} · ${S.fInt(rows.length)} linhas`), prox);
    }
  });
  dash.draw('aviso', el => { const t = S.lerAviso(); el.textContent = t; el.classList.toggle('on', !!t); });

  /* =================== EXPORTAÇÕES =================== */
  const BASE_COLS = ['lead_id', 'lead_nome', 'data_entrada', 'fonte', 'sdr_responsavel_nome', 'dono_atual_nome', 'pipeline_atual', 'etapa_atual', 'status_lead', 'tag_retorno', 'tags', 'data_ultima_movimentacao',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'tag_campanha', 'reuniao_id', 'tem_reuniao', 'sdr_agendou_nome', 'closer_nome', 'data_agendamento', 'data_reuniao', 'data_reuniao_original', 'remarcacoes',
    'status_reuniao', 'status_reuniao_grupo', 'data_ultimo_status', 'link_gravacao', 'link_gravacao_situacao', 'link_gravacao_motivo', 'nota_closer_qualificacao_sdr', 'oportunidade_id', 'pipeline', 'etapa', 'status_ghl', 'resultado', 'resultado_grupo', 'sdr_origem_nome', 'data_criacao', 'data_transferencia', 'valor',
    'data_fechamento', 'modelo_franquia', 'master_franquia', 'motivo_perda', 'dias_lead_ate_agendamento', 'dias_agendamento_ate_reuniao', 'dias_reuniao_ate_fechamento', 'dia_semana', 'hora'];
  function baseTabela() {
    const D = S.dados(), F = S.full(); if (!D.ok || !F) return null;
    const ids = new Set(F.calls.map(r => r.reuniao_id));
    const linhas = D.rows.filter(r => r.tem_reuniao === 'sim' && ids.has(r.reuniao_id)).concat(F.leads.filter(x => x.tem_reuniao !== 'sim'));
    return [BASE_COLS].concat(linhas.map(r => BASE_COLS.map(k => { const v = r[k]; if (k === 'valor') return Number(v) > 0 ? Number(v) : ''; return typeof v === 'number' ? v : (v == null ? '' : String(v)); })));
  }
  function baseCSV() {
    const t = baseTabela(); if (!t) { S.aviso('Os dados ainda estão carregando.'); return; }
    S.salvar(`calls_base-filtrada_${S.dataArq()}.csv`, window.SRX.csv(t));
  }
  /* todos os leads que agendaram call, por criativo (utm_content) */
  function porCriativo() {
    const D = S.dados(), F = S.full(); if (!D.ok || !F) { S.aviso('Os dados ainda estão carregando.'); return; }
    if (!F.calls.length) { S.aviso('Nenhuma call no período para exportar.'); return; }
    const num = v => (v == null || !isFinite(v) ? '' : Math.round(v * 10000) / 10000);
    const ordem = (a, b) => (a[0] === S.SEMK) - (b[0] === S.SEMK) || b[1].length - a[1].length;
    const grupos = d3.groups(F.calls, r => r._k.cri).sort(ordem);
    const resumo = [['Posição', 'Criativo (utm_content)', 'Calls agendadas', 'Leads únicos', 'Realizadas', 'No-shows', 'Canceladas', 'Ainda agendadas', 'Taxa de comparecimento', 'Vendas', 'Valor vendido']];
    grupos.forEach(([k, rows], i) => {
      const m = S.M(rows, []), c = g => rows.filter(r => r._g === g).length, comp = m.realizadas.length + m.noshow.length;
      resumo.push([k === S.SEMK ? '' : i + 1, S.rotulo('cri', k), rows.length, new Set(rows.map(r => r.lead_id)).size, m.realizadas.length, m.noshow.length,
        c('cancelada'), c('agendada'), comp ? num(m.realizadas.length / comp) : '', m.vendas.length, m.valor > 0 ? m.valor : '']);
    });
    const sdrs = d3.groups(F.calls, r => r._k.sdr).sort(ordem).map(d => d[0]);
    const matriz = [['Criativo (utm_content)'].concat(sdrs.map(k => S.rotulo('sdr', k))).concat(['Total'])];
    grupos.forEach(([k, rows]) => {
      const por = d3.rollup(rows, v => v.length, r => r._k.sdr);
      matriz.push([S.rotulo('cri', k)].concat(sdrs.map(s => por.get(s) || '')).concat([rows.length]));
    });
    const leads = [['Criativo (utm_content)'].concat(S.COLS.map(c => c.t))];
    grupos.forEach(([k, rows]) => {
      rows.slice().sort((a, b) => String(a.data_agendamento || '').localeCompare(String(b.data_agendamento || '')))
        .forEach(r => leads.push([S.rotulo('cri', k)].concat(S.COLS.map(c => c.x ? c.x(r) : c.g(r)))));
    });
    const q = S.per();
    const info = [['Período', `${S.fData(q.ini)} a ${S.fData(q.fim)}`], ['Data base', dash.params().db === 're' || S.filtroReuniao() ? 'Data da reunião' : 'Data do agendamento'],
      ['Filtros', S.descFiltros().join(' | ') || 'Nenhum'], ['Calls no arquivo', F.calls.length], ['Criativos', grupos.length]];
    S.salvar(`calls_leads-por-criativo_${S.dataArq()}.xlsx`, window.SRX.xlsx([
      { nome: 'Resumo por criativo', linhas: resumo }, { nome: 'Leads por criativo', linhas: leads }, { nome: 'Criativo x SDR', linhas: matriz }, { nome: 'Sobre', linhas: info }
    ]));
  }
  function relatorio() {
    const D = S.dados(), F = S.full(); if (!D.ok || !F) { S.aviso('Os dados ainda estão carregando.'); return; }
    const q = S.per(), n = Math.round(S.difDias(q.ini, q.fim)) + 1;
    const pv = S.janela(S.addDias(q.ini, -n), S.addDias(q.ini, -1)), mp = S.M(pv.calls, pv.leads, pv.a, pv.b);
    const num = v => (v == null || !isFinite(v) ? '' : Math.round(v * 10000) / 10000);
    const resumo = [['Métrica', 'Período', 'Período anterior', 'Variação', 'Como é calculado']];
    Object.keys(S.MET).forEach(id => { const t = S.MET[id], a = t.v(F.m), b = t.v(mp); resumo.push([t.nome, num(a), num(b), S.variacao(id, a, b, mp).txt, t.info]); });
    resumo.push([], ['Período', `${S.fData(q.ini)} a ${S.fData(q.fim)}`], ['Período anterior', `${S.fData(pv.a)} a ${S.fData(pv.b)}`], ['Data base', dash.params().db === 're' || S.filtroReuniao() ? 'Data da reunião' : 'Data do agendamento'], ['Filtros', S.descFiltros().join(' | ') || 'Nenhum']);
    const rk = [['Agrupar por', 'Posição', 'Nome'].concat(COLS_ORIGEM.map(c => c.t)).concat(['Campanha mãe'])];
    ['tag', 'camp', 'cri', 'med', 'fonte'].forEach(dim => {
      const gs = ranking(dim, F).sort((a, b) => (a.key === S.SEMK) - (b.key === S.SEMK) || b.m.calls.length - a.m.calls.length);
      gs.forEach((g, i) => rk.push([RK_NOMES[dim], g.key === S.SEMK ? '' : i + 1, g.nome].concat(COLS_ORIGEM.map(c => num(c.v(g.m)))).concat([g.mae || ''])));
    });
    const pessoasT = (dim, cols, ord) => [['Posição', S.DIMS[dim].nome].concat(cols.map(c => c.t))].concat(
      d3.groups(F.calls, r => r._k[dim]).map(([k, rows]) => ({ k, m: S.M(rows, []) }))
        .sort((a, b) => (a.k === S.SEMK) - (b.k === S.SEMK) || ((cols.find(c => c.k === ord) || cols[0]).v(b.m) || 0) - ((cols.find(c => c.k === ord) || cols[0]).v(a.m) || 0))
        .map((g, i) => [g.k === S.SEMK ? '' : i + 1, S.rotulo(dim, g.k)].concat(cols.map(c => num(c.v(g.m))))));
    const perdas = [['Motivo de perda', 'Perdas', '% das perdas', 'Tags de campanha']];
    const tot = F.m.perdidas.length;
    d3.groups(F.m.perdidas, r => S.limpa(r.motivo_perda) || '(sem motivo)').sort((a, b) => b[1].length - a[1].length).forEach(([mo, rs]) => {
      perdas.push([mo, rs.length, num(rs.length / tot), d3.rollups(rs, v => v.length, r => r.tag_campanha).sort((a, b) => b[1] - a[1]).map(d => `${d[0]} (${d[1]})`).join(', ')]);
    });
    const nps = [['Posição', 'SDR'].concat(COLS_NPS.map(c => c.t))];
    d3.groups(F.calls, r => r._k.sdr).map(([k, rows]) => ({ k, m: Object.assign(S.M(rows, []), { q: qualidade(rows) }) }))
      .sort((a, b) => (a.k === S.SEMK) - (b.k === S.SEMK) || ((b.m.q.media == null ? -1 : b.m.q.media) - (a.m.q.media == null ? -1 : a.m.q.media)))
      .forEach((g, i) => nps.push([g.k === S.SEMK ? '' : i + 1, S.rotulo('sdr', g.k)].concat(COLS_NPS.map(c => num(c.v(g.m))))));
    const grav = [['Posição', 'SDR'].concat(COLS_GRAV.map(c => c.t))];
    d3.groups(F.calls, r => r._k.sdr).map(([k, rows]) => ({ k, m: Object.assign(S.M(rows, []), { q: qualidade(rows) }) })).filter(g => g.m.q.real.length)
      .sort((a, b) => (a.k === S.SEMK) - (b.k === S.SEMK) || b.m.q.pend.length - a.m.q.pend.length)
      .forEach((g, i) => grav.push([g.k === S.SEMK ? '' : i + 1, S.rotulo('sdr', g.k)].concat(COLS_GRAV.map(c => num(c.v(g.m))))));
    S.salvar(`calls_relatorio-completo_${S.dataArq()}.xlsx`, window.SRX.xlsx([
      { nome: 'Resumo', linhas: resumo }, { nome: 'Ranking de origem', linhas: rk }, { nome: 'SDRs', linhas: pessoasT('sdr', COLS_SDR, 'realizadas') },
      { nome: 'Closers', linhas: pessoasT('closer', COLS_CLOSER, 'vendas') }, { nome: 'NPS closer', linhas: nps }, { nome: 'Gravações pendentes', linhas: grav }, { nome: 'Perdas', linhas: perdas }, { nome: 'Base unificada', linhas: baseTabela() }
    ]));
  }
})();
