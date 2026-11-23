/* Login próprio do Relatório de Calls.
   Usuários ficam no KV "USUARIOS" (chave u:<email>), com a senha guardada como
   hash PBKDF2-SHA256 + sal. A sessão é um cookie assinado com HMAC-SHA256. */

export const COOKIE = '__Host-sr';
const ITER = 100000;               /* máximo aceito pelo Cloudflare Workers */
const MAX_TENTATIVAS = 5;
const BLOQUEIO_SEG = 15 * 60;
const enc = new TextEncoder();

export const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });

export function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deB64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));

export function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const normEmail = e => String(e || '').trim().toLowerCase();
export const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

export function kv(env) {
  if (!env.USUARIOS) throw new Error('Falta ligar o KV "USUARIOS" no wrangler.toml (veja o README).');
  return env.USUARIOS;
}

/* ---------- senhas ---------- */
export async function hashSenha(senha, saltB64, iter = ITER) {
  const salt = saltB64 ? deB64url(saltB64) : aleatorio(16);
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, chave, 256);
  return { hash: b64url(new Uint8Array(bits)), salt: b64url(salt), iter };
}
export async function confereSenha(senha, u) {
  const h = await hashSenha(senha, u.salt, u.iter || ITER);
  return iguais(h.hash, u.hash);
}
export function senhaFraca(s) {
  s = String(s || '');
  if (s.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (s.length > 200) return 'Senha longa demais.';
  return '';
}

/* ---------- usuários ---------- */
export async function getUsuario(env, email, cache) {
  const opts = cache ? { type: 'json', cacheTtl: 60 } : { type: 'json' };
  return kv(env).get('u:' + normEmail(email), opts);
}
export const putUsuario = (env, u) => kv(env).put('u:' + u.email, JSON.stringify(u));
export const delUsuario = (env, email) => kv(env).delete('u:' + normEmail(email));
export async function listaUsuarios(env) {
  const out = []; let cursor;
  do {
    const r = await kv(env).list({ prefix: 'u:', cursor });
    for (const k of r.keys) { const u = await kv(env).get(k.name, { type: 'json' }); if (u) out.push(u); }
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return out;
}
export const publico = u => ({ email: u.email, nome: u.nome, papel: u.papel, criado_em: u.criado_em || null, ultimo_acesso: u.ultimo_acesso || null });

/* ---------- tentativas de login ---------- */
export async function bloqueado(env, email) {
  const t = await kv(env).get('t:' + email, { type: 'json' });
  return t && t.n >= MAX_TENTATIVAS;
}
export async function falhou(env, email) {
  const t = (await kv(env).get('t:' + email, { type: 'json' })) || { n: 0 };
  t.n++;
  await kv(env).put('t:' + email, JSON.stringify(t), { expirationTtl: BLOQUEIO_SEG });
}
export const limpaTentativas = (env, email) => kv(env).delete('t:' + email);

/* ---------- sessão ---------- */
async function chaveSessao(env) {
  let s = await kv(env).get('cfg:segredo', { cacheTtl: 300 });
  if (!s) { s = b64url(aleatorio(32)); await kv(env).put('cfg:segredo', s); }
  return crypto.subtle.importKey('raw', deB64url(s), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function assina(env, txt) {
  const k = await chaveSessao(env);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(txt))));
}
export async function criaSessao(env, u, manter) {
  const dur = manter ? 30 * 86400 : 12 * 3600;
  const corpo = b64url(enc.encode(JSON.stringify({ e: u.email, v: u.v || 1, exp: Math.floor(Date.now() / 1000) + dur })));
  const token = corpo + '.' + await assina(env, corpo);
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (manter ? '; Max-Age=' + dur : '');
}
export const apagaSessao = () => COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export async function lerSessao(request, env) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + COOKIE.replace(/[-]/g, '\\-') + '=([^;]+)'));
  if (!m) return null;
  const [corpo, sig] = m[1].split('.');
  if (!corpo || !sig) return null;
  if (!iguais(await assina(env, corpo), sig)) return null;
  let p; try { p = JSON.parse(new TextDecoder().decode(deB64url(corpo))); } catch (e) { return null; }
  if (!p.exp || p.exp < Date.now() / 1000) return null;
  const u = await getUsuario(env, p.e, true);
  if (!u || (u.v || 1) !== p.v) return null;
  return u;
}

/* pedidos que mudam dados: só JSON e da mesma origem */
export function pedidoSeguro(request) {
  const url = new URL(request.url);
  const origem = request.headers.get('origin');
  if (origem && origem !== url.origin) return false;
  return (request.headers.get('content-type') || '').includes('application/json');
}
export async function corpoJSON(request) {
  try { return await request.json(); } catch (e) { return {}; }
}
