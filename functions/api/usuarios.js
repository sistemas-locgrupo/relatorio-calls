/* Administração de usuários (só administradores; o _middleware confere). */
import { json, normEmail, emailValido, senhaFraca, hashSenha, getUsuario, putUsuario, delUsuario, listaUsuarios, publico, pedidoSeguro, corpoJSON } from '../../lib/auth.js';

const senhaProvisoria = () => {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(r, x => letras[x % letras.length]).join('');
};

export async function onRequestGet({ env }) {
  try {
    const l = (await listaUsuarios(env)).map(publico).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return json({ usuarios: l });
  } catch (e) { return json({ erro: String(e.message || e) }, 500); }
}

/* acao: criar | redefinir | papel */
export async function onRequestPost({ request, env, data }) {
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  const b = await corpoJSON(request);
  const email = normEmail(b.email);
  try {
    if (b.acao === 'criar') {
      const nome = String(b.nome || '').trim().slice(0, 80);
      const papel = b.papel === 'admin' ? 'admin' : 'usuario';
      if (!nome) return json({ erro: 'Informe o nome.' }, 400);
      if (!emailValido(email)) return json({ erro: 'E-mail inválido.' }, 400);
      if (await getUsuario(env, email)) return json({ erro: 'Já existe um usuário com esse e-mail.' }, 409);
      const senha = b.senha ? String(b.senha) : senhaProvisoria();
      const fraca = senhaFraca(senha); if (fraca) return json({ erro: fraca }, 400);
      await putUsuario(env, Object.assign({ email, nome, papel, v: 1, trocar_senha: true, criado_em: new Date().toISOString() }, await hashSenha(senha)));
      return json({ ok: true, senha });
    }
    const u = await getUsuario(env, email);
    if (!u) return json({ erro: 'Usuário não encontrado.' }, 404);
    if (b.acao === 'redefinir') {
      const senha = senhaProvisoria();
      Object.assign(u, await hashSenha(senha), { v: (u.v || 1) + 1, trocar_senha: true });
      await putUsuario(env, u);
      return json({ ok: true, senha });
    }
    if (b.acao === 'papel') {
      if (u.email === data.usuario.email) return json({ erro: 'Você não pode mudar o seu próprio perfil.' }, 400);
      u.papel = b.papel === 'admin' ? 'admin' : 'usuario';
      await putUsuario(env, u);
      return json({ ok: true });
    }
    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) { return json({ erro: String(e.message || e) }, 500); }
}

export async function onRequestDelete({ request, env, data }) {
  if (!pedidoSeguro(request)) return json({ erro: 'Pedido inválido.' }, 400);
  const email = normEmail((await corpoJSON(request)).email);
  if (email === data.usuario.email) return json({ erro: 'Você não pode remover o seu próprio acesso.' }, 400);
  try { await delUsuario(env, email); return json({ ok: true }); }
  catch (e) { return json({ erro: String(e.message || e) }, 500); }
}
