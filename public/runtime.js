/* Runtime do Relatório de Calls fora do claude.ai.
   Faz o mesmo papel do painel do claude.ai: busca os dados em /api/dados,
   monta a base unificada e redesenha a página quando dados ou filtros mudam. */
(function () {
  const loaders = {}, calcs = {}, drawMap = {}, draws = [], onDatas = [];
  const data = {};
  let params = {};
  let carregando = false;

  try { params = JSON.parse(sessionStorage.getItem('sr-params') || '{}') || {}; } catch (e) { params = {}; }
  const salvar = () => { try { sessionStorage.setItem('sr-params', JSON.stringify(params)); } catch (e) { } };

  const estado = id => data[id] || { status: 'loading', data: calcs[id] ? null : [] };

  function rodaDesenho(nome) {
    const f = drawMap[nome]; if (!f) return;
    document.querySelectorAll('[data-draw="' + nome + '"]').forEach(el => {
      if (el.closest('[hidden]')) return;
      try {
        if (typeof f === 'function') f(el);
        else {
          if (!el.__m) { el.replaceChildren(); el.__m = f.mount ? f.mount(el) : {}; }
          if (f.update) f.update(el, el.__m);
        }
      } catch (e) { console.error('Erro ao desenhar', nome, e); }
    });
  }
  function rodaTudo() {
    onDatas.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    draws.forEach(rodaDesenho);
  }

  function aviso(msg) {
    let b = document.getElementById('sr-erro');
    if (!msg) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'sr-erro';
      b.style.cssText = 'position:sticky;top:0;z-index:200;background:#FFF4E5;color:#7A3E00;border-bottom:1px solid #FFD599;padding:10px 16px;font:500 13px Manrope,system-ui,sans-serif';
      document.body.prepend(b);
    }
    b.textContent = msg;
  }

  async function carregar() {
    if (carregando) return;
    carregando = true;
    try {
      const r = await fetch('/api/dados', { headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
      const txt = await r.text();
      let j = {}, malformado = false;
      try { j = JSON.parse(txt); } catch (e) { malformado = true; }
      if (r.status === 401) { location.replace('/login?volta=' + encodeURIComponent(location.pathname + location.search)); return; }
      if (!r.ok) throw new Error(j.erro || (r.status === 503 ? 'O servidor demorou para responder (503). Tente atualizar em alguns segundos.' : 'Erro ' + r.status + ' ao buscar os dados'));
      if (malformado) throw new Error('A resposta do servidor veio num formato inesperado (' + (r.headers.get('content-type') || 'sem tipo') + ', ' + txt.length + ' caracteres, começa com "' + txt.slice(0, 20).replace(/[^\x20-\x7e]/g, '?') + '"). Avise o suporte.');
      if (!j.valueRanges && !j.leads) throw new Error('O servidor respondeu sem os dados da planilha. Atualize a página com Ctrl+Shift+R.');
      if (j.valueRanges) {
        /* resposta direta do Google: uma faixa por aba, na ordem do servidor */
        (r.headers.get('x-abas') || 'leads,reunioes,negocios').split(',').forEach((k, i) => { j[k] = { values: (j.valueRanges[i] || {}).values || [] }; });
      }
      for (const id in loaders) data[id] = { status: 'ok', data: loaders[id].fn({ answer: j[id] || { values: [] } }).rows };
      for (const id in calcs) { const c = calcs[id]; data[id] = { status: 'ok', data: c.fn(...c.inputs.map(i => (data[i] || {}).data || [])) }; }
      aviso('');
    } catch (e) {
      console.error(e);
      const ids = Object.keys(loaders).concat(Object.keys(calcs));
      ids.forEach(id => { if (!data[id] || data[id].status !== 'ok') data[id] = { status: 'error', data: calcs[id] ? null : [], message: String(e.message || e) }; });
      aviso('Não foi possível atualizar os dados: ' + (e.message || e));
    }
    carregando = false;
    rodaTudo();
  }

  window.dash = {
    loader: (id, o) => { loaders[id] = o; },
    calc: (id, o) => { calcs[id] = o; },
    data: id => estado(id),
    draw: (nome, f) => { if (f) { if (!drawMap[nome]) draws.push(nome); drawMap[nome] = f; } else rodaDesenho(nome); },
    onData: fn => { onDatas.push(fn); },
    params: () => Object.assign({}, params),
    setParams: o => { for (const k in o) { if (o[k] == null) delete params[k]; else params[k] = o[k]; } salvar(); rodaTudo(); },
    resetParams: () => { params = {}; salvar(); rodaTudo(); },
    refresh: () => { carregar(); },
    setLink: nome => { try { history.replaceState(null, '', '#' + nome); } catch (e) { } },
    colors: ['#2103CE', '#0096FF', '#E5484D', '#B8BCC6']
  };

  /* downloads: baixa o arquivo direto pelo navegador */
  window.claude = {
    use: async nome => nome !== 'downloads' ? null : {
      save: async ({ filename, data: conteudo }) => {
        const tipo = /\.csv$/i.test(filename) ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      }
    }
  };

  /* perfil do usuário logado, no rodapé do menu lateral */
  async function menuUsuario() {
    let eu; try { const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) return; eu = await r.json(); } catch (e) { return; }
    /* Saúde do funil: só administradores veem */
    const raiz = document.querySelector('.sr');
    if (raiz && eu.papel === 'admin') raiz.classList.add('sr-admin');
    else {
      let v = null; try { v = sessionStorage.getItem('sr-visao'); } catch (e) { }
      if (v === 'saude') { const b = document.querySelector('[data-ir="progressao"]'); if (b) b.click(); }
    }
    const lugar = document.querySelector('.sr-navpe') || document.querySelector('.sr-head .sr-ctl'); if (!lugar || document.getElementById('sr-conta')) return;
    const st = document.createElement('style');
    st.textContent = '#sr-conta{position:relative;width:100%}' +
      '#sr-conta>button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:1px solid var(--borda);border-radius:12px;background:transparent;color:var(--txt);font:inherit;cursor:pointer;text-align:left}' +
      '.sr.escuro #sr-conta>button{border-color:rgba(255,255,255,.14);color:#fff}' +
      '#sr-conta>button:hover{background:var(--hover)}.sr.escuro #sr-conta>button:hover{background:rgba(255,255,255,.07)}' +
      '#sr-conta .av{width:32px;height:32px;border-radius:50%;background:#00F013;color:#120251;display:grid;place-items:center;font-size:12px;font-weight:800;flex:none}' +
      '#sr-conta .tx{display:flex;flex-direction:column;min-width:0;line-height:1.25}' +
      '#sr-conta .nm{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#sr-conta .pf{font-size:11.5px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sr.escuro #sr-conta .pf{color:rgba(255,255,255,.6)}' +
      '#sr-conta .sx{margin-left:auto;width:16px;height:16px;flex:none;opacity:.6}' +
      '#sr-conta-menu{position:absolute;left:0;right:0;bottom:calc(100% + 8px);background:var(--card);color:var(--txt);border:1px solid var(--borda);border-radius:14px;box-shadow:0 2px 4px rgba(16,24,40,.06),0 16px 36px -12px rgba(16,24,40,.3);padding:6px;z-index:60}' +
      '#sr-conta-menu .who{padding:8px 10px 10px;border-bottom:1px solid var(--borda);margin-bottom:4px;font-size:12px;color:var(--txt2);line-height:1.4;word-break:break-all}#sr-conta-menu .who b{display:block;color:var(--txt);font-size:13px;word-break:normal}' +
      '#sr-conta-menu a{display:block;padding:9px 10px;border-radius:8px;color:var(--txt);text-decoration:none;font-size:13px;font-weight:600}#sr-conta-menu a:hover{background:var(--hover)}#sr-conta-menu a.sair{color:var(--c-ns)}' +
      '@media (max-width:900px){#sr-conta{width:auto}#sr-conta>button{padding:5px}#sr-conta .tx,#sr-conta .sx{display:none}#sr-conta-menu{left:auto;right:0;top:calc(100% + 8px);bottom:auto;width:240px}}';
    document.head.appendChild(st);
    const ini = (eu.nome || eu.email).trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const w = document.createElement('div'); w.id = 'sr-conta';
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
    const av = document.createElement('span'); av.className = 'av'; av.textContent = ini;
    const tx = document.createElement('span'); tx.className = 'tx';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = eu.nome || eu.email;
    const pf = document.createElement('span'); pf.className = 'pf'; pf.textContent = eu.papel === 'admin' ? 'Administrador' : 'Usuário';
    tx.append(nm, pf);
    const sx = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sx.setAttribute('class', 'sx'); sx.setAttribute('viewBox', '0 0 24 24'); sx.setAttribute('aria-hidden', 'true');
    sx.innerHTML = '<path d="m7 15 5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    b.append(av, tx, sx);
    const m = document.createElement('div'); m.id = 'sr-conta-menu'; m.setAttribute('role', 'menu'); m.hidden = true;
    const who = document.createElement('div'); who.className = 'who'; const bn = document.createElement('b'); bn.textContent = eu.nome || ''; who.append(bn, document.createTextNode(eu.email));
    const link = (txt, href, cls) => { const a = document.createElement('a'); a.href = href; a.textContent = txt; a.setAttribute('role', 'menuitem'); if (cls) a.className = cls; return a; };
    m.append(who, link('Trocar senha', '/senha'));
    if (eu.papel === 'admin') m.append(link('Usuários e metas', '/admin'));
    m.append(link('Sair', '/api/logout', 'sair'));
    const abre = v => { m.hidden = !v; b.setAttribute('aria-expanded', String(v)); };
    b.addEventListener('click', e => { e.stopPropagation(); abre(m.hidden); });
    document.addEventListener('click', e => { if (!w.contains(e.target)) abre(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') abre(false); });
    w.append(b, m); lugar.appendChild(w);
    if (eu.trocar_senha) location.replace('/senha?primeiro=1');
  }

  let t = null;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(rodaTudo, 150); });
  document.addEventListener('DOMContentLoaded', () => { rodaTudo(); carregar(); menuUsuario(); });
})();
