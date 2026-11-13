# Arquitetura modular — Educação Luxuriosa

**Versão:** 1.0  
**Data:** 13 de novembro de 2026  
**Escopo:** cinco módulos editoriais, uma camada técnica compartilhada.

## Princípio de arquitetura

A Educação Luxuriosa permanece em HTML estático, CSS compartilhado e JavaScript pequeno, sem framework, banco de dados, conta obrigatória, imagens ou dependências externas. Cada página deve continuar legível e indexável sem depender de uma aplicação complexa.

## Os cinco módulos

| Módulo | Diretório | Responsabilidade |
|---|---|---|
| 1. Temas educativos | `educacao/temas/` | Fundamentos de corpo, saúde, prevenção, reprodução, direitos e relações |
| 2. Enciclopédia | `educacao/enciclopedia/` | Definições técnicas, categorias, materiais, funções e limites de produtos |
| 3. Curiosidades | `educacao/curiosidades/` | Mitos e fatos, contexto histórico e explicações curtas sustentadas por fontes |
| 4. Guias | `educacao/guias/` | Orientações práticas, sequências de cuidado e acesso a serviços |
| 5. Interatividade | `educacao/interatividade/` | Quizzes e ferramentas educativas executadas no navegador, sem transmissão de respostas |

## Camada técnica compartilhada

- `css/educacao.css`: tokens visuais, layout responsivo, tipografia, estados de foco e componentes comuns.
- `js/educacao.js`: menu uniforme de cinco módulos, indicação da seção atual, link para pular ao conteúdo e declaração de idade.
- `scripts/validar_educacao.py`: verificação local de estrutura HTML, metadados, links, sitemap, fontes relacionadas e ausência de mídia visual.
- `docs/PROJETO-EDUCACAO-LUXURIOSA.md`: princípios editoriais, fontes, privacidade e fila de revisão.

## Contrato obrigatório de cada página

1. Um único `h1`, título próprio, descrição e canonical.
2. Navegação comum e retorno claro à seção correspondente.
3. Artigos devem indicar fontes e leituras relacionadas.
4. Informações clínicas devem distinguir orientação geral de atendimento individual e destacar urgências.
5. Nenhuma imagem, vídeo, apelo comercial, anúncio ou linguagem erotizada.
6. Ferramentas interativas não devem diagnosticar nem enviar ou armazenar respostas.

## Declaração de idade

As páginas educativas usam a mesma chave local `lux18` do controle de idade já existente na página inicial. Um pequeno script síncrono no início do `head` marca a página como pendente quando não há confirmação, e o CSS oculta o conteúdo até o diálogo ser apresentado; isso evita um flash de conteúdo durante o carregamento do JavaScript. A confirmação é uma autodeclaração de 18 anos ou mais; **não é verificação documental nem mecanismo de segurança inviolável**. Se o armazenamento local estiver indisponível, a confirmação vale somente para a página aberta. Sem JavaScript, a declaração não pode ser solicitada, portanto o mecanismo não deve ser tratado como controle de segurança inviolável.

## Fluxo de manutenção

- Novo assunto deve entrar em um dos cinco módulos existentes; não criar um sexto módulo sem decisão editorial.
- Reaproveitar artigos e links existentes antes de criar uma nova URL.
- Rodar `python scripts/validar_educacao.py` antes de publicar.
- Atualizar sitemap e documentação na mesma alteração de conteúdo.
- Mudanças clínicas, jurídicas ou de serviços exigem conferência da fonte primária e data de revisão.

## Limites intencionais

Não há CMS, analytics novo, anúncios, perfis de usuário, histórico de respostas, personalização baseada em dados íntimos ou mídia pesada. A complexidade deve ficar na organização e na qualidade do conteúdo, não no peso da aplicação.
