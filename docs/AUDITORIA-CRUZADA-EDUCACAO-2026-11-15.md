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

**Escopo:** os 30 arquivos HTML da Educação verificados pelo validador (23 artigos e sete páginas de índice/política).

O menu apresentava o texto “Explorar módulos” e o rótulo acessível “Navegação dos cinco módulos”, apesar de a navegação reunir cinco seções da biblioteca (Temas, Enciclopédia, Curiosidades, Guias e Interatividade), não cinco módulos editoriais.

**Correção realizada:** nos 30 arquivos HTML, o menu agora usa “Explorar a biblioteca” e o rótulo acessível “Navegação da biblioteca”. URLs, destinos, conteúdo educativo, canonical e metadados de indexação foram preservados.

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

A execução mais recente concluída com sucesso nesta etapa foi o workflow **Validate Education and Experiences**, run nº 38, associada ao commit `a8be8f6b17b17f26e70908f3dd169d77cbe015b2`. Passaram as etapas de validação das 30 páginas HTML e links locais, sintaxe JavaScript e dados estruturados/XML do sitemap.

As primeiras execuções após a mudança do texto do menu falharam porque o próprio validador ainda exigia a nomenclatura antiga. O script `scripts/validar_educacao.py` foi atualizado para reconhecer “Explorar a biblioteca”; a execução nº 38 passou depois da correção. O commit posterior `918cb8b77cb26dbb9c6b8ef2fe675da4b20e2d01` alterou apenas este documento de auditoria.

Isso confirma somente que as verificações automatizadas configuradas passaram no commit validado. Não comprova precisão clínica, validade jurídica, revisão profissional, elegibilidade para anúncios ou aprovação para publicação.

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

## 9. Revisão jurídica e clínica pontual — 15/11/2026

### P1 — Comunicação policial e sigilo: separar obrigações distintas

**Arquivos:** `docs/educacao/modulos/11-violencia-sexual-apoio-direitos.md`, `docs/educacao/modulos/06-consentimento-limites-seguranca.md` e `educacao/guias/violencia-sexual-onde-buscar-ajuda.html`.

**Verificado em fonte primária:** a Lei nº 15.516/2026 acrescentou ao art. 3º da Lei nº 12.845/2013 a comunicação obrigatória à autoridade policial, em até 24 horas, dos casos com indícios ou confirmação de violência sexual. A mesma lei também prevê encaminhamento imediato à unidade pública de saúde e registro da ocorrência quando o primeiro atendimento for feito por profissional de segurança pública. O texto legal não transforma a apresentação de BO pessoal em requisito para o atendimento de saúde.

**Nuance jurídica obrigatória:** o art. 3º do projeto que determinaria o encaminhamento do laudo médico à autoridade competente foi vetado. As razões do veto mencionam intimidade, vida privada, sigilo profissional e proteção de dados. Portanto, os textos não devem sugerir que a comunicação policial equivale ao envio automático do laudo ou do prontuário integral. A forma, o conteúdo e o tratamento dos dados da comunicação exigem confirmação jurídica especializada; não presumir anonimização nem divulgação integral.

**Risco de fonte secundária desatualizada:** a página do Ministério da Saúde intitulada “Violência sexual” ainda descreve a notificação em 24 horas como comunicação à autoridade de saúde e afirma que ela não é encaminhada à segurança pública. Essa explicação não incorpora a alteração posterior da Lei nº 15.516/2026. A página continua útil para orientações assistenciais e para a informação de que não é necessário BO para acessar o cuidado, mas não deve ser usada isoladamente para explicar o fluxo legal atual de comunicação policial.

**Contexto local:** o Protocolo de Atendimento à Vítima de Violência Sexual de Bauru disponível é a versão 2025, anterior à Lei nº 15.516/2026. Serve como referência de rede e fluxo municipal, mas não confirma como o município implementou a nova obrigação federal. Não publicar contatos/fluxos locais sem confirmação atualizada.

