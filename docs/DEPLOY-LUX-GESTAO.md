# Publicação do Lux-Gestão

O Worker de produção é publicado a partir de `cloudflare/lux-gestao-worker.mjs`, usando `wrangler.jsonc`.

## Configuração inicial (uma única vez)

No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret** e cadastre:

- `CLOUDFLARE_API_TOKEN`: token da Cloudflare com permissão de edição de Workers Scripts na conta correta.
- `CLOUDFLARE_ACCOUNT_ID`: ID da conta Cloudflare onde existe o Worker `lux-gestao`.

Não coloque esses valores em arquivos, commits, issues ou mensagens.

Depois de cadastrar os dois secrets, execute **Actions → Deploy Lux-Gestão Worker → Run workflow** ou faça merge da alteração que dispara o deploy.

## Publicação contínua

Após a configuração inicial, alterações em `cloudflare/lux-gestao-worker.mjs`, `wrangler.jsonc` ou neste workflow na branch `main` publicam o Worker automaticamente.

## Cuidados

- O nome do Worker permanece `lux-gestao`.
- A configuração não declara nem altera rotas do domínio; as rotas existentes continuam administradas no painel Cloudflare.
- `keep_vars: true` preserva variáveis já configuradas no Worker.
- O Worker busca a aplicação publicada em `/previa/lux-gestao/`.
- Não execute o deploy antes de confirmar que os dois secrets apontam para a conta que contém o Worker correto.
