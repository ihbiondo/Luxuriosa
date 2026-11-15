# Auditoria cruzada — Educação Luxuriosa

**Data:** 15/11/2026  
**Branch:** `content/auditoria-editorial-fase-1`  
**PR:** [#132](https://github.com/ihbiondo/Luxuriosa/pull/132)  
**Status:** auditoria interna dos 12 rascunhos; não publicada; sem revisão profissional externa.

## 1. Escopo e método

Nesta rodada foram lidos integralmente os 12 arquivos de módulos em `docs/educacao/modulos/`, conferidos contra a matriz editorial dos 120 equivalentes de páginas e examinados os pontos de sobreposição, segurança, encaminhamento e atualização normativa. A matriz dos 23 artigos públicos foi usada para verificar a arquitetura e as intenções editoriais; esta rodada não equivale a uma revisão clínica linha a linha de todos os 23 artigos.

A auditoria considera:
- consistência de conceitos e terminologia entre módulos;
- repetição necessária versus duplicação que prejudica a navegação;
- sinais de alerta e encaminhamentos;
- atualidade de referências clínicas e legais;
- separação entre informação educativa e conteúdo comercial;
- clareza sobre limites, incertezas e ausência de revisão profissional.

**Estado dos 12 módulos:** todos existem como rascunhos internos v0.1. Nenhum está publicado ou clinicamente, psicossocialmente, juridicamente ou tecnicamente validado por revisão profissional externa.

## 2. Achados prioritários

### P1 — Atualizar a seção legal do Módulo 6

**Arquivo:** `docs/educacao/modulos/06-consentimento-limites-seguranca.md`, seção “Atendimento e direitos no Brasil”.

A seção explicava corretamente que o atendimento de saúde não depende de BO pessoal, mas citava somente a Lei nº 12.845/2013 e não mencionava a alteração trazida pela Lei nº 15.516/2026. Isso cria uma diferença relevante em relação ao Módulo 11 e pode deixar incompleta a explicação sobre comunicação institucional obrigatória.

**Correção realizada nesta etapa:** incluir a atualização de 2026, explicitar que a comunicação à autoridade policial em até 24 horas é obrigação institucional do serviço nos casos previstos em lei e distinguir essa obrigação da apresentação de BO pela pessoa atendida. Acrescentada referência à publicação legal. A redação continua condicionada à revisão jurídica especializada.

Fonte primária: [Lei nº 15.516/2026 — LexML, texto da norma](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2026-09-22%3B15516).

### P1 — Rastreabilidade das afirmações clínicas

**Escopo:** módulos 1 a 5 e 8 a 10 e 12, com atenção especial aos módulos 3, 4, 5, 8, 9 e 10.

Os módulos apresentam referências ao final, mas a presença de uma bibliografia não demonstra, por si só, que cada afirmação clínica importante está sustentada pela fonte citada. Antes da publicação, cada afirmação sobre eficácia, janela diagnóstica, prazo, contraindicação, sintoma, urgência, material ou compatibilidade precisa ser associada à fonte específica que a sustenta.

**Ação necessária:** revisão afirmação por afirmação, com link, instituição/autoria, título, versão/data, data de consulta e localização do trecho relevante. Se a fonte não sustentar a afirmação, reescrever, qualificar ou remover. Não inventar estatísticas, recomendações ou referências.

### P1 — Revisão jurídica do Módulo 11 e do guia público

**Arquivos:** `docs/educacao/modulos/11-violencia-sexual-apoio-direitos.md` e `educacao/guias/violencia-sexual-onde-buscar-ajuda.html`.

O Módulo 11 diferencia a assistência em saúde da comunicação institucional prevista na Lei nº 15.516/2026 e delimita a referência ao Conselho Tutelar ao contexto descrito no dispositivo legal. A direção está alinhada ao texto normativo consultado, mas o tema envolve direitos, deveres institucionais, sigilo, proteção de crianças e adolescentes e fluxos de atendimento.

**Ação necessária:** revisão jurídica especializada da redação integral, inclusive da relação entre Lei nº 12.845/2013, Lei nº 15.516/2026, ECA e demais deveres de notificação/comunicação. A checagem automatizada não valida interpretação jurídica.

Fonte primária: [Lei nº 15.516/2026 — texto integral](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2026-09-22%3B15516).

## 3. Auditoria estrutural dos 23 artigos públicos

A leitura estrutural dos 23 artigos mapeados identificou dois problemas transversais de apresentação:

### P2 — Navegação com nomenclatura antiga

**Escopo:** os 23 artigos em temas, guias, enciclopédia e curiosidades.

O menu apresentava o texto “Explorar módulos” e o rótulo acessível “Navegação dos cinco módulos”, apesar de a navegação reunir cinco seções da biblioteca (Temas, Enciclopédia, Curiosidades, Guias e Interatividade), não cinco módulos editoriais.

**Correção realizada:** em todos os 23 artigos, o menu agora usa “Explorar a biblioteca” e o rótulo acessível “Navegação da biblioteca”. URLs, destinos, conteúdo educativo, canonical e metadados de indexação foram preservados.

### P2 — Marcadores internos de auditoria no HTML

**Escopo:** sete artigos: saúde sexual e bem-estar, consentimento e limites, prevenção de IST, contracepção, corpo humano e ciclo menstrual, prevenção combinada e segurança digital e privacidade.

Havia parágrafos ocultos com a classe `ed-expansion-marker` e o texto “A auditoria editorial ampliada”. Embora estivessem marcados como ocultos, eram resíduos de processo editorial no HTML.

**Correção realizada:** removidos os marcadores internos das sete páginas em que estavam presentes. O conteúdo educativo visível não foi alterado por essa remoção.

### Limite desta revisão dos 23 artigos

Foi feita uma leitura estrutural dos 23 arquivos (títulos, H1, headings, navegação, datas de atualização, estrutura de fontes, avisos e principais termos de risco), além da correção transversal descrita acima. Isso não equivale a uma revisão clínica ou jurídica linha a linha de todo o conteúdo. Permanecem obrigatórias as checagens individuais das afirmações clínicas e legais, dos links de referência e da acessibilidade.

### Observações de consistência para a próxima rodada

- Preservar a diferença entre páginas-pilar e guias práticos; não fundir páginas apenas por compartilharem palavras-chave.
- Manter alertas de urgência curtos nos artigos que tratam de exposição ao HIV, violência sexual e possíveis lesões, com aprofundamento no guia ou módulo de referência.
- Conferir os links oficiais individualmente, pois uma URL existente no HTML não prova que o destino continua válido ou que sustenta a afirmação associada.
- Conferir se a data visível de atualização corresponde à alteração substantiva mais recente; não atualizar datas apenas por ajustes cosméticos.
- Conferir autoria institucional e dados estruturados para que não sugiram revisão clínica ou autoria profissional inexistente.

## 4. Achados de consistência e arquitetura

### P2 — Mapa do Módulo 12 estava incompleto

**Arquivo:** `docs/educacao/modulos/12-mitos-duvidas-e-caminhos-para-atendimento.md`, seção “Mapa de leitura”.

O mapa listava os módulos 1 a 11, omitia o próprio Módulo 12 e dizia que alguns módulos ainda estavam em elaboração. Os doze rascunhos já existem.

**Correção realizada nesta etapa:** incluir o Módulo 12 no mapa e esclarecer que os doze arquivos são rascunhos internos, não páginas públicas nem conteúdo clinicamente revisado.

### P2 — Repetições que devem ser mantidas com links, não copiadas em blocos extensos

Há temas transversais que aparecem em mais de um módulo. A repetição curta é justificável quando protege o leitor; o aprofundamento deve permanecer no módulo de referência.

| Tema | Módulo de referência | Onde aparece também | Diretriz |
|---|---|---|---|
| Consentimento, autonomia e respostas fisiológicas | 6 | 1, 7, 8 e 12 | Manter lembretes curtos; aprofundar consentimento no 6. |
| Ciclo, fertilidade e contracepção de emergência | 3 e 4 | 12 | Manter perguntas-resumo no 12 com remissão aos capítulos. |
| IST, HIV, PrEP e PEP | 5 | 1, 4, 11 e 12 | Preservar alertas urgentes; centralizar protocolos e detalhes no 5. |
| Violência sexual e acesso ao atendimento | 11 | 6, 7 e 12 | Manter orientação de segurança essencial; centralizar lei, serviços e canais no 11. |
| Higiene, lubrificantes e acessórios | 9 e 10 | 5, 8 e 12 | Separar higiene corporal, resposta sexual e segurança dos dispositivos. |

### P2 — Política de diagramas anatômicos permanece pendente

O Módulo 2 é textual e a regra atual do validador reprova elementos de mídia em páginas educativas. Diagramas didáticos podem melhorar a compreensão anatômica, mas não devem ser adicionados antes de uma decisão editorial sobre acessibilidade, texto alternativo, fonte, direitos de uso e revisão técnica. Não alterar o validador sem política aprovada.

### P2 — Escopo de revisão dos artigos públicos

A matriz mapeia 23 artigos e preserva suas URLs. Oito artigos foram revisados para reduzir repetição nesta PR. Ainda falta uma revisão individual dos 23 textos, incluindo atualização de fontes, afirmações clínicas, links, intenção de busca, acessibilidade e metadados. A matriz não substitui essa leitura.

## 5. Verificação pontual de orientações de urgência

- **PEP para HIV:** o Ministério da Saúde informa início o mais rápido possível, preferencialmente nas primeiras duas horas e no máximo em 72 horas; quando indicada, a profilaxia dura 28 dias. Os módulos 5 e 11 devem manter o alerta para procurar atendimento imediatamente, sem transformar o texto em prescrição. Fonte: [Ministério da Saúde — Prevenção](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/prevencao).
- **Contracepção de emergência:** a Nota Técnica nº 2/2025 do Ministério da Saúde orienta acesso em até 120 horas e indica levonorgestrel oral ou DIU de cobre como opções disponíveis no SUS. A adequação depende da avaliação e do método. Fonte: [Nota Técnica nº 2/2025 — Ministério da Saúde](https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2025/nota-tecnica-no-2-2025-cosaj-cgcriaj-dgci-saps-ms/%40%40download/file).
- **Lei nº 15.516/2026:** o texto legal prevê comunicação obrigatória à autoridade policial, em até 24 horas, dos casos com indícios ou confirmação de violência sexual, e contém regra específica sobre Conselho Tutelar no contexto descrito na própria lei. O texto do Módulo 11 foi delimitado nesse ponto; a revisão jurídica especializada continua pendente. Fonte: [Lei nº 15.516/2026](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2026-09-22%3B15516).

## 6. Separação editorial e publicidade

- Conteúdo educativo não deve inserir chamadas de compra no meio de recomendações clínicas.
- Enciclopédia de acessórios deve ser informativa, sem transformar descrição comercial em recomendação médica.
- Loja, checkout, páginas de produto e páginas operacionais permanecem fora da estratégia de anúncios.
- Conteúdo sobre acessórios, lubrificantes e práticas íntimas pode sofrer restrições de publicidade. Não prometer aprovação ou monetização.
- A revisão de elegibilidade para anúncios é separada da revisão de qualidade editorial, clínica e jurídica.

## 7. Validação automatizada

A execução do workflow **Validate Education and Experiences**, run nº 18, associada ao commit `de0c6cc17bf19ee132109728f4125408fb5a6e1c`, terminou com conclusão `success`.

Isso confirma somente que as verificações automatizadas configuradas passaram naquele commit. Não comprova precisão clínica, validade jurídica, revisão profissional, elegibilidade para anúncios ou aprovação para publicação. As alterações desta atualização ainda precisam gerar nova execução do workflow.

## 8. Pendências obrigatórias antes de publicação

1. Revisão clínica por profissionais habilitados dos módulos 1 a 5 e 8 a 10 e 12.
2. Revisão psicossocial dos módulos 6, 7 e 11.
3. Revisão jurídica do Módulo 11, do guia público de violência sexual e dos trechos legais do Módulo 6.
4. Revisão técnica de materiais, compatibilidade, limpeza e dispositivos do Módulo 10.
5. Rastreabilidade de cada afirmação clínica importante até a fonte específica que a sustenta.
6. Revisão individual dos 23 artigos públicos mapeados.
7. Decisão formal sobre diagramas anatômicos e atualização correspondente do validador, se aprovada.
8. Nova execução do GitHub Actions após os commits desta auditoria.
9. Revisão de acessibilidade, navegação, links, metadados, sitemap e políticas de publicidade por URL.
10. Aprovação editorial expressa antes de qualquer merge ou publicação.

## 9. Decisão

Os 12 módulos formam uma arquitetura coerente para a biblioteca e têm separação temática razoável. As repetições identificadas são, em geral, úteis como alertas breves, desde que os aprofundamentos permaneçam nos capítulos de referência e os links internos sejam inseridos apenas quando as páginas estiverem efetivamente revisadas e publicadas.

**A auditoria não considera os módulos prontos para publicação.** A PR #132 deve permanecer aberta e em rascunho. Nenhuma alteração desta etapa autoriza merge, deploy ou publicação em produção.
