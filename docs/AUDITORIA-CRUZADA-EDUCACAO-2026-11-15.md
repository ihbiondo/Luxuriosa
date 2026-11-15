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

A página pública e o módulo distinguem menstruação, ciclo e ovulação; evitam tratar 28 dias ou o 14º dia como regra; explicam que a janela fértil e aplicativos/calendários não confirmam a ovulação nem garantem contracepção. A classificação FIGO de 24 a 38 dias é apresentada como referência para adultos; o texto também informa que outras referências utilizam faixas como 21 a 35 dias. A diferença entre sistemas é explicitada e nenhum intervalo é usado isoladamente como diagnóstico.

**Resultado:** nenhuma correção substantiva identificada nesta leitura pontual. Antes da publicação, ainda é necessário validar individualmente a referência citada para a faixa de duração e a linguagem sobre variações por idade e estágio reprodutivo. Esta checagem não substitui revisão ginecológica.

### Escopo desta rodada

Foram examinados o artigo público de contracepção, o artigo de ciclo menstrual, os módulos internos 3 e 4 e as referências oficiais brasileiras sobre contracepção de emergência, DIU de cobre e esterilização voluntária. Não é uma revisão clínica integral dos 23 artigos. Nenhuma alteração foi feita em produção; as correções estão apenas na branch da PR #132.

## 11. Decisão

Os 12 módulos formam uma arquitetura coerente para a biblioteca e têm separação temática razoável. As repetições identificadas são, em geral, úteis como alertas breves, desde que os aprofundamentos permaneçam nos capítulos de referência e os links internos sejam inseridos apenas quando as páginas estiverem efetivamente revisadas e publicadas.

**A auditoria não considera os módulos prontos para publicação.** A PR #132 deve permanecer aberta e em rascunho. Nenhuma alteração desta etapa autoriza merge, deploy ou publicação em produção.


## 12. Revisão clínica documental — Módulo 8: prazer, resposta sexual e dificuldades (15/11/2026)

**Arquivo:** `docs/educacao/modulos/08-prazer-resposta-sexual-dificuldades.md`  
**Versão:** rascunho interno v0.2.  
**Estado:** revisão documental concluída nesta etapa; não publicado e sem revisão profissional externa.

### Escopo da leitura

Foram examinados os conceitos de prazer, desejo espontâneo e responsivo, excitação subjetiva e respostas genitais, orgasmo e ejaculação, modelos de resposta sexual, critérios gerais para reconhecer dificuldades, disfunção erétil, alterações do desejo, dificuldades orgásmicas/ejaculatórias, dor sexual, encaminhamento e alegações comerciais de “potência” ou “desempenho”.

### Ajustes realizados

1. **Critérios diagnósticos:** acrescentada ressalva explícita de que duração, frequência, contexto e sofrimento clinicamente significativo variam conforme a condição e o sistema de classificação. O prazo de seis meses não deve ser generalizado para todas as disfunções. Diferença de desejo entre parceiros, preferência pessoal ou episódio isolado não constitui, por si só, diagnóstico.
2. **Tratamentos:** incluída seção de abordagem biopsicossocial e individualizada, cobrindo investigação de fatores associados, revisão de medicamentos pelo prescritor, acompanhamento psicosexual, fisioterapia do assoalho pélvico em situações selecionadas, cuidados locais e tratamentos médicos conforme diagnóstico. O texto não oferece posologia nem substitui avaliação.
3. **Disfunção erétil:** acrescentada a importância de avaliar saúde cardiovascular/metabólica e de não reduzir o cuidado a uma solução pontual. A redação alerta para a contraindicação de inibidores da PDE5 com nitratos e riociguate, por risco de hipotensão grave; a decisão terapêutica depende de avaliação profissional.
4. **Testosterona e desejo:** esclarecido que testosterona não é estimulante geral, não existe nível sérico isolado que diagnostique transtorno do desejo e o uso em mulheres é restrito a situações clínicas selecionadas, com benefício moderado, decisão compartilhada e monitoramento. Não apresentar hormônios como suplemento de desempenho.
5. **Dor e assoalho pélvico:** esclarecido que exercícios de contração/Kegel não são universais e podem ser inadequados quando há tensão muscular excessiva. A fisioterapia pélvica, dilatadores e outros recursos dependem da avaliação e da causa.
6. **Alegações comerciais:** criada seção que diferencia acessórios de tratamentos clínicos e rejeita promessas de cura, aumento permanente, orgasmo garantido ou efeito universal. Incluído alerta de que produtos de aprimoramento sexual podem conter fármacos não declarados; a referência à FDA é contextual e não permite inferir contaminação de todos os produtos vendidos no Brasil.
7. **Referências:** adicionadas diretrizes EAU 2026 para disfunção erétil, orientação ISSWSH sobre testosterona, consenso ICSM 2026 sobre classificação e alertas da FDA sobre produtos de aprimoramento sexual. ACOG PB 213 permanece identificado como reafirmado em 2025.

