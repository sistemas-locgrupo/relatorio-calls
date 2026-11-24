/* /api/metas: metas do mês por time, SDR e closer, guardadas no KV (chave cfg:metas).
   GET  → qualquer pessoa logada lê as metas (o relatório usa na página Metas).
          Com ?pessoas=1 traz também a lista de SDRs e closers ativos da aba config da planilha.
   PUT  → só administradores gravam as metas de um mês: { mes: 'AAAA-MM', metas: {...}, diasUteis: [1..5] } */
import { json, kv, pedidoSeguro, corpoJSON } from '../../lib/auth.js';
import { tokenGoogle } from '../../lib/google.js';

const CHAVE = 'cfg:metas';
const okMes = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m || '');
const num = v => { const x = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : null; };
const limpaGrupo = (o, campos) => { const r = {}; campos.forEach(c => { const v = num((o || {})[c]); if (v != null) r[c] = v; }); return r; };

async function pessoas(env) {
  if (!env.SHEET_ID) return [];
  const token = await tokenGoogle(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SHEET_ID)}/values/${encodeURIComponent('config!A:E')}`;
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) return [];
  const v = ((await r.json()).values || []);
  const h = (v[0] || []).map(x => String(x).trim().toLowerCase());
  const iN = h.indexOf('nome'), iP = h.indexOf('papel'), iA = h.indexOf('ativo');
  return v.slice(1).map(l => ({ nome: String(l[iN] || '').trim(), papel: String(l[iP] || '').trim().toLowerCase(), ativo: String(l[iA] || '').trim().toLowerCase() !== 'nao' }))
    .filter(p => p.nome && p.ativo && (p.papel === 'sdr' || p.papel === 'closer'))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function onRequestGet({ request, env }) {
  try {
    const m = (await kv(env).get(CHAVE, { type: 'json' })) || { meses: {}, diasUteis: [1, 2, 3, 4, 5] };
    const out = { ok: true, meses: m.meses || {}, diasUteis: m.diasUteis || [1, 2, 3, 4, 5], atualizado_em: m.atualizado_em || null, atualizado_por: m.atualizado_por || null };
    if (new URL(request.url).searchParams.get('pessoas') === '1') { try { out.pessoas = await pessoas(env); } catch (e) { out.pessoas = []; out.aviso = 'Não foi possível ler a lista de pessoas da planilha: ' + String(e.message || e); } }
    return json(out);
  } catch (e) { return json({ ok: false, erro: String(e.message || e) }, 500); }
}

export async function onRequestPut({ request, env, data }) {
  if (!data.usuario || data.usuario.papel !== 'admin') return json({ erro: 'Só administradores podem cadastrar metas.' }, 403);
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  const b = await corpoJSON(request);
  if (!okMes(b.mes)) return json({ erro: 'Mês inválido.' }, 400);
  try {
    const atual = (await kv(env).get(CHAVE, { type: 'json' })) || { meses: {} };
    const e = b.metas || {};
    const porPessoa = (o, campos) => { const r = { padrao: limpaGrupo((o || {}).padrao, campos) }; Object.keys(o || {}).filter(k => k !== 'padrao').slice(0, 300).forEach(k => { const g = limpaGrupo(o[k], campos); if (Object.keys(g).length) r[String(k).slice(0, 80)] = g; }); return r; };
    atual.meses = atual.meses || {};
    atual.meses[b.mes] = {
      time: limpaGrupo(e.time, ['leads', 'agendadas', 'realizadas', 'vendas', 'valor']),
      sdr: porPessoa(e.sdr, ['agendadas', 'realizadas']),
      closer: porPessoa(e.closer, ['realizadas', 'vendas', 'valor'])
    };
    if (Array.isArray(b.diasUteis)) atual.diasUteis = [...new Set(b.diasUteis.map(Number).filter(d => d >= 0 && d <= 6))].sort();
    atual.atualizado_em = new Date().toISOString(); atual.atualizado_por = data.usuario.nome || data.usuario.email;
    await kv(env).put(CHAVE, JSON.stringify(atual));
    return json({ ok: true });
  } catch (err) { return json({ erro: String(err.message || err) }, 500); }
}
