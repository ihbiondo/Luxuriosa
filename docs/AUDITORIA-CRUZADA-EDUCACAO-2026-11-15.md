# Auditoria cruzada — Educação Luxuriosa

**Data:** 15/11/2026  
**Branch:** `content/auditoria-editorial-fase-1`  
**PR:** [#132](https://github.com/ihbiondo/Luxuriosa/pull/132)  
**Status:** revisão interna; não publicado; sem revisão externa.

## 1. Escopo e estado confirmado

- Inventário editorial de 23 artigos existentes, preservando todas as URLs.
- Cinco módulos internos em rascunho: 1, 5, 6, 11 e 12.
- Sete módulos ainda não produzidos: 2, 3, 4, 7, 8, 9 e 10.
- O conteúdo público continua separado dos rascunhos internos.
- A PR permanece aberta e em rascunho. Esta auditoria não autoriza merge ou publicação.

## 2. Achados prioritários

### P1 — Guia público sobre violência sexual precisava refletir a lei de 2026

O guia `educacao/guias/violencia-sexual-onde-buscar-ajuda.html` explicava que a notificação em saúde não equivale automaticamente a denúncia policial, mas não mencionava a alteração legal posterior. A Lei nº 15.516, de 22/09/2026, alterou a Lei nº 12.845/2013 e acrescentou comunicação obrigatória à autoridade policial, em até 24 horas, nos casos com indícios ou confirmação de violência sexual. A ausência dessa informação poderia deixar o texto incompleto e induzir interpretação equivocada.

**Correção proposta nesta PR:** explicitar que a comunicação é feita institucionalmente pelo serviço de saúde e não transforma o BO registrado pessoalmente pela pessoa em requisito para atendimento; acrescentar a referência oficial à lei. A redação ainda requer revisão jurídica externa.

Fonte primária: [Lei nº 15.516/2026 — publicação original, Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/lei/2026/lei-15516-22-setembro-2026-800011-publicacaooriginal-181456-pl.html).

### P1 — Delimitar o alcance da comunicação ao Conselho Tutelar no Módulo 11

O rascunho dizia genericamente que a Lei nº 15.516/2026 prevê comunicação ao Conselho Tutelar em casos envolvendo crianças e adolescentes. No texto legal, essa previsão aparece no contexto em que o primeiro atendimento é realizado por profissional de segurança pública. A formulação ampla precisa ser delimitada para não atribuir à lei uma obrigação fora do contexto descrito no dispositivo.

**Correção proposta nesta PR:** restringir a frase ao contexto expresso no art. 2º, § 1º, e registrar que outros deveres podem decorrer do ECA e dos protocolos aplicáveis. Revisão jurídica especializada continua obrigatória.

Fonte primária: [Lei nº 15.516/2026 — publicação original](https://www2.camara.leg.br/legin/fed/lei/2026/lei-15516-22-setembro-2026-800011-publicacaooriginal-181456-pl.html).

### P1 — Datas do sitemap

Oito artigos alterados nesta PR exibiam data editorial de 15/11/2026, mas seus registros `lastmod` no sitemap ainda estavam em 14/11/2026:
- anéis penianos;
- jogos de casal;
- masturbadores;
- plugs anais;
- limpeza e conservação;
- corpo humano e ciclo menstrual;
- prevenção combinada;
- prevenção de IST.

**Correção proposta nesta PR:** alinhar os oito `lastmod` para 15/11/2026. A data deve representar alteração material do conteúdo, não uma atualização automática sem revisão.

## 3. Achados de arquitetura e validação

### P2 — Workflow não executava validação em pull requests

O workflow `.github/workflows/validate-education.yml` estava configurado para `push` em `main` e `workflow_dispatch`, sem evento `pull_request`. Portanto, alterações em PR não recebiam validação automática antes do merge.

**Correção proposta nesta PR:** adicionar `pull_request` para a branch `main`, mantendo os mesmos filtros de caminhos. A execução só poderá ser considerada aprovada depois de o GitHub Actions concluir a execução gerada pelo novo commit.

### P2 — Regra de mídia do validador precisa de decisão editorial

O script `scripts/validar_educacao.py` reprova qualquer elemento `img`, `picture`, `video`, `iframe`, `embed` ou `object` em páginas educativas. Isso é uma regra absoluta, não apenas uma verificação de mídia explícita ou sem texto alternativo.

A arquitetura planejada para anatomia e fisiologia pode se beneficiar de diagramas anatômicos didáticos, não explícitos e acessíveis. Antes do Módulo 2, decidir se a biblioteca será estritamente textual ou se aceitará diagramas educativos com texto alternativo, fonte e revisão. Não afrouxar a regra automaticamente sem política aprovada.

### P2 — O validador não substitui revisão clínica nem verificação de fontes

O script verifica estrutura HTML, metadados, navegação, presença de blocos de fontes/leituras, sitemap e links locais. Não confirma:
- se a fonte realmente sustenta a afirmação ao lado;
- se a diretriz continua vigente;
- se números, prazos e contraindicações estão corretos;
- se uma referência legal foi interpretada corretamente;
- se o conteúdo é adequado para monetização ou políticas de anúncios.

Esses pontos exigem revisão humana e, nos assuntos de saúde, profissionais habilitados.

## 4. Mapa de sobreposição entre os 23 artigos

Os conteúdos têm funções distintas e devem ser conectados, não fundidos indiscriminadamente:

- **Prevenção de IST** = guia de situação, testagem, sintomas, tratamento e próximos passos. **Prevenção combinada** = visão integrada das estratégias complementares.
- **Saúde sexual e bem-estar** = porta de entrada conceitual. **Direitos, diversidade e acesso** = direitos, privacidade, não discriminação e acesso a serviços.
- **Consentimento e limites** = consentimento nas interações. **Segurança digital e privacidade** = autorização, proteção e exposição no ambiente digital.
- **Materiais dos acessórios** = propriedades e composição. **Limpeza e conservação** = procedimento prático. **Primeiro acessório** = critérios de escolha.
- **Géis e lubrificantes** = verbete de referência. **Como escolher um lubrificante** = guia prático de decisão.

A decisão continua sendo preservar as 23 URLs. Não há base suficiente nesta etapa para excluir, aplicar `noindex` ou redirecionar qualquer artigo.

## 5. Riscos editoriais e lacunas

1. Os cinco módulos existentes são rascunhos v0.1, não conteúdo clinicamente, psicossocialmente ou juridicamente revisado.
2. Os módulos 2, 3 e 4 devem receber prioridade de produção, com fontes clínicas atuais e cuidado especial com fertilidade, contracepção e limites de estimativas de ciclo.
3. Os módulos 7, 8 e 9 exigem revisão de linguagem e clínica, sem transformar variações individuais em diagnóstico.
4. O Módulo 10 exige documentação de materiais, rotulagem, compatibilidade e limites de alegações comerciais.
5. O Módulo 11 exige revisão jurídica e clínica antes de qualquer publicação, especialmente após a Lei nº 15.516/2026.
6. O Módulo 12 deve funcionar como índice de consulta, com cada afirmação curta ligada ao capítulo e à fonte específica que a sustenta.

## 6. Publicidade e independência editorial

- Loja, checkout, produtos e páginas operacionais continuam fora da estratégia de anúncios.
- Páginas educativas sobre acessórios e práticas íntimas podem ter restrições de publicidade; não prometer aprovação ou monetização.
- Recomendações clínicas não devem ser intercaladas com chamadas de compra.
- O conteúdo comercial deve permanecer identificado e separado da informação de saúde.

## 7. Situação da validação

- Inventário e leitura cruzada realizados sobre a matriz, os cinco rascunhos e os artigos públicos prioritários.
- A validação automatizada completa ainda não foi executada em checkout integral do branch.
- A mudança do workflow cria execução automática em PR; aguardar o resultado do Actions antes de afirmar que os testes passaram.
- Nenhuma revisão externa foi realizada.
- Nenhuma alteração desta auditoria deve ser publicada sem aprovação expressa.

## 8. Próximos passos

1. Aguardar e corrigir o resultado do GitHub Actions.
2. Fazer revisão jurídica e clínica do guia público e do Módulo 11.
3. Produzir os Módulos 2, 3 e 4.
4. Decidir política de diagramas educativos antes de introduzir mídia.
5. Fazer checagem individual de fontes, datas e alegações clínicas nos 23 artigos.
6. Manter PR #132 em rascunho até a revisão e autorização explícita.


## 9. Produção dos módulos 2, 3 e 4 — 15/11/2026

Foram criados três rascunhos internos na branch da PR:

- `docs/educacao/modulos/02-anatomia-e-fisiologia-reprodutiva.md`
- `docs/educacao/modulos/03-ciclo-menstrual-fertilidade-reproducao.md`
- `docs/educacao/modulos/04-contracepcao-planejamento-reprodutivo.md`

### Escopo coberto

- **Módulo 2:** anatomia externa e interna, vulva/vagina, clitóris, útero, ovários, tubas, pênis, testículos, estruturas acessórias, resposta corporal, variações anatômicas e sinais de alerta.
- **Módulo 3:** eixo hormonal, fases ovarianas e uterinas, ovulação, janela fértil, fecundação, implantação, testes, variações ao longo da vida e limites de aplicativos/calendários.
- **Módulo 4:** métodos LARC, hormonais, barreira, comportamentais, contracepção de emergência, esterilização, dupla proteção, elegibilidade e acesso no SUS.

### Cuidados específicos

- Não afirmar que a ovulação ocorre sempre no 14º dia.
- Não apresentar aplicativos como confirmação de ovulação ou método contraceptivo garantido.
- Não confundir lubrificação ou ereção com consentimento.
- Não apresentar contracepção de emergência como método abortivo.
- Não sugerir que métodos hormonais, DIU ou implante protejam contra IST.
- Não transformar taxas de falha de fontes diferentes em comparação direta sem padronizar metodologia.
- Não prescrever método nem substituir critérios de elegibilidade clínica da OMS.

### Fontes-base consultadas

- Ministério da Saúde — contracepção e métodos ofertados no SUS.
- Ministério da Saúde — Nota Técnica nº 2/2025 sobre acesso, contracepção de emergência em até 120 horas e atendimento a adolescentes.
- Ministério da Saúde — materiais do Programa Dignidade Menstrual 2025 e página de ciclo menstrual atualizada em outubro de 2026.
- OMS — Medical eligibility criteria for contraceptive use, 6ª edição (3/11/2025).
- OMS — Selected practice recommendations for contraceptive use, 4ª edição (3/11/2025).
- OMS — Guidelines on expanding contraceptive options (23/09/2026).
- MedlinePlus e NHS — anatomia reprodutiva e ciclo menstrual.
- ACOG — métodos de percepção da fertilidade.

Os links e datas completos constam ao final de cada módulo. As fontes servem como base para revisão, não como prova de revisão profissional.

### Situação

Os três capítulos são rascunhos v0.1. Não houve revisão clínica externa, não foram adicionados à navegação pública e não foram publicados. Os próximos passos são revisão técnica, verificação de cada afirmação contra a fonte primária e execução da validação automatizada da PR.
