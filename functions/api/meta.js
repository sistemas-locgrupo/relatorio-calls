/* GET /api/meta?ini=AAAA-MM-DD&fim=AAAA-MM-DD
   Lê da API de anúncios do Meta (Marketing API) o gasto, os leads e o criativo de cada anúncio
   no período. Só responde a quem está logado (o _middleware.js confere a sessão).

   Segredos / variáveis (Settings → Variables and secrets do projeto no Cloudflare Pages):
     META_TOKEN   token do usuário do sistema do Business Manager, com a permissão ads_read
     META_CONTAS  (opcional) contas e gestores, ex.: "act_123:Gabriel,act_456:Matheus".
                  Sem ela, usa todas as contas de anúncio que o usuário do sistema enxerga.
     META_VERSAO  (opcional) versão da Graph API, padrão v23.0
*/
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const okDia = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const TIPOS_LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_web_lead'];

async function graph(url, tentativas = 2) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'accept-encoding': 'identity' } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const e = j.error || {};
    /* limite de chamadas do Meta: espera um pouco e tenta de novo */
    if (i < tentativas && (r.status === 429 || [4, 17, 32, 613].includes(e.code))) { await new Promise(s => setTimeout(s, 1500 * (i + 1))); continue; }
    const msg = e.code === 190 ? 'O token do Meta é inválido ou expirou. Gere outro no Business Manager e atualize o segredo META_TOKEN.'
      : e.code === 10 || e.code === 200 ? 'O token do Meta não tem permissão de leitura (ads_read) numa das contas.'
      : 'O Meta respondeu com erro: ' + (e.message || r.status);
    throw new Error(msg);
  }
}
async function todas(url) {
  const out = [];
  let prox = url, voltas = 0;
  while (prox && voltas++ < 40) { const j = await graph(prox); (j.data || []).forEach(x => out.push(x)); prox = j.paging && j.paging.next; }
  return out;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.META_TOKEN) return json({ ok: false, conectado: false, erro: 'O Meta ainda não está conectado: falta o segredo META_TOKEN no Cloudflare.' });
    const u = new URL(request.url);
    const ini = u.searchParams.get('ini'), fim = u.searchParams.get('fim');
    if (!okDia(ini) || !okDia(fim)) return json({ ok: false, erro: 'Período inválido.' }, 400);

    /* cache de 15 minutos por período, para não estourar o limite de chamadas do Meta */
    const chaveCache = new Request(u.origin + '/__meta_cache?ini=' + ini + '&fim=' + fim + '&c=' + encodeURIComponent(env.META_CONTAS || ''));
    const cache = caches.default;
    if (u.searchParams.get('atualizar') !== '1') { const c = await cache.match(chaveCache); if (c) return new Response(c.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }

    const V = String(env.META_VERSAO || 'v23.0').trim(), T = encodeURIComponent(String(env.META_TOKEN).trim());
    const base = `https://graph.facebook.com/${V}/`;

    /* contas: as de META_CONTAS ou todas que o usuário do sistema enxerga */
    let contas = [];
    const cfg = String(env.META_CONTAS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (cfg.length) {
      contas = cfg.map(s => { const [id, g] = s.split(':'); const a = id.trim(); return { id: a.startsWith('act_') ? a : 'act_' + a, gestor: (g || '').trim() }; });
      const nomes = await graph(`${base}?ids=${contas.map(c => c.id).join(',')}&fields=name,currency,account_status&access_token=${T}`);
      contas.forEach(c => { const n = nomes[c.id] || {}; c.nome = n.name || c.id; c.moeda = n.currency || 'BRL'; });
    } else {
      const lista = await todas(`${base}me/adaccounts?fields=id,name,currency,account_status&limit=200&access_token=${T}`);
      contas = lista.map(a => ({ id: a.id, nome: a.name, moeda: a.currency || 'BRL', gestor: '' }));
    }
    if (!contas.length) return json({ ok: false, conectado: true, erro: 'O usuário do sistema do Meta não tem nenhuma conta de anúncio atribuída.' });

    const tr = encodeURIComponent(JSON.stringify({ since: ini, until: fim }));
    const anuncios = [];
    for (const c of contas) {
      const ins = await todas(`${base}${c.id}/insights?level=ad&time_range=${tr}&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,actions&limit=500&access_token=${T}`);
      ins.forEach(x => {
        const acts = x.actions || [];
        const porTipo = t => { const a = acts.find(y => y.action_type === t); return a ? Number(a.value) || 0 : 0; };
        const leads = porTipo('lead') || TIPOS_LEAD.slice(1).reduce((s, t) => s + porTipo(t), 0);
        anuncios.push({ conta: c.id, conta_nome: c.nome, gestor_conta: c.gestor, ad_id: x.ad_id, anuncio: x.ad_name || '', conjunto: x.adset_name || '', campanha: x.campaign_name || '',
          gasto: Number(x.spend) || 0, impressoes: Number(x.impressions) || 0, cliques: Number(x.clicks) || 0, leads_meta: leads });
      });
    }

    /* criativo de cada anúncio (miniatura, imagem e link de prévia), de 50 em 50 */
    const ids = [...new Set(anuncios.map(a => a.ad_id).filter(Boolean))];
    const cri = {};
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50).join(',');
      const j = await graph(`${base}?ids=${lote}&fields=preview_shareable_link,creative{thumbnail_url,image_url,instagram_permalink_url,effective_object_story_id}&thumbnail_width=320&thumbnail_height=320&access_token=${T}`);
      Object.entries(j).forEach(([id, v]) => {
        const cr = v.creative || {};
        const post = cr.effective_object_story_id ? 'https://www.facebook.com/' + cr.effective_object_story_id : '';
        cri[id] = { thumb: cr.thumbnail_url || cr.image_url || '', imagem: cr.image_url || cr.thumbnail_url || '', link: v.preview_shareable_link || cr.instagram_permalink_url || post };
      });
    }
    anuncios.forEach(a => Object.assign(a, cri[a.ad_id] || { thumb: '', imagem: '', link: '' }));

    const resp = json({ ok: true, conectado: true, ini, fim, gerado: new Date().toISOString(), contas, anuncios });
    const guardar = new Response(resp.clone().body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' } });
    await cache.put(chaveCache, guardar);
    return resp;
  } catch (e) {
    return json({ ok: false, conectado: true, erro: String(e.message || e) }, 502);
  }
}
