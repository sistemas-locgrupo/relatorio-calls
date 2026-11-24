import { json, graph, todas, baseMeta, tokenMeta, versaoAtual } from '../../lib/meta.js';

/* GET /api/meta?ini=AAAA-MM-DD&fim=AAAA-MM-DD
   Lê da API de anúncios do Meta (Marketing API) o gasto, os leads e o criativo de cada anúncio
   no período. Só responde a quem está logado (o _middleware.js confere a sessão).

   Segredos / variáveis (Settings → Variables and secrets do projeto no Cloudflare Pages):
     META_TOKEN   token do usuário do sistema do Business Manager, com a permissão ads_read
     META_CONTAS  (opcional) contas e gestores, ex.: "act_123:Gabriel,act_456:Matheus".
                  Sem ela, usa todas as contas de anúncio que o usuário do sistema enxerga.
     META_VERSAO  (opcional) versão da Graph API, ex.: v27.0. Se o Meta disser que a versão saiu de uso,
                  o relatório passa sozinho para a versão que o Meta indicar.
*/
const okDia = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const TIPOS_LEAD = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead', 'onsite_web_lead'];

export async function onRequestGet({ request, env }) {
  try {
    if (!env.META_TOKEN) return json({ ok: false, conectado: false, erro: 'O Meta ainda não está conectado: falta o segredo META_TOKEN no Cloudflare.' });
    const u = new URL(request.url);
    const ini = u.searchParams.get('ini'), fim = u.searchParams.get('fim');
    if (!okDia(ini) || !okDia(fim)) return json({ ok: false, erro: 'Período inválido.' }, 400);

    /* cache de 15 minutos por período, para não estourar o limite de chamadas do Meta */
    const chaveCache = new Request(u.origin + '/__meta_cache?ini=' + ini + '&fim=' + fim + '&c=' + encodeURIComponent(env.META_CONTAS || '') + '&v=2');
    const cache = caches.default;
    if (u.searchParams.get('atualizar') !== '1') { const c = await cache.match(chaveCache); if (c) return new Response(c.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }

    const T = tokenMeta(env), B = () => baseMeta(env);

    /* contas: as de META_CONTAS ou todas que o usuário do sistema enxerga */
    let contas = [];
    const cfg = String(env.META_CONTAS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (cfg.length) {
      contas = cfg.map(s => { const [id, g] = s.split(':'); const a = id.trim(); return { id: a.startsWith('act_') ? a : 'act_' + a, gestor: (g || '').trim() }; });
      for (const c of contas) { const n = await graph(`${B()}${c.id}?fields=name,currency&access_token=${T}`); c.nome = n.name || c.id; c.moeda = n.currency || 'BRL'; }
    } else {
      const lista = await todas(`${B()}me/adaccounts?fields=id,name,currency,account_status&limit=200&access_token=${T}`);
      contas = lista.map(a => ({ id: a.id, nome: a.name, moeda: a.currency || 'BRL', gestor: '' }));
    }
    if (!contas.length) return json({ ok: false, conectado: true, erro: 'O usuário do sistema do Meta não tem nenhuma conta de anúncio atribuída.' });

    const tr = encodeURIComponent(JSON.stringify({ since: ini, until: fim }));
    const anuncios = [];
    for (const c of contas) {
      const ins = await todas(`${B()}${c.id}/insights?level=ad&time_range=${tr}&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions&limit=500&access_token=${T}`);
      ins.forEach(x => {
        const acts = x.actions || [];
        const porTipo = t => { const a = acts.find(y => y.action_type === t); return a ? Number(a.value) || 0 : 0; };
        const leads = porTipo('lead') || TIPOS_LEAD.slice(1).reduce((s, t) => s + porTipo(t), 0);
        anuncios.push({ conta: c.id, conta_nome: c.nome, gestor_conta: c.gestor, ad_id: x.ad_id, anuncio: x.ad_name || '', conjunto: x.adset_name || '', campanha: x.campaign_name || '',
          gasto: Number(x.spend) || 0, impressoes: Number(x.impressions) || 0, alcance: Number(x.reach) || 0, cliques: Number(x.inline_link_clicks || x.clicks) || 0, leads_meta: leads });
      });
    }

    /* gasto e leads por dia de cada conta (tendência diária). Se falhar, o resto continua */
    let diario = [];
    try {
      for (const c of contas) {
        const ds = await todas(`${B()}${c.id}/insights?level=account&time_increment=1&time_range=${tr}&fields=spend,actions,date_start&limit=500&access_token=${T}`);
        ds.forEach(x => {
          const acts = x.actions || [];
          const porTipo = t => { const a = acts.find(y => y.action_type === t); return a ? Number(a.value) || 0 : 0; };
          diario.push({ conta: c.id, dia: x.date_start, gasto: Number(x.spend) || 0, leads_meta: porTipo('lead') || TIPOS_LEAD.slice(1).reduce((s, t) => s + porTipo(t), 0) });
        });
      }
    } catch (e) { diario = null; }

    /* criativo de cada anúncio (miniatura, imagem e link de prévia): pela conta, filtrando os ids, de 50 em 50 */
    const cri = {}; let avisoCriativo = '';
    try {
    for (const c of contas) {
      const ids = [...new Set(anuncios.filter(a => a.conta === c.id).map(a => a.ad_id).filter(Boolean))];
      for (let i = 0; i < ids.length; i += 50) {
        const filtro = encodeURIComponent(JSON.stringify([{ field: 'id', operator: 'IN', value: ids.slice(i, i + 50) }]));
        const lista = await todas(`${B()}${c.id}/ads?fields=id,preview_shareable_link,creative{thumbnail_url,image_url,instagram_permalink_url,effective_object_story_id}&thumbnail_width=320&thumbnail_height=320&filtering=${filtro}&limit=50&access_token=${T}`);
        lista.forEach(v => {
          const cr = v.creative || {};
          const post = cr.effective_object_story_id ? 'https://www.facebook.com/' + cr.effective_object_story_id : '';
          cri[v.id] = { thumb: cr.thumbnail_url || cr.image_url || '', imagem: cr.image_url || cr.thumbnail_url || '', link: v.preview_shareable_link || cr.instagram_permalink_url || post };
        });
      }
    }
    } catch (e) { avisoCriativo = 'Os números vieram, mas as imagens dos criativos não: ' + String(e.message || e); }
    anuncios.forEach(a => Object.assign(a, cri[a.ad_id] || { thumb: '', imagem: '', link: '' }));

    const resp = json({ ok: true, conectado: true, ini, fim, gerado: new Date().toISOString(), versao: versaoAtual(env), contas, anuncios, diario, aviso: avisoCriativo });
    const guardar = new Response(resp.clone().body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' } });
    await cache.put(chaveCache, guardar);
    return resp;
  } catch (e) {
    /* responde 200 com ok:false: um 5xx faz o Cloudflare trocar a resposta pela página "Bad gateway" e a mensagem se perde */
    return json({ ok: false, conectado: true, erro: String(e.message || e) });
  }
}