### Fontes consultadas

- [ACOG — Your Sexual Health](https://www.acog.org/womens-health/faqs/your-sexual-health): domínios de desejo, excitação, orgasmo e dor; fatores biopsicossociais e opções gerais de cuidado.
- [ACOG — Female Sexual Dysfunction, Practice Bulletin 213](https://www.acog.org/clinical/clinical-guidance/practice-bulletin/articles/2019/07/female-sexual-dysfunction): critérios e abordagem de disfunção sexual; reafirmado em 2025.
- [ACOG — When Sex Is Painful](https://www.acog.org/womens-health/faqs/when-sex-is-painful): dor frequente ou intensa e necessidade de avaliação.
- [EAU — Management of Erectile Dysfunction, Guidelines on Sexual and Reproductive Health 2026](https://uroweb.org/guidelines/sexual-and-reproductive-health/chapter/management-of-erectile-dysfunction): avaliação clínica, fatores cardiovasculares/metabólicos, opções terapêuticas e contraindicações.
- [ISSWSH — Clinical Practice Guideline for Systemic Testosterone in Women with HSDD](https://pmc.ncbi.nlm.nih.gov/articles/PMC8064950/): indicação selecionada, avaliação biopsicossocial, monitoramento e limites de segurança.
- [ICSM 2026 — Definitions, classification, and epidemiology of sexual dysfunction](https://academic.oup.com/smr/article/14/2/qeag028/8685686): critérios por condição e importância do sofrimento clínico, sem um prazo universal.
- [FDA — Sexual Enhancement and Energy Product Notifications](https://www.fda.gov/drugs/medication-health-fraud-notifications/sexual-enhancement-and-energy-product-notifications): alertas de 2026 sobre ingredientes farmacológicos não declarados em produtos de aprimoramento sexual.
- [NHS — Ejaculation problems](https://www.nhs.uk/conditions/Ejaculation-problems/): fatores físicos, psicológicos e medicamentosos em dificuldades ejaculatórias.

### Limites e pendências

- A revisão foi documental e não equivale a avaliação clínica, validação por especialista ou revisão sistemática.
- O ACOG PB 213 é orientação profissional de 2019 reafirmada em 2025; as páginas de orientação ao público não substituem diretrizes brasileiras.
- Diretrizes EAU e alertas FDA são referências internacionais; antes de publicação, confirmar registro, bula, contraindicações e disponibilidade de tratamentos no Brasil com fontes oficiais nacionais, inclusive Anvisa e protocolos pertinentes.
- A evidência e as recomendações podem variar por anatomia, condição, idade, menopausa, comorbidades e medicamentos. O texto mantém linguagem geral e não inclui doses.
- A página pública `educacao/temas/saude-sexual-e-bem-estar.html` já contém uma síntese introdutória de desejo, resposta corporal e dor; foi lida e não recebeu alteração nesta rodada para evitar duplicação. Não existe, entre os arquivos públicos revisados nesta PR, artigo específico sobre tratamento de disfunções sexuais.
- O Módulo 8 permanece interno. Revisão profissional clínica e validação editorial final são obrigatórias antes de qualquer publicação.


## 13. Revisão psicossocial documental — Módulo 7: relacionamentos, comunicação e intimidade (15/11/2026)

- Módulo interno atualizado para rascunho v0.2.
- Comunicação e resolução de conflitos agora são explicitamente condicionadas à segurança e à liberdade; em contextos de medo, coerção ou violência, a prioridade é apoio independente, não uma técnica de comunicação melhor.
- Reforçada a distinção entre diferença de desejo e falta de compromisso; ninguém deve sexo, toque ou demonstração física para evitar conflito ou provar amor.
- Acordos relacionais são voluntários e não substituem consentimento específico e atual.
- Acrescentadas referências a controle coercitivo, violência psicológica, sexual e patrimonial e coerção reprodutiva, incluindo sabotagem contraceptiva e controle de acesso à saúde.
- Explicitado que terapia de casal/mediação não é indicação automática em contextos de violência, coerção ou medo.
- Reforçado apoio sem culpabilização ou imposição de denúncia/separação; plano de segurança deve ser individualizado.
- Delimitado o Ligue 180 para mulheres em situação de violência; 190 para emergência; Disque 100 para violações de direitos humanos, sem apresentar o 180 como canal universal.
- Página pública `educacao/temas/consentimento-e-limites.html` foi conferida e não alterada; não foram encontrados conflitos que exigissem mudança pública nesta rodada.
- Auditoria específica em `docs/AUDITORIA-PSICOSSOCIAL-RELACIONAMENTOS-2026-11-15.md`.
- Revisão documental; avaliação profissional psicossocial e revisão especializada em violência permanecem pendentes. Nenhuma publicação em produção.


## 14. Revisão de coerência — Módulo 6 e articulação com os Módulos 7 e 8 (15/11/2026)

**Arquivos examinados:**
- `docs/educacao/modulos/06-consentimento-limites-seguranca.md`;
- `docs/educacao/modulos/07-relacionamentos-comunicacao-intimidade.md`;
- `docs/educacao/modulos/08-prazer-resposta-sexual-dificuldades.md`;
- `educacao/temas/consentimento-e-limites.html` (página pública).

### Ajustes no Módulo 6

1. **Consentimento contínuo sem formalismo mecânico:** esclarecido que não se exige uma confirmação verbal repetida a cada instante; exige-se atenção à comunicação e aos limites, interrupção diante de hesitação/desconforto e respeito absoluto à recusa verbal.
2. **Capacidade para decidir:** substituída a formulação genérica sobre “incapacitação importante” por orientação funcional: se álcool ou outras substâncias prejudicarem compreensão, decisão ou comunicação, ou houver dúvida sobre a capacidade naquele momento, não avançar. Idade, capacidade e validade jurídica continuam sujeitas à legislação e ao contexto.
3. **Alinhamento clínico da PEP:** o Módulo 6 orienta avaliação o mais rápido possível, preferencialmente nas primeiras duas horas, e no máximo em 72 horas, conforme a página vigente do Ministério da Saúde. A redação não é orientação de autoseleção nem substitui avaliação.
4. **Articulação explícita com os Módulos 7 e 8:** acrescentada seção que distingue negociação segura de coerção, esclarece que acordos não substituem consentimento atual e reforça que desejo responsivo e respostas fisiológicas não equivalem a consentimento.
5. **Limite jurídico:** explicitado que a estrutura livre, informada, específica, contínua e revogável é educativa e não deve ser apresentada como transcrição de uma definição legal brasileira universal.

### Resultado da leitura cruzada

- **Módulo 6 → Módulo 7:** coerência confirmada. O Módulo 7 condiciona comunicação e resolução de conflitos à segurança, reconhece coerção e controle e afasta terapia de casal/mediação como recomendação automática em contextos de violência. O Módulo 6 agora remete expressamente a esse limite.
- **Módulo 6 → Módulo 8:** coerência confirmada. O Módulo 8 já afirma que lubrificação, ereção e desejo responsivo não substituem consentimento e que ninguém deve insistir em atividade dolorosa. O Módulo 6 torna essa conexão explícita.
- **Módulo 7 → Módulo 8:** sem contradição identificada. Diferença de desejo não é tratada como falta de amor/compromisso; ninguém deve sexo ou toque para evitar conflito; dificuldades sexuais são tratadas sem obrigação de desempenho.
- **Página pública de consentimento:** a leitura não identificou conflito conceitual com os módulos. A página já explica liberdade, especificidade, continuidade, reversibilidade, efeitos de pressão, resposta corporal e o limite de que consentimento não substitui segurança. Não foi alterada nesta rodada para evitar duplicação; permanece uma página introdutória, menos abrangente que o módulo interno.

### Fontes e limites

- [OMS — Comprehensive sexuality education, 11/03/2026](https://www.who.int/news-room/fact-sheets/detail/comprehensive-sexuality-education): consentimento, privacidade, integridade corporal, relações, comunicação, decisão e busca de apoio.
- [OMS — Violence against women, 18/06/2026](https://www.who.int/news-room/fact-sheets/detail/violence-against-women): violência por parceiro íntimo inclui coerção sexual, abuso psicológico e comportamentos controladores.
- [UNESCO — International technical guidance on sexuality education, 2018](https://unesdoc.unesco.org/ark:/48223/pf0000260770): consentimento, privacidade, integridade corporal e fatores que afetam a capacidade de consentir, incluindo substâncias, violência, pobreza e relações de poder.
- [Ministério da Saúde — PEP](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/pep): avaliação e início o mais rápido possível, até 72 horas.
- [Ministério da Saúde — Prevenção](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/prevencao): início preferencial nas primeiras duas horas e limite de 72 horas.

A revisão é documental e de coerência editorial; não equivale a revisão jurídica, clínica ou psicossocial profissional. A página pública foi apenas conferida, sem alteração. O Módulo 6 continua interno e não está aprovado para publicação.


## 15. Revisão de coerência — Módulo 5, Módulo 11 e prevenção pós-exposição (15/11/2026)

**Arquivos examinados:**
- `docs/educacao/modulos/05-ist-hiv-prevencao-combinada.md`;
- `docs/educacao/modulos/06-consentimento-limites-seguranca.md`;
- `docs/educacao/modulos/11-violencia-sexual-apoio-direitos.md`;
- `educacao/temas/prevencao-combinada.html`;
- `educacao/guias/violencia-sexual-onde-buscar-ajuda.html`.

### Achado central

O material diferenciava PrEP (antes da exposição) e PEP-HIV (após exposição recente), mas não explicitava com força suficiente que o cuidado pós-violência sexual não termina no limite de 72 horas da PEP-HIV. A Nota Técnica nº 222/2025 do Ministério da Saúde, publicada em janeiro de 2026, reforça avaliação integrada de HIV, hepatite B, sífilis e outras IST, vacinação, contracepção de emergência, testagem e seguimento.

### Correções

1. **Módulo 5 v0.2:** diferencia PEP-HIV do conjunto de intervenções pós-exposição; acrescenta seção específica para violência sexual, incluindo PEP-HIV até 72 horas, seguimento quando o prazo passou, episódios recorrentes, avaliação de PrEP para risco futuro, hepatite B, IST não virais, testagem CT/NG por local de exposição, hepatite C, HPV, contracepção de emergência e seguimento.
2. **Módulo 11 v0.2:** atualiza a seção de atendimento imediato e remete ao Módulo 5 para detalhes clínicos. Reforça que o cuidado continua depois de 72 horas e que os critérios da Nota Técnica 222/2025 não devem ser generalizados sem considerar seu escopo (mulheres e meninas) e os protocolos específicos.
3. **Página pública de prevenção combinada:** acrescenta resumo de que a prevenção pós-violência não se limita à PEP-HIV.
4. **Guia público de violência sexual:** explicita que o prazo de 72 horas é específico da PEP-HIV e inclui as medidas adicionais descritas na Nota Técnica.
5. **Módulo 6:** coerência mantida; autonomia, privacidade, consentimento e respeito aos limites durante acolhimento e procedimentos são compatíveis com a orientação de cuidado humanizado e não revitimizante.

### Distinções importantes

- PEP-HIV: urgência, iniciar o mais rápido possível e até 72 horas; quando indicada, 28 dias.
- Hepatite B: avaliação vacinal/imunológica e eventual vacina/imunoglobulina; a Nota Técnica aponta janela preferencial de 24 horas e limite de 14 dias para imunoglobulina em exposição sexual, conforme indicação.
- Sífilis e outras IST não virais: avaliação e prevenção/tratamento preemptivo conforme protocolo; não aplicar automaticamente o limite de 72 horas da PEP-HIV.
- Hepatite C: não há profilaxia medicamentosa pós-exposição; avaliação e seguimento com testagem.
- Contracepção de emergência: até 120 horas para opções citadas na Nota Técnica, quando indicadas.
- PrEP: estratégia pré-exposição para risco futuro; não substitui PEP-HIV após evento recente.

### Fontes e limites

- [Nota Técnica nº 222/2025-CGHA/.DATHI/SVSA/MS](https://azt.aids.gov.br/documentos/nota_tecnica/Nota%20Tecnica%20222.pdf).
- [Ministério da Saúde — PEP](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/pep).
- [Ministério da Saúde — Prevenção HIV/Aids](https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/a/aids-hiv/prevencao).
- [PCDT de IST](https://www.gov.br/saude/pt-br/assuntos/pcdt/a/atencao-integral-as-pessoas-com-infeccoes-sexualmente-transmissiveis/view).

A Nota Técnica 222/2025 foi formulada com foco na rede de atenção a mulheres e meninas. Os critérios clínicos devem ser aplicados por profissionais conforme a situação individual e os protocolos vigentes. A revisão é documental; revisão clínica, pediátrica e jurídica externa permanece pendente. Nenhuma publicação em produção foi feita.


## 16. Revisão documental — contracepção e planejamento reprodutivo (15/11/2026)

**Escopo:** Módulo 4 e artigo público `educacao/temas/contracepcao.html`; coerência com Módulos 3, 5, 6 e 11. Revisão documental, sem validação clínica profissional.

### Achados e correções

- Atualizado o Módulo 4 para v0.2 e alinhado o artigo público à informação regulatória disponível em 15/11/2026.
- Anvisa aprovou em 26/10/2026 a ampliação da duração contraceptiva do implante de etonogestrel 68 mg (Implanon NXT) de três para até cinco anos de uso contínuo; a mesma decisão admite inserção imediatamente após o parto e após aborto, conforme bula e avaliação clínica. O texto não generaliza a mudança para outros implantes.
- A duração de até oito anos do sistema intrauterino de levonorgestrel 52 mg refere-se ao uso contraceptivo conforme bula atualizada; não se aplica automaticamente a outras concentrações, marcas ou indicações clínicas. A equipe deve conferir a bula vigente e a finalidade do uso.
- A incorporação do implante ao SUS não equivale à disponibilidade imediata em toda UBS. As Notas Técnicas Conjuntas nº 198/2026 e nº 343/2026 tratam de gestão, distribuição, monitoramento e remessas; o artigo agora recomenda confirmar a oferta na rede local.
- Corrigida no Módulo 4 a expressão “idade mínima de 21 anos” para “idade superior a 21 anos” na síntese do critério legal de esterilização, preservando a alternativa de pelo menos dois filhos vivos e o prazo de 60 dias. O texto público já utilizava “mais de 21 anos”.
- Reforçada a distinção entre contracepção de emergência e PEP-HIV. Após violência sexual, o limite de 72 horas refere-se ao início da PEP-HIV; ultrapassá-lo não encerra a necessidade de avaliação de outras medidas, como profilaxias pertinentes, contracepção de emergência, vacinação, acolhimento e seguimento.
- A seção de emergência permanece alinhada à Nota Técnica nº 2/2025: acesso em até 120 horas, o mais cedo possível, com avaliação da opção adequada.

### Fontes oficiais e normativas consultadas

- Anvisa. **Anvisa aprova ampliação do uso do Implanon para cinco anos**, 26/10/2026: https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-aprova-ampliacao-do-uso-do-implanon-para-cinco-anos
- Anvisa. **Bulário Eletrônico**: https://consultas.anvisa.gov.br/#/bulario/
- Prefeitura de São Paulo, Secretaria Municipal da Saúde. **Nota Técnica nº 01/2026 — atualização do SIU-LNG 52 mg para até oito anos de uso contraceptivo**, 11/11/2026: https://prefeitura.sp.gov.br/documents/d/saude/atualizacao-mirena-para-8-anos-pdf
- Ministério da Saúde. **Nota Técnica Conjunta nº 198/2026**, 24/08/2026: https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2026/nota-tecnica-conjunta-no-198-2026-cgesmu-dgci-saps-ms.pdf/view
- Ministério da Saúde. **Nota Técnica Conjunta nº 343/2026**, 03/11/2026: https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2026/nota-tecnica-conjunta-no-343-2026-cgesmu-dgci-saps-cgafb-daf-sctie-ms.pdf/view
- Ministério da Saúde. **Contracepção — Saúde Sexual e Reprodutiva**: https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/s/saude-da-mulher/saude-sexual-e-reprodutiva/contracepcao
- Ministério da Saúde. **Nota Técnica nº 2/2025 — contracepção de emergência e acesso de adolescentes**: https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2025/nota-tecnica-no-2-2025-cosaj-cgcriaj-dgci-saps-ms
- OMS. **Medical eligibility criteria for contraceptive use**, 6ª edição, 03/11/2025: https://www.who.int/publications/i/item/9789240115583
- OMS. **Selected practice recommendations for contraceptive use**, 4ª edição, 03/11/2025: https://www.who.int/publications/i/item/9789240115606
- Brasil. **Lei nº 9.263/1996**, art. 10, com redação da Lei nº 14.443/2022: https://www.planalto.gov.br/ccivil_03/leis/l9263.htm

### Limites e pendências

- A aprovação regulatória de uma duração maior não substitui a conferência da bula vigente, do produto efetivamente utilizado, da indicação clínica e da orientação profissional.
- A atualização de bula não significa que a logística, os registros e os protocolos locais do SUS já tenham sido atualizados em todos os municípios. Não afirmar disponibilidade ou duração operacional local sem confirmação da rede.
- Não foi feita avaliação individual de contraindicações, interações, elegibilidade, início/retomada após contracepção de emergência ou condutas pós-parto.
- Revisão por ginecologista ou profissional habilitado em planejamento reprodutivo e revisão jurídica da seção de esterilização continuam pendentes.
- Nenhuma alteração foi publicada em produção.


## 17. Revisão clínica documental — ciclo menstrual, fertilidade e reprodução (15/11/2026)

- Módulo 3 atualizado para v0.2: diferenciadas referências FIGO para adultos (24–38 dias, até 8 dias de sangramento e variação dependente da idade) de outras faixas clínicas e dos parâmetros da adolescência.
- Corrigida a apresentação da ovulação: não ocorre necessariamente no 14º dia; incluída janela fértil biológica aproximada e limites de calendário, aplicativos, muco cervical e testes de LH.
- Reforçada a orientação para contracepção de emergência sem esperar atraso menstrual, com remissão ao Módulo 4 e limite de até 120 horas conforme método/indicação.
- Acrescentados critérios do método da amenorreia lactacional, retorno possível da ovulação antes da primeira menstruação pós-parto e mudanças de sangramento com métodos hormonais.
- Fertilidade alinhada à OMS e à Sociedade Brasileira de Reprodução Humana: avaliação após 12 meses abaixo de 35 anos, após 6 meses a partir de 35 anos e antecipada quando há fatores conhecidos; acima de 40 anos pode ser mais imediata.
- Artigo público corpo-humano-e-ciclo-menstrual.html ampliado com janela fértil, fecundação, fertilidade, sinais de alerta e fontes atualizadas.
- Criado AUDITORIA-CICLO-MENSTRUAL-FERTILIDADE-2026-11-15.md.
- Revisão documental; revisão clínica externa permanece pendente. Nenhuma publicação em produção.


## 18. Revisão documental — anatomia, fisiologia e desenvolvimento corporal (15/11/2026)

- Módulo 2 atualizado para v0.2: refinadas as distinções entre vulva, vestíbulo, uretra, vagina e colo; detalhadas estruturas internas do clitóris, corpos eréteis penianos, tubas uterinas, epidídimo e assoalho pélvico.
- Reformulada a explicação do eixo hipotálamo–hipófise–gônadas para evitar atribuir hormônios exclusivamente a um sexo.
- Acrescentadas faixas de referência da Sociedade Brasileira de Pediatria para início puberal, com ressalva de que não são cronograma individual nem diagnóstico automático.
- Reforçada a distinção entre características sexuais, variações intersexo e identidade de gênero.
- Corrigido o tratamento editorial do hímen: variação anatômica não comprova histórico sexual; testes de virgindade não têm validade científica.
- Reforçados sinais de urgência: dor testicular súbita e intensa e parafimose; incluída orientação para não forçar a retração do prepúcio.
- Artigo público `educacao/temas/corpo-humano-e-ciclo-menstrual.html` ampliado com anatomia, desenvolvimento, hímen e sinais de alerta, mantendo a URL.
- Criado `docs/AUDITORIA-ANATOMIA-FISIOLOGIA-2026-11-15.md` com fontes, achados e limitações.
- Fontes centrais: NCBI Bookshelf/StatPearls, MedlinePlus, Sociedade Brasileira de Pediatria, Ministério da Saúde/UFRGS, OMS, ACOG, NHS e Associação Europeia de Urologia.
- Revisão documental; validação clínica externa, revisão especializada de linguagem sobre variações intersexo e decisão sobre diagramas acessíveis permanecem pendentes. Nenhuma alteração foi publicada em produção.


## 19. Revisão documental — fundamentos da sexualidade e da saúde sexual (15/11/2026)

- Módulo 1 atualizado para v0.2: refinada a apresentação da definição de trabalho da OMS, explicitando que a organização não a caracteriza como posição oficial formal.
- Diferenciadas sexualidade, atividade sexual, saúde sexual e saúde reprodutiva.
- Incluídas distinções entre características sexuais, identidade de gênero, expressão de gênero e orientação sexual, sem inferência de uma dimensão pela outra.
- Consentimento tratado como estrutura educativa (liberdade, informação, especificidade, continuidade e possibilidade de retirada), sem apresentá-lo como fórmula jurídica completa.
- Reforçado que resposta fisiológica, silêncio, ausência de resistência, vínculo afetivo ou consentimento anterior não autorizam presumir vontade atual.
- Incluída referência à Lei nº 12.845/2013 e esclarecido que o prazo máximo de 72h da PEP-HIV não encerra outras formas de atendimento após violência sexual.
- Artigo público `educacao/temas/saude-sexual-e-bem-estar.html` atualizado com conceitos, autonomia, consentimento e referência legal, preservando a URL.
- Criado `docs/AUDITORIA-FUNDAMENTOS-SAÚDE-SEXUAL-2026-11-15.md`.
- Fontes: OMS, Ministério da Saúde, Lei nº 12.845/2013 e Ministério das Mulheres.
- Revisão documental; validação clínica, psicossocial e jurídica externa permanece pendente. Nenhuma alteração foi publicada em produção.
