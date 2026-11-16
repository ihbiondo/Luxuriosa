# Worker Lux-Gestão antigo — excluído da Cloudflare

**Atualizado em:** 16/11/2026  
**Estado:** Worker `lux-gestao` e suas quatro rotas foram excluídos da Cloudflare em 16/11/2026. Código e documentação históricos permanecem no GitHub.

## Arquivos

- `wrangler.jsonc`
- `cloudflare/lux-gestao-worker.mjs`
- `previa/lux-gestao/index.html`
- `lux-gestao-pedidos/index.html`

O arquivo `wrangler.jsonc` ainda identifica o Worker `lux-gestao`, mas agora define:

- `workers_dev: false`
- `preview_urls: false`
- nenhuma rota de domínio personalizada

A implementação `cloudflare/lux-gestao-worker.mjs` não está mais autorizada a criar um endpoint público de preview. A configuração deste repositório não corresponde ao Worker antigo que teve deploy comprovado no repositório privado `ihbiondo/Luxuriosa-gestao`.

## Evidência do Worker ainda publicado no domínio

O último deploy localizado no GitHub foi a execução [#43559123332](https://github.com/ihbiondo/Luxuriosa-gestao/actions/runs/43559123332), feita pelo repositório privado antigo em 14/11/2026. Ela publicou o Worker `lux-gestao` com rotas antigas do domínio principal.

A alteração deste arquivo em 16/11/2026 foi apenas no GitHub. **Não foi executado novo deploy**, não alterou o Worker publicado e não removeu rotas do Cloudflare.

## Regra

Não executar `wrangler deploy` deste repositório. Não restaurar `workers_dev` ou `preview_urls` para `true`. O ambiente administrativo oficial é `https://442.luxuriosa.com.br`.

O Worker e as rotas antigas só podem ser removidos depois de validar o redirecionamento no Cloudflare e confirmar que nenhuma rotina web depende deles. O backup/migração do SQLite Tauri é uma frente independente e não bloqueia a retirada das rotas web; o código e o banco local permanecem preservados.


## Encerramento confirmado — 16/11/2026

Após conferência direta no painel Cloudflare, o usuário removeu as quatro rotas vinculadas à zona `luxuriosa.com.br`:

- `luxuriosa.com.br/lux-gestao`
- `luxuriosa.com.br/lux-gestao/*`
- `luxuriosa.com.br/lux-gestao-pedidos`
- `luxuriosa.com.br/lux-gestao-pedidos/*`

Em seguida, o usuário excluiu permanentemente o Worker `lux-gestao` pela zona de perigo do painel. A exclusão remove o Worker, suas implantações e configuração na Cloudflare. O repositório `ihbiondo/Luxuriosa-gestao` e o aplicativo desktop Tauri/SQLite permanecem preservados. Não houve alteração de DNS, do 442 ou do Supabase.

A confirmação da exclusão é baseada no relato do usuário após a ação no painel; não foi realizada consulta independente à API da Cloudflare.
