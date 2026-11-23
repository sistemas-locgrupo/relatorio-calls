import { apagaSessao } from '../../lib/auth.js';

export async function onRequest({ request }) {
  const url = new URL(request.url);
  return new Response(null, { status: 302, headers: { location: url.origin + '/login', 'set-cookie': apagaSessao(), 'cache-control': 'no-store' } });
}
