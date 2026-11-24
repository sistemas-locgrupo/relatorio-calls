/* GET /api/dados
   Lê as abas leads, reunioes, negocios e higiene da planilha com a conta de serviço do Google
   e devolve para a página. Só responde a quem está logado (o _middleware.js confere a sessão).

   Segredos (Settings → Variables and secrets do projeto no Cloudflare Pages):
     GOOGLE_SA_EMAIL  e-mail da conta de serviço (...@lochub-514512.iam.gserviceaccount.com)
     GOOGLE_SA_KEY    o campo "private_key" do arquivo JSON da chave
     SHEET_ID         id da planilha
*/
import { tokenGoogle } from '../../lib/google.js';

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra) });

const ABAS = { leads: 'leads!A:Z', reunioes: 'reunioes!A:Z', negocios: 'negocios!A:AC', higiene: 'higiene!A:J' };
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
       A página separa as abas pela ordem: leads, reunioes, negocios, higiene. */
    return new Response(r.body, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=60', 'x-abas': Object.keys(ABAS).join(',') } });
  } catch (e) {
    return json({ erro: String(e.message || e) }, 500);
  }
}
