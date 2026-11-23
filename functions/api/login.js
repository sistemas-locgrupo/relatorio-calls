import { json, normEmail, getUsuario, putUsuario, confereSenha, hashSenha, bloqueado, falhou, limpaTentativas, criaSessao, pedidoSeguro, corpoJSON } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  const b = await corpoJSON(request);
  const email = normEmail(b.email), senha = String(b.senha || '');
  if (!email || !senha) return json({ erro: 'Preencha e-mail e senha.' }, 400);
  try {
    if (await bloqueado(env, email)) return json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' }, 429);
    const u = await getUsuario(env, email);
    const ok = u ? await confereSenha(senha, u) : (await hashSenha(senha), false);
    if (!ok) { await falhou(env, email); return json({ erro: 'E-mail ou senha incorretos.' }, 401); }
    await limpaTentativas(env, email);
    u.ultimo_acesso = new Date().toISOString();
    await putUsuario(env, u);
    return json({ ok: true, trocar: !!u.trocar_senha }, 200, { 'set-cookie': await criaSessao(env, u, !!b.manter) });
  } catch (e) {
    return json({ erro: String(e.message || e) }, 500);
  }
}
