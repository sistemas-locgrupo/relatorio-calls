# Relatório de Calls · locagora (Cloudflare Pages)

Versão do Super Relatório de Calls para publicar no Cloudflare. Mesma página do claude.ai:
layout, cálculos, filtros, popup de leads, Modo TV, exportações e atualização a cada 5 minutos.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `public/index.html` | A página |
| `public/app.js`, `public/blocks.js` | Cálculos e blocos do relatório |
| `public/config.js` | Mapeamento de status (pode editar) |
| `public/runtime.js` | Busca os dados e redesenha a página |
| `public/xlsx.js`, `public/d3.min.js`, `public/fonts.css` | Excel, gráficos e fonte Manrope |
| `functions/api/dados.js` | Serviço que lê a planilha com a conta de serviço do Google |
| `functions/_middleware.js`, `lib/auth.js` | Login próprio: protege todo o site e confere a sessão |
| `functions/api/login.js`, `logout.js`, `setup.js`, `senha.js`, `usuarios.js`, `me.js` | Entrar, sair, primeiro acesso, trocar senha e gerenciar usuários |
| `public/login.html`, `public/senha.html`, `public/admin.html`, `public/auth.css`, `public/logo.png` | Telas de login, troca de senha e usuários |
| `wrangler.toml` | Configuração do projeto no Cloudflare |

## 1. Publicar

### Opção A — pelo computador (wrangler)
Precisa do Node.js instalado (nodejs.org).
```
cd relatorio-calls
npx wrangler login
npx wrangler pages deploy
```
Na primeira vez ele pergunta se quer criar o projeto `relatorio-calls`: responda que sim.

### Opção B — pelo GitHub
1. Crie um repositório (privado) e suba o conteúdo desta pasta.
2. No Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**, escolha o repositório.
3. Build command: deixe vazio. Build output directory: `public`.

> O upload de arrastar-e-soltar do Cloudflare não serve aqui, porque ele não publica a pasta `functions`.

## 2. Cadastrar os segredos
No projeto: **Settings → Variables and secrets → Add** (tipo *Secret*), em **Production**:

| Nome | Valor |
|---|---|
| `GOOGLE_SA_EMAIL` | e-mail da conta de serviço (`...@lochub-514512.iam.gserviceaccount.com`) |
| `GOOGLE_SA_KEY` | o valor de `private_key` do arquivo JSON, do `-----BEGIN PRIVATE KEY-----` até o `-----END PRIVATE KEY-----` |
| `SHEET_ID` | `1_wLbvvs6FK5OxlLIidblyNZZLvbZuIvJ4-m8SLsaWm0` |

Depois de salvar, publique de novo (Opção A: `npx wrangler pages deploy`; Opção B: **Deployments → Retry deployment**).

## 3. Login próprio (e-mail e senha)
Os usuários ficam guardados no **KV** do Cloudflare, com as senhas criptografadas (PBKDF2 + sal).
1. Crie o KV uma vez: `npx wrangler kv namespace create USUARIOS`. Se perguntar se quer que o Wrangler adicione sozinho, responda **N**.
2. Copie o `id` que aparecer e cole no `wrangler.toml`, no lugar de `COLE_AQUI_O_ID`.
3. Publique: `npx wrangler pages deploy`.
4. Abra o site: como ainda não há ninguém, aparece **Criar primeiro acesso**. Crie o seu (precisa ser @locgrupo.com.br); ele vira administrador.
5. No menu com seu nome (canto direito do cabeçalho) → **Gerenciar usuários**: adicione o time. O sistema gera uma senha provisória; no primeiro acesso a pessoa cria a dela.

Segurança: sessão em cookie assinado (12 h, ou 30 dias com "Manter conectado"), bloqueio de 15 min após 5 senhas erradas,
remover alguém ou redefinir a senha derruba as sessões dela em até 1 minuto.

## 4. Pronto
Abra `https://relatorio-calls.pages.dev`, entre com e-mail e senha e o relatório carrega.
Na TV: abra o endereço, entre uma vez com **Manter conectado** marcado e clique em **Modo TV** num ranking.

Endereço próprio (opcional): **Custom domains** no projeto, por exemplo `relatorio.locgrupo.com.br`.

## Se algo der errado
| Mensagem no topo da página | O que fazer |
|---|---|
| Falta ligar o KV "USUARIOS" | Faça os itens 1 e 2 do passo 3 e publique de novo |
| Faltam os segredos… | Cadastre os segredos do passo 2 e publique de novo |
| O Google recusou a conta de serviço | Confira se o `GOOGLE_SA_KEY` foi colado inteiro, com as linhas BEGIN/END |
| A conta de serviço não tem acesso à planilha | Compartilhe a planilha com o e-mail da conta como Leitor |

## Importante
- Nunca suba o arquivo `.json` da chave para o GitHub nem coloque a chave dentro do código: ela fica só nos segredos do Cloudflare.
- Esta é uma cópia do relatório do claude.ai. Mudanças feitas lá não chegam aqui sozinhas: gere o pacote de novo e publique.
