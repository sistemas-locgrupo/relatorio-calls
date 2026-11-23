/* Protege todo o site: sem sessão válida, páginas vão para /login e a API responde 401. */
import { lerSessao, json } from '../lib/auth.js';

const LIVRES = ['/login', '/login.html', '/auth.css', '/fonts.css', '/logo.png', '/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/api/login', '/api/setup', '/api/logout'];
const SO_ADMIN = ['/admin', '/admin.html', '/api/usuarios'];

export async function onRequest(ctx) {
  const { request, env, next, data } = ctx;
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '') || '/';
  const cabecalhos = r => {
    const h = new Headers(r.headers);
    h.set('x-frame-options', 'DENY');
    h.set('x-content-type-options', 'nosniff');
    h.set('referrer-policy', 'same-origin');
    h.set('x-robots-tag', 'noindex, nofollow');
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  };
  if (LIVRES.includes(p)) return cabecalhos(await next());

  let u = null;
  try { u = await lerSessao(request, env); }
  catch (e) { return json({ erro: String(e.message || e) }, 500); }

  if (!u) {
    if (p.startsWith('/api/')) return json({ erro: 'Sessão expirada. Entre de novo.' }, 401);
    const volta = url.pathname + url.search;
    return Response.redirect(url.origin + '/login' + (volta && volta !== '/' ? '?volta=' + encodeURIComponent(volta) : ''), 302);
  }
  if (SO_ADMIN.includes(p) && u.papel !== 'admin') {
    if (p.startsWith('/api/')) return json({ erro: 'Só administradores podem fazer isso.' }, 403);
    return Response.redirect(url.origin + '/', 302);
  }
  data.usuario = u;
  const r = await next();
  const h = cabecalhos(r);
  if ((h.headers.get('content-type') || '').includes('text/html')) h.headers.set('cache-control', 'no-store');
  return h;
}
