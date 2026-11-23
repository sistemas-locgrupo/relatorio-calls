/* Ligação com a API de anúncios do Meta (Marketing API), usada por /api/meta e /api/meta-anuncio. */
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export const VERSAO_PADRAO = 'v27.0';
let versaoAuto = null; /* versão que o próprio Meta mandou usar (erro 2635) */
export const versaoAtual = env => versaoAuto || String(env.META_VERSAO || '').trim().replace(/\/$/, '') || VERSAO_PADRAO;
export const baseMeta = env => 'https://graph.facebook.com/' + versaoAtual(env) + '/';
export const tokenMeta = env => encodeURIComponent(String(env.META_TOKEN || '').replace(/[\s"']/g, ''));

export async function graph(url, tentativas = 2) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'accept-encoding': 'identity' } });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return j;
    const e = j.error || {};
    /* limite de chamadas do Meta: espera um pouco e tenta de novo */
    if (i < tentativas && (r.status === 429 || [4, 17, 32, 613].includes(e.code))) { await new Promise(s => setTimeout(s, 1500 * (i + 1))); continue; }
    /* versão da API saiu de uso: o Meta diz qual usar; troca e tenta de novo */
    const nova = e.code === 2635 && /v\d+\.\d+/.exec(e.message || '');
    if (nova && i < tentativas + 1 && !url.includes('/' + nova[0] + '/')) {
      versaoAuto = nova[0];
      url = url.replace(/^https:\/\/graph\.facebook\.com\/(v\d+\.\d+\/)?/, 'https://graph.facebook.com/' + versaoAuto + '/');
      continue;
    }
    const det = ` [Meta: ${e.message || r.status}${e.error_subcode ? ' · subcódigo ' + e.error_subcode : ''}]`;
    const msg = e.code === 190 ? 'O token do Meta é inválido ou expirou. Gere outro no Business Manager e atualize o segredo META_TOKEN.' + det
      : e.code === 10 || e.code === 200 ? 'O token do Meta não tem permissão de leitura (ads_read) numa das contas.' + det
      : 'O Meta respondeu com erro: ' + (e.message || r.status) + (e.code ? ' (código ' + e.code + ')' : '');
    throw new Error(msg);
  }
}
export async function todas(url) {
  const out = [];
  let prox = url, voltas = 0;
  while (prox && voltas++ < 40) { const j = await graph(prox); (j.data || []).forEach(x => out.push(x)); prox = j.paging && j.paging.next; }
  return out;
}

