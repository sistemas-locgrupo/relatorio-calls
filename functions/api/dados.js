/* GET /api/dados
   Lê as abas leads, reunioes e negocios da planilha com a conta de serviço do Google
   e devolve para a página. Só responde a quem está logado (o _middleware.js confere a sessão).

   Segredos (Settings → Variables and secrets do projeto no Cloudflare Pages):
     GOOGLE_SA_EMAIL  e-mail da conta de serviço (...@lochub-514512.iam.gserviceaccount.com)
     GOOGLE_SA_KEY    o campo "private_key" do arquivo JSON da chave
     SHEET_ID         id da planilha
*/
const ABAS = { leads: 'leads!A:Z', reunioes: 'reunioes!A:Z', negocios: 'negocios!A:AC' };
let tokenCache = null;

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function tokenGoogle(env) {
  const agora = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > agora) return tokenCache.token;
  if (!env.GOOGLE_SA_EMAIL || !env.GOOGLE_SA_KEY) throw new Error('Faltam os segredos GOOGLE_SA_EMAIL e/ou GOOGLE_SA_KEY no Cloudflare.');
  const email = String(env.GOOGLE_SA_EMAIL).trim().replace(/^"|"$/g, '');
  const pem = String(env.GOOGLE_SA_KEY).trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  const corpo = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const der = Uint8Array.from(atob(corpo), c => c.charCodeAt(0));
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const semAssinatura = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600
  });
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', chave, new TextEncoder().encode(semAssinatura));
  const jwt = semAssinatura + '.' + b64url(new Uint8Array(assinatura));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('O Google recusou a conta de serviço (' + email + '): ' + (j.error_description || j.error || r.status));
  tokenCache = { token: j.access_token, exp: agora + (j.expires_in || 3600) };
  return j.access_token;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.SHEET_ID) throw new Error('Falta o segredo SHEET_ID no Cloudflare.');
    const token = await tokenGoogle(env);
    const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SHEET_ID)}/values:batchGet`);
    Object.values(ABAS).forEach(a => url.searchParams.append('ranges', a));
    url.searchParams.set('valueRenderOption', 'FORMATTED_VALUE');
    url.searchParams.set('majorDimension', 'ROWS');
    const r = await fetch(url.toString(), { headers: { authorization: 'Bearer ' + token, 'accept-encoding': 'identity' } });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const msg = (j.error && j.error.message) || r.status;
      throw new Error(r.status === 403 ? 'A conta de serviço não tem acesso à planilha. Compartilhe a planilha com o e-mail dela como Leitor.' : 'Erro ao ler a planilha: ' + msg);
    }
    /* repassa a resposta do Google sem abrir o JSON aqui: abrir e remontar os dados
       estoura o limite de processamento do plano grátis do Cloudflare (erro 503).
       A página separa as abas pela ordem: leads, reunioes, negocios. */
    return new Response(r.body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=60', 'x-abas': Object.keys(ABAS).join(',') } });
  } catch (e) {
    return json({ erro: String(e.message || e) }, 500);
  }
}
