/* O próprio usuário troca a senha. */
import { json, confereSenha, senhaFraca, hashSenha, putUsuario, criaSessao, pedidoSeguro, corpoJSON } from '../../lib/auth.js';

export async function onRequestPost({ request, env, data }) {
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  const b = await corpoJSON(request);
  const u = data.usuario;
  try {
    if (!(await confereSenha(String(b.atual || ''), u))) return json({ erro: 'A senha atual não confere.' }, 400);
    const fraca = senhaFraca(b.nova); if (fraca) return json({ erro: fraca }, 400);
    if (String(b.nova) === String(b.atual)) return json({ erro: 'A nova senha precisa ser diferente da atual.' }, 400);
    Object.assign(u, await hashSenha(String(b.nova)), { v: (u.v || 1) + 1 });
    delete u.trocar_senha;
    await putUsuario(env, u);
    return json({ ok: true }, 200, { 'set-cookie': await criaSessao(env, u, true) });
  } catch (e) {
    return json({ erro: String(e.message || e) }, 500);
  }
}