**Status:** a redação atual dos módulos 6 e 11 e do guia público distingue BO pessoal de comunicação institucional. Não foi identificada, nesta leitura, afirmação explícita de que o laudo completo é enviado automaticamente. Manter a distinção e acrescentar, na próxima revisão editorial, uma nota curta de que a comunicação legal não deve ser confundida com remessa automática do prontuário/laudo integral. Exigir revisão jurídica especializada antes de publicar.

Fontes:
- [Lei nº 15.516/2026 — texto legal](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2026-09-22%3B15516).
- [Lei nº 15.516/2026 — veto parcial e razões do veto](https://www2.camara.leg.br/legin/fed/lei/2026/lei-15516-22-setembro-2026-800011-veto-181457-pl.html).
- [Ministério da Saúde — Violência sexual](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/saude-sexual-e-reprodutiva/violencia-sexual).
- [Prefeitura de Bauru — Protocolo de Atendimento à Vítima de Violência Sexual, versão 2025](https://www2.bauru.sp.gov.br/arquivos/arquivos_site/sec_saude/protocolos_saude/Atendimento_%C3%A0_V%C3%ADtima_de_Viol%C3%AAncia_Sexual/Protocolo%20de%20Atendimento%20%C3%A0%20v%C3%ADtima%20de%20Viol%C3%AAncia%20Sexual%202025.pdf).

### P1 — Janela da PEP e contracepção de emergência

**Arquivos:** módulos 4, 5 e 11; guia público de violência sexual; páginas públicas de prevenção de IST e prevenção combinada.

- **PEP-HIV:** fonte atual do Ministério da Saúde confirma início o mais rápido possível, preferencialmente nas primeiras duas horas e no máximo em 72 horas; duração de 28 dias quando indicada. A redação dos módulos 5 e 11 está alinhada. Não converter o prazo em prescrição nem sugerir que a pessoa avalie sozinha a indicação.
- **Hepatite B:** a página atual do Ministério da Saúde informa atendimento inicial preferencialmente até 24 horas, com possibilidade de avaliação até 14 dias em determinadas situações, conforme histórico vacinal e indicação. Os textos corretamente distinguem esse intervalo da janela da PEP-HIV; manter a busca imediata.
- **Contracepção de emergência:** a Nota Técnica nº 2/2025 do Ministério da Saúde recomenda acesso até 120 horas (cinco dias), o mais cedo possível, e descreve levonorgestrel 1,5 mg em dose única ou DIU de cobre. A indicação depende do método e de avaliação. O módulo 4 e o artigo público distinguem corretamente contracepção de emergência de PEP-HIV; manter a ressalva de que a eficácia varia conforme o método e o tempo.

Fontes:
- [Ministério da Saúde — PEP](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/pep).
- [Ministério da Saúde — Prevenção, incluindo início preferencial da PEP nas primeiras duas horas](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/prevencao).
- [Nota Técnica nº 2/2025 — Ministério da Saúde](https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2025/nota-tecnica-no-2-2025-cosaj-cgcriaj-dgci-saps-ms).
- [Ministério da Saúde — DIU de cobre e uso como contracepção de emergência](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/saude-sexual-e-reprodutiva/contracepcao/diu-de-cobre/diu-de-cobre).

### P2 — Consentimento e limites: evitar transformar princípios educativos em definição jurídica universal

**Arquivo:** `docs/educacao/modulos/06-consentimento-limites-seguranca.md`.

A formulação de consentimento livre, informado, específico, contínuo e revogável é útil como estrutura educativa. Capacidade, idade, vulnerabilidade, intoxicação e validade jurídica da manifestação dependem do contexto e da legislação aplicável. O módulo já contém ressalvas; mantê-las e evitar apresentar a lista como transcrição literal de uma definição legal brasileira única. Revisão jurídica permanece pendente.

## 10. Revisão de contracepção e ciclo menstrual — 15/11/2026

### P1 — Contracepção de emergência: reforçar fonte oficial brasileira

**Arquivos:** `educacao/temas/contracepcao.html` e `docs/educacao/modulos/04-contracepcao-planejamento-reprodutivo.md`.

A Nota Técnica nº 2/2025 do Ministério da Saúde confirma que a contracepção de emergência deve ser disponibilizada em até 120 horas (cinco dias) após relação desprotegida ou violência sexual, idealmente no menor intervalo possível, e descreve as opções ofertadas no SUS: levonorgestrel 1,5 mg em dose única ou DIU de cobre. O artigo público já apresentava a janela de cinco dias, mas citava a OMS sem associar a orientação à nota técnica nacional.

**Correção realizada na PR:** acrescentada a Nota Técnica nº 2/2025 às referências do artigo público; removida uma referência duplicada à OMS. O texto mantém a ressalva de que a escolha e a indicação dependem do método e da avaliação em saúde. O módulo 4 já descrevia a orientação brasileira e não precisou de alteração nesta rodada.

**Limite:** não generalizar a mesma eficácia ao longo de toda a janela de 120 horas; a orientação é procurar o serviço o quanto antes. Não confundir contracepção de emergência com PEP-HIV.

Fonte primária: [Ministério da Saúde — Nota Técnica nº 2/2025](https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2025/nota-tecnica-no-2-2025-cosaj-cgcriaj-dgci-saps-ms).

### P2 — Critérios legais de esterilização voluntária estavam ausentes do artigo público

**Arquivo:** `educacao/temas/contracepcao.html`.

O artigo mencionava laqueadura e vasectomia, mas não apresentava os critérios legais básicos. O módulo 4 já trazia resumo da Lei nº 14.443/2022. A lei estabelece capacidade civil plena e idade superior a 21 anos ou pelo menos dois filhos vivos, prazo mínimo de 60 dias entre manifestação de vontade e cirurgia, e revogou a exigência de consentimento do cônjuge. Também prevê esterilização durante o período do parto, observados prazo de 60 dias entre manifestação de vontade e parto e condições médicas.

**Correção realizada na PR:** incluída seção informativa curta no artigo público, com ressalva de que o texto não substitui legislação ou orientação do serviço; adicionada referência ao texto atualizado da Lei nº 14.443/2022. A redação evita transformar o resumo em avaliação de elegibilidade individual.

Fontes:
- [Lei nº 14.443/2022 — texto atual](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2022-09-02%3B14443).
- [Ministério da Saúde — orientações sobre laqueadura e vasectomia no SUS](https://www.gov.br/saude/pt-br/assuntos/noticias/2023/junho/ministerio-da-saude-orienta-gestores-sobre-laqueadura-e-vasectomia-no-sus).

### P2 — Ciclo menstrual: limites das estimativas estão adequadamente explicitados

**Arquivos:** `educacao/temas/corpo-humano-e-ciclo-menstrual.html` e `docs/educacao/modulos/03-ciclo-menstrual-fertilidade-reproducao.md`.

A página pública e o módulo distinguem menstruação, ciclo e ovulação; evitam tratar 28 dias ou o 14º dia como regra; explicam que a janela fértil e aplicativos/calendários não confirmam a ovulação nem garantem contracepção. A faixa de 21 a 35 dias é apresentada como referência geral para adultos, com ressalvas sobre idade, amamentação, condições clínicas e hormônios no módulo.

**Resultado:** nenhuma correção substantiva identificada nesta leitura pontual. Antes da publicação, ainda é necessário validar individualmente a referência citada para a faixa de duração e a linguagem sobre variações por idade e estágio reprodutivo. Esta checagem não substitui revisão ginecológica.

### Escopo desta rodada

Foram examinados o artigo público de contracepção, o artigo de ciclo menstrual, os módulos internos 3 e 4 e as referências oficiais brasileiras sobre contracepção de emergência, DIU de cobre e esterilização voluntária. Não é uma revisão clínica integral dos 23 artigos. Nenhuma alteração foi feita em produção; as correções estão apenas na branch da PR #132.

## 11. Decisão

Os 12 módulos formam uma arquitetura coerente para a biblioteca e têm separação temática razoável. As repetições identificadas são, em geral, úteis como alertas breves, desde que os aprofundamentos permaneçam nos capítulos de referência e os links internos sejam inseridos apenas quando as páginas estiverem efetivamente revisadas e publicadas.

**A auditoria não considera os módulos prontos para publicação.** A PR #132 deve permanecer aberta e em rascunho. Nenhuma alteração desta etapa autoriza merge, deploy ou publicação em produção.
