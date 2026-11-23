import { json, publico } from '../../lib/auth.js';

export async function onRequestGet({ data }) {
  return json(Object.assign(publico(data.usuario), { trocar_senha: !!data.usuario.trocar_senha }));
}
