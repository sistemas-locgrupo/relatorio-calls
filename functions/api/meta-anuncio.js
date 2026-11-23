import { json, graph, baseMeta, tokenMeta } from '../../lib/meta.js';

/* GET /api/meta-anuncio?ad=ID
   Detalhes de um anúncio para o pop-up do criativo: textos, vídeo (quando houver) e a prévia do Meta. */
export async function onRequestGet({ request, env }) {
  try {
    if (!env.META_TOKEN) return json({ ok: false, erro: 'O Meta ainda não está conectado.' });
    const ad = new URL(request.url).searchParams.get('ad') || '';
    if (!/^\d{5,25}$/.test(ad)) return json({ ok: false, erro: 'Anúncio inválido.' }, 400);
    const T = tokenMeta(env), B = baseMeta(env);
    const a = await graph(`${B}${ad}?fields=name,preview_shareable_link,adset{name},campaign{name},creative{title,body,thumbnail_url,image_url,video_id,instagram_permalink_url,effective_object_story_id,object_story_spec,asset_feed_spec}&thumbnail_width=640&thumbnail_height=640&access_token=${T}`);
    const cr = a.creative || {}, oss = cr.object_story_spec || {}, vd = oss.video_data || {}, ld = oss.link_data || {}, af = cr.asset_feed_spec || {};
    const primeiro = (lista, k) => (Array.isArray(lista) && lista.length ? (lista[0] || {})[k] : '') || '';
    const videoId = cr.video_id || vd.video_id || primeiro(af.videos, 'video_id');
    const out = {
      ok: true, ad, nome: a.name || '', conjunto: (a.adset || {}).name || '', campanha: (a.campaign || {}).name || '',
      titulo: cr.title || vd.title || ld.name || primeiro(af.titles, 'text'),
      texto: cr.body || vd.message || ld.message || primeiro(af.bodies, 'text'),
      imagem: cr.image_url || vd.image_url || ld.picture || cr.thumbnail_url || '',
      link: a.preview_shareable_link || cr.instagram_permalink_url || (cr.effective_object_story_id ? 'https://www.facebook.com/' + cr.effective_object_story_id : ''),
      video: null, previa: ''
    };
    /* vídeo: o arquivo mp4 do Meta, quando a conta permite ler */
    if (videoId) {
      try {
        const v = await graph(`${B}${videoId}?fields=source,picture,length,permalink_url&access_token=${T}`, 1);
        out.video = { id: videoId, source: v.source || '', capa: v.picture || out.imagem, duracao: v.length || 0, link: v.permalink_url ? 'https://www.facebook.com' + v.permalink_url : '' };
      } catch (e) { out.video = { id: videoId, source: '', capa: out.imagem, erro: String(e.message || e) }; }
    }
    /* prévia oficial do anúncio (iframe do Meta), usada quando não há o arquivo do vídeo */
    for (const fmt of ['MOBILE_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'INSTAGRAM_REELS']) {
      try {
        const p = await graph(`${B}${ad}/previews?ad_format=${fmt}&access_token=${T}`, 0);
        const html = ((p.data || [])[0] || {}).body || '';
        const m = /src="([^"]+)"/.exec(html);
        if (m) { out.previa = m[1].replace(/&amp;/g, '&'); out.formato = fmt; break; }
      } catch (e) { /* tenta o próximo formato */ }
    }
    return json(out);
  } catch (e) {
    return json({ ok: false, erro: String(e.message || e) });
  }
}
