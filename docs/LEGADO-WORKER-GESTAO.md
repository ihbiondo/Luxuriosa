# Worker Lux-Gestão antigo — encerrado

**Atualizado em:** 16/11/2026  
**Estado:** Worker `lux-gestao` e suas quatro rotas foram removidos da Cloudflare em 16/11/2026. Os artefatos de implantação residual deste repositório também foram removidos. Este documento preserva o histórico.

## Histórico da implantação

O último deploy localizado no GitHub foi a execução [#43559123332](https://github.com/ihbiondo/Luxuriosa-gestao/actions/runs/43559123332), realizada pelo repositório privado antigo em 14/11/2026. Ela publicou o Worker `lux-gestao` com rotas antigas no domínio principal.

O arquivo `wrangler.jsonc` e a implementação `cloudflare/lux-gestao-worker.mjs` que existiam neste repositório eram resíduos versionados. A configuração estava com `workers_dev: false` e `preview_urls: false`, sem rota personalizada, e não correspondia ao Worker cujo deploy foi comprovado no repositório privado `ihbiondo/Luxuriosa-gestao`. Esses dois arquivos foram removidos do código ativo em 16/11/2026 para evitar uma implantação acidental.

## Encerramento confirmado — 16/11/2026

Após conferência direta no painel Cloudflare, o usuário removeu as quatro rotas vinculadas à zona `luxuriosa.com.br`:

- `luxuriosa.com.br/lux-gestao`
- `luxuriosa.com.br/lux-gestao/*`
- `luxuriosa.com.br/lux-gestao-pedidos`
- `luxuriosa.com.br/lux-gestao-pedidos/*`

Em seguida, excluiu permanentemente o Worker `lux-gestao` pela zona de perigo do painel. A exclusão removeu o Worker, suas implantações e configuração na Cloudflare.

## O que permanece preservado

- O repositório privado `ihbiondo/Luxuriosa-gestao`, que também contém o aplicativo desktop Tauri.
- O código-fonte e o banco SQLite local do aplicativo desktop.
- Os arquivos históricos da aplicação administrativa que ainda estejam versionados neste repositório.

A retirada do Worker web não significa desativação ou exclusão do aplicativo desktop. Não houve alteração de DNS, do 442 ou do Supabase nesta operação.

**Nota de evidência:** a confirmação da exclusão do Worker e das rotas é baseada no relato do usuário após a ação no painel Cloudflare; não foi realizada consulta independente à API da Cloudflare.

## Regra operacional

O ambiente administrativo web oficial é `https://442.luxuriosa.com.br`. Não restaurar nem implantar o Worker antigo. Qualquer futura reativação exigirá uma decisão explícita e uma arquitetura própria, sem reutilizar rotas legadas.
