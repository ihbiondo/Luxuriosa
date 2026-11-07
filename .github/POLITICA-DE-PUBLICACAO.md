# Política de publicação e proteção de funcionalidades — Luxuriosa

**Status:** vigente  
**Ambiente público:** branch `main` (GitHub Pages)  
**Arquivo de referência para projetos futuros:** branch `arquivo-futuro-clube-biblioteca`

## Objetivo

O site público deve apresentar somente páginas, ofertas e funcionalidades que estejam prontas, verificadas e disponíveis para o cliente. Ideias, protótipos, páginas em construção e recursos ainda sem operação não devem ser publicados no ambiente comercial.

## Estados de uma funcionalidade

| Estado | Regra |
|---|---|
| Planejada | Não publicar no site. Manter documentação e materiais em branch de trabalho. |
| Em desenvolvimento | Trabalhar em branch separada; não integrar à branch publicada. |
| Em validação | Testar em ambiente de prévia, sem links públicos ou indexação. |
| Pronta para publicação | Revisar conteúdo, navegação, acessibilidade, privacidade, funcionamento em celular e links; só então integrar à `main`. |
| Publicada | Manter monitoramento e corrigir falhas. |
| Descontinuada | Remover links e páginas públicas; atualizar sitemap e referências. |

## Regras obrigatórias

1. A branch `main` contém apenas a versão aprovada para publicação.
2. Novas páginas e recursos futuros devem ser desenvolvidos em branches próprias.
3. Não considerar `noindex`, `nofollow`, CSS, JavaScript ou a ausência de links como controle de acesso. Essas medidas não impedem que alguém abra uma URL pública diretamente.
4. No GitHub Pages estático, não há autenticação ou autorização real por página. Se uma página não pode ser vista pelo público, ela não deve estar presente no conteúdo publicado.
5. Não publicar páginas de cadastro, login, assinatura, área de membros ou biblioteca privada sem que a operação correspondente exista e tenha sido testada.
6. Não exibir botões, links, chamadas, preços, benefícios ou promessas que ainda não possam ser cumpridos.
7. Toda remoção de página pública deve considerar links internos, sitemap, metadados, páginas de produto e mecanismos de busca.
8. Não remover nem alterar funcionalidades comerciais ativas sem necessidade comprovada e revisão do impacto.

## Arquivamento atual

O Clube Luxuriosa e a Biblioteca Luxuriosa são projetos futuros. Seus arquivos foram preservados na branch `arquivo-futuro-clube-biblioteca` e retirados da branch pública `main`, junto com suas folhas de estilo exclusivas.

As páginas não devem ser consideradas produtos disponíveis, áreas de membros ou serviços ativos. O conteúdo poderá ser retomado futuramente, revisado e publicado somente após definição e implementação das funcionalidades.

## Checklist antes de publicar

- [ ] A funcionalidade existe e funciona de ponta a ponta.
- [ ] O conteúdo e as condições comerciais estão definidos e podem ser cumpridos.
- [ ] Todos os links e botões levam a destinos funcionais.
- [ ] A experiência foi verificada em desktop e celular.
- [ ] Privacidade, consentimento e tratamento de dados foram revisados.
- [ ] Páginas públicas, sitemap e metadados estão coerentes.
- [ ] Não há links para protótipos, páginas privadas ou recursos inacabados.
- [ ] A publicação foi revisada na versão de prévia antes de integrar à `main`.

## Observação técnica

A remoção dos arquivos da branch publicada faz com que as URLs antigas deixem de servir essas páginas após a atualização do GitHub Pages. O GitHub Pages pode levar alguns minutos para concluir a publicação. A remoção do conteúdo da branch pública não apaga o histórico Git nem impede que o material seja consultado por quem tem acesso ao repositório; ela impede que essas páginas façam parte do site publicado.
