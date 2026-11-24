/* Token do Google (conta de serviço) para ler a planilha. Usado por /api/dados e /api/metas. */
let tokenCache = null;


function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function tokenGoogle(env) {
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

