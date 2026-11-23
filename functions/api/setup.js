/* Cria o primeiro administrador. Só funciona enquanto não existe nenhum usuário. */
import { json, kv, normEmail, emailValido, senhaFraca, hashSenha, putUsuario, criaSessao, pedidoSeguro, corpoJSON } from '../../lib/auth.js';

const DOMINIO = '@locgrupo.com.br';
const vazio = async env => (await kv(env).list({ prefix: 'u:', limit: 1 })).keys.length === 0;

export async function onRequestGet({ env }) {
  try { return json({ aberto: await vazio(env), dominio: DOMINIO }); }
  catch (e) { return json({ erro: String(e.message || e) }, 500); }
}

export async function onRequestPost({ request, env }) {
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  try {
    if (!(await vazio(env))) return json({ erro: 'O primeiro acesso já foi criado. Entre com seu e-mail e senha.' }, 409);
    const b = await corpoJSON(request);
    const email = normEmail(b.email), nome = String(b.nome || '').trim().slice(0, 80);
    if (!nome) return json({ erro: 'Informe seu nome.' }, 400);
    if (!emailValido(email) || !email.endsWith(DOMINIO)) return json({ erro: 'Use um e-mail ' + DOMINIO + '.' }, 400);
    const fraca = senhaFraca(b.senha); if (fraca) return json({ erro: fraca }, 400);
    const u = Object.assign({ email, nome, papel: 'admin', v: 1, criado_em: new Date().toISOString(), ultimo_acesso: new Date().toISOString() }, await hashSenha(String(b.senha)));
    await putUsuario(env, u);
    return json({ ok: true }, 200, { 'set-cookie': await criaSessao(env, u, true) });
  } catch (e) {
    return json({ erro: String(e.message || e) }, 500);
  }
}
