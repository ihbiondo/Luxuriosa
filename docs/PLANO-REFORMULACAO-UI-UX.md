# Plano de reformulação UI/UX — Luxuriosa

**Repositório:** `ihbiondo/Luxuriosa`  
**Branch de trabalho:** `uiux-reformulacao`  
**Direção visual aprovada:** híbrida — base minimalista premium com linguagem editorial (aprox. 70% minimalista / 30% editorial).  
**Status:** implementação iniciada na branch `uiux-reformulacao`; homepage em evolução. A `main` e o site publicado permanecem fora desta etapa.

---

## 1. Objetivo do projeto

Evoluir a Luxuriosa de uma homepage que concentra quase toda a experiência para uma loja multipágina, com navegação clara, apresentação premium e compra simples, especialmente em dispositivos móveis.

A reformulação deve preservar a operação existente. Não reconstruir funcionalidades que já funcionam sem necessidade comprovada.

## 2. Princípios de experiência

1. **Mobile-first:** desenhar primeiro para larguras de 360–440 px e adaptar para telas maiores.
2. **Compra sem atrito:** catálogo, preço, disponibilidade e ação de compra devem ser fáceis de encontrar.
3. **Privacidade explícita:** atendimento reservado e embalagem discreta devem ser comunicados sem excesso de texto.
4. **Sofisticação sem ruído:** vinho, preto e dourado permanecem como base; fotografia e espaço em branco/negativo ganham protagonismo.
5. **Hierarquia clara:** cada página tem um propósito; a homepage apresenta e direciona, não tenta explicar tudo.
6. **Acessibilidade e desempenho:** contraste, alvos de toque, leitura, carregamento e movimento respeitam boas práticas.
7. **SEO preservado:** manter URLs existentes, metadados, dados estruturados e links internos sempre que possível.

## 3. Arquitetura proposta

### Navegação principal

- Início — `/`
- Loja — `/loja.html`
- Sobre — `/sobre.html`
- Atendimento — `/atendimento.html`
- Carrinho — manter o carrinho atual como painel/overlay acessível no cabeçalho.

No celular, usar menu compacto com as mesmas opções. Categorias ficam dentro da Loja, evitando sobrecarregar o cabeçalho.

### Páginas

| Página | Situação | Objetivo |
|---|---|---|
| Início (`index.html`) | Reformular | Apresentar marca, categorias, seleção de produtos e direcionar à compra |
| Loja (`loja.html`) | Criar | Reunir catálogo, busca, filtros, disponibilidade e ofertas |
| Produto (`produtos/*.html`) | Preservar e revisar | Informar e converter; manter os endereços atuais |
| Sobre (`sobre.html`) | Criar | História, propósito, posicionamento e identidade da Luxuriosa |
| Atendimento (`atendimento.html`) | Criar | Explicar compra, atendimento reservado, entrega, embalagem e agendamento |
| FAQ (`faq.html`) | Preservar e revisar | Responder dúvidas recorrentes |
| Privacidade (`privacidade.html`) | Preservar e revisar | Informações legais e transparência |
| Páginas locais (`cidades/*.html`) | Preservar e revisar | Manter presença regional e conteúdo específico de cada cidade |

### Categorias

Na primeira entrega, as categorias serão filtros e pontos de entrada dentro da Loja. Páginas individuais de categoria só serão criadas quando houver conteúdo, variedade e oportunidade de busca suficientes. Não criar URLs vazias ou páginas quase duplicadas.

## 4. Nova homepage — sequência proposta

1. **Hero editorial:** fotografia de campanha/produtos, frase curta, CTA principal para a Loja e CTA secundário para Atendimento.
2. **Categorias:** cards visuais e acessíveis, ligados aos filtros correspondentes da Loja.
3. **Seleção Luxuriosa:** mistura equilibrada de produtos individuais e kits, priorizando disponibilidade e relevância comercial.
4. **Experiência reservada:** atendimento discreto, embalagem e entrega, em mensagens curtas.
5. **Sobre a marca:** introdução breve e link para a página Sobre. A imagem atual do logotipo/figura deixa de ser a imagem principal do hero e pode ser reaproveitada na página institucional se fizer sentido.
6. **Entrega regional:** resumo objetivo, sem duplicar todas as condições operacionais.
7. **Chamada final:** acesso à Loja e ao Atendimento.
8. **Rodapé:** navegação, contato, cidades atendidas, FAQ e privacidade.

## 5. Direção visual

- **Base:** minimalista premium, com composição limpa e foco em produto.
- **Expressão editorial:** fotografia sofisticada, recortes e iluminação marcantes, usada com moderação.
- **Paleta de partida:** vinho `#8B1E3F`, preto `#0B0B0B`, dourado `#D4AF7C` e blush `#F7D7D9`.
- **Tipografia:** manter Playfair Display para títulos expressivos e Montserrat para interface e leitura, reavaliando tamanhos e pesos.
- **Componentes:** botões e cards consistentes, estados de foco visíveis, áreas de toque confortáveis e espaçamento previsível.
- **Fotografia:** priorizar imagens próprias ou licenciadas, com tratamento consistente e sem depender de imagens genéricas que não representem o estoque real.

## 6. Hero responsivo — requisitos

### Celular (360–440 px)

- Cabeçalho compacto, sem elementos sobrepostos.
- Título em poucas linhas e texto curto.
- CTA principal em destaque e secundário claramente distinto.
- Imagem com proporção e enquadramento definidos para mobile; não deve ficar parcialmente escondida após uma longa coluna de texto.
- Botão flutuante do WhatsApp não pode cobrir CTA, preço ou controles.
- Evitar obrigar o usuário a rolar muito antes de ver a proposta e a primeira ação.

### Desktop

- Composição editorial em duas áreas, texto e imagem equilibrados.
- Largura de leitura controlada e hierarquia clara.
- Imagem de campanha com enquadramento próprio, sem esticar ou cortar elementos essenciais.

## 7. Funcionalidades que não podem regredir

- Gate de maioridade e consentimento.
- Catálogo, pesquisa, filtros e disponibilidade.
- Páginas individuais de produto e links relacionados.
- Carrinho, persistência e cálculo/indicação de valores.
- Checkout, revisão do pedido e encaminhamento ao WhatsApp.
- Consulta de CEP e dados necessários à entrega.
- Regras comerciais de frete e disponibilidade.
- Atendimento com preferências disponíveis.
- Acessibilidade, SEO, canonical, Open Graph, sitemap e páginas locais.

Antes de mover scripts ou componentes, mapear dependências e testar fluxos completos. Preferir reaproveitar os módulos existentes a duplicar lógica.

## 8. Pendências comerciais para validar antes de alterar textos ou regras

1. **Cupons removidos por decisão comercial:** eliminar `PRIMEIRA10`, `FRETE`, seção promocional, campo de cupom, validações, mensagens e estilos associados.
2. **Benefício mantido:** pedidos que incluam pelo menos um kit têm frete grátis em Bauru, inclusive quando acompanhados de produtos avulsos. Os demais pedidos em Bauru têm frete padrão de R$ 15,00. Para outras cidades, disponibilidade e valor são confirmados no atendimento.
3. Confirmar se as categorias e produtos atualmente cadastrados refletem o mix comercial que deve aparecer na homepage.

Não alterar regras comerciais com base apenas em divergências técnicas.

## 9. Decisões comerciais registradas

- Não utilizar cupons promocionais nesta fase.
- Priorizar preços transparentes, kits com vantagem real e benefícios simples de entender.
- Manter frete grátis automático em Bauru quando o pedido incluir pelo menos um kit.
- Não reintroduzir campos ou regras de cupom sem nova decisão explícita.

## 10. Etapas de execução

### Etapa A — Preparação
- Confirmar inventário de arquivos, rotas e dependências.
- Definir componentes compartilhados e padrões de navegação.
- Definir mapa de imagens e requisitos de conteúdo.

### Etapa B — Estrutura e design
- Desenhar a homepage e os padrões de cabeçalho/rodapé.
- Definir Loja, Sobre e Atendimento.
- Definir comportamento responsivo e estados de interação.

### Etapa C — Implementação incremental
- Criar páginas novas na branch de trabalho.
- Migrar/reaproveitar catálogo e módulos existentes.
- Atualizar navegação e links internos.
- Preservar URLs atuais e atualizar sitemap apenas quando as páginas estiverem prontas.

### Etapa D — Validação
- Testar 360, 390, 440, tablet e desktop.
- Verificar ausência de rolagem horizontal e sobreposição.
- Testar maioridade, consentimento, busca, filtros, produto, carrinho, CEP e checkout.
- Revisar SEO, links, console e carregamento.
- Conferir diff e registrar alterações.

### Etapa E — Entrega
- Apresentar resumo e evidências de validação.
- Aguardar aprovação explícita antes de integrar à `main` ou publicar.
- O site publicado permanece inalterado durante o trabalho na branch.

---

## 11. Critério de conclusão

A reformulação estará pronta quando a navegação for clara, a experiência mobile estiver resolvida, as páginas tiverem propósitos distintos, os fluxos comerciais estiverem preservados e todos os testes forem aprovados. Beleza visual isolada não é critério suficiente.


## 12. Registro de implementação — primeira entrega

- Hero antigo com logotipo como imagem principal removido da homepage.
- Nova composição editorial com fotografias reais de kits já cadastrados no catálogo.
- Mensagem e CTAs simplificados: entrada na Loja e explicação do Atendimento.
- Benefícios de privacidade resumidos em uma linha de leitura rápida.
- Composição responsiva reorganizada para exibir a imagem antes do texto em telas menores, reduzindo o problema de a imagem ficar abaixo de uma coluna longa.
- Logotipo institucional deixa de ocupar o papel de imagem principal do hero.
- Esta entrega é inicial: ainda requer validação visual real em celular, tablet e desktop antes de ser considerada concluída.


## 13. Registro de implementação — categorias e vitrine

- Categorias da homepage convertidas em cartões de navegação com microdescrições e hierarquia visual mais clara.
- Mantidas as categorias que possuem produtos correspondentes no catálogo atual; lingerie não aparece como atalho enquanto não houver produtos disponíveis nessa categoria.
- Os cartões de categoria direcionam à Loja com o filtro correspondente pré-selecionado.
- Vitrine de destaques redistribuída entre produtos individuais e kits: Hot Ball — Xana Loka, Vibrador Golfinho — Rosa, Kit Descoberta e Kit Intensidade.
- Incluído CTA para acessar o catálogo completo.
- Ajustes responsivos específicos para tablet, celular e telas estreitas.
- A seleção de destaques usa os campos existentes no cadastro de produtos; nenhum preço ou descrição comercial foi alterado.


## 14. Registro de implementação — atendimento e entrega

- Atendimento reorganizado em três opções de preferência de atendente, mantendo os textos e mensagens de WhatsApp existentes.
- Reforçada a comunicação de privacidade, agendamento presencial em Bauru e escolha de embalagem neutra ou personalizada.
- Entrega apresentada em bloco próprio, com destaque para o frete padrão de Bauru e a condição de frete grátis em pedidos com kit.
- Fluxo de compra e entrega reorganizado em quatro etapas.
- Prazos, condições, municípios e distritos preservados; a lista de localidades foi agrupada em painel expansível para reduzir a altura da página.
- Links das páginas locais preservados.
- CTA de entrega direciona ao WhatsApp com mensagem de consulta de disponibilidade.
- Implementação ainda depende de validação visual e funcional em navegador.


## 15. Registro de implementação — Sobre e rodapé

- Homepage passou a apresentar uma introdução curta à marca, com a identidade visual anteriormente usada no hero e link para a página Sobre.
- Criada a página independente `sobre.html`, com história, propósito, posicionamento e identidade da Luxuriosa.
- Navegação principal direciona para a página Sobre.
- Rodapé reorganizado em três grupos: marca, exploração e informações.
- Mantidos links para FAQ, privacidade, atendimento, entrega e WhatsApp; removidos e-mails de RH e contatos setoriais do rodapé para reduzir ruído na navegação principal.
- Ajustes responsivos para tablet, celular e telas estreitas.
- Verificação visual em navegador ainda pendente.


## 16. Registro de implementação — página Loja

- Criada a página independente `loja.html`, com título, descrição, canonical e dados estruturados próprios.
- Catálogo, busca, filtros, cards, modal de detalhes e carrinho foram reaproveitados com os mesmos IDs e scripts da homepage, preservando a lógica existente.
- A homepage deixa de carregar o catálogo completo e passa a direcionar a compra para a página Loja.
- Os seis atalhos de categoria da homepage agora abrem a Loja com o filtro correspondente pré-selecionado.
- A página Loja aceita parâmetros `categoria` e `q` na URL para abrir uma categoria ou pesquisa específica.
- Navegação, rodapé, links de retorno, carrinho, gate 18+ e scripts de checkout foram preservados e adaptados aos caminhos da nova página.
- Página incluída no sitemap.
- Revisão estática e validação de caminhos/IDs pendentes; teste visual e funcional real no navegador continua necessário.


## 17. Revisão global de navegação e páginas institucionais

- Corrigidos os links da página Sobre que ainda apontavam para a antiga âncora `index.html#catalogo`; agora direcionam para `loja.html`.
- Revisados os 27 detalhes de produto: links de retorno ao catálogo agora apontam para a nova Loja, sem depender da seção removida da homepage.
- Revisadas as quatro páginas regionais: links para catálogo também apontam para `loja.html`; links de atendimento e entrega foram direcionados à nova página independente `atendimento.html`, preservando as âncoras de entrega.
- FAQ e Política de Privacidade receberam navegação superior consistente com Início, Loja, Sobre, Dúvidas frequentes e Privacidade, com indicação da página atual.
- Conferidos os links internos e âncoras das páginas principais e regionais; não foram encontrados links restantes para a antiga âncora `#catalogo` nas páginas revisadas.
- Mantidos os links das páginas de produto, das cidades, da nova página de atendimento e entrega, do FAQ e da política de privacidade.
- A revisão foi estática, diretamente nos arquivos da branch. Não substitui teste real de navegação, teclado, telas e comportamento no navegador.


## 18. Página independente de Atendimento e entrega

- Criada a página `atendimento.html`, reunindo atendimento personalizado, privacidade, embalagem e entrega.
- As três opções de preferência de atendente foram preservadas, com links diretos para o WhatsApp e mensagens pré-preenchidas.
- A embalagem personalizada foi descrita conforme a operação informada: papel kraft marsala, adesivo Luxuriosa e fragrância própria.
- Mantida a alternativa de apresentação neutra, conforme a escolha do cliente no atendimento.
- Condições de frete, prazos, municípios, distritos e links regionais foram transferidos sem alterar os valores e referências existentes.
- A homepage passa a apresentar apenas um resumo da experiência e direciona para a página completa.
- Navegação, rodapés, FAQ, páginas institucionais e links das 27 páginas de produto e quatro páginas regionais foram atualizados para a nova página.
- Página adicionada ao sitemap com canonical, Open Graph e dados estruturados próprios.
- A nova página carrega também `js/consentimento.js`, aplicando a confirmação de maioridade e o painel de preferências de privacidade, no mesmo padrão das páginas comerciais do site.
- Na auditoria responsiva, foram removidas oito regras que estavam fora dos respectivos breakpoints e poderiam alterar indevidamente o layout desktop de categorias, atendimento e entrega. A folha responsiva foi revalidada: regras agrupadas em media queries e chaves balanceadas.
- A revisão desta etapa é estática; testes visuais e funcionais reais no navegador continuam pendentes.

## 19. Auditoria do fluxo de compra — primeira revisão

- Revisado o fluxo entre catálogo, carrinho, dados do cliente, revisão do pedido e encaminhamento ao WhatsApp.
- Confirmado que o carrinho é persistido no navegador e sincroniza os itens com o catálogo atual, sinalizando indisponibilidade e alteração de preço antes da finalização.
- Confirmado que a regra de frete grátis por inclusão de kit está alinhada à categoria real `Kits` do catálogo e se aplica somente a Bauru/SP; para outras cidades, o valor permanece sujeito à confirmação.
- Corrigido o retorno das páginas individuais de produto: após adicionar um item, o cliente agora é direcionado para `loja.html?abrirCarrinho=1#catalogo`, onde o carrinho é reaberto automaticamente. Antes, o redirecionamento levava à homepage.
- A revisão do checkout confirmou validação de telefone, endereço, integridade dos preços e quantidades, além de prévia da mensagem antes de abrir o WhatsApp.
- O CEP continua opcional; quando informado, precisa ter oito dígitos. Rua, número, bairro, cidade e estado são exigidos para preparar a entrega.
- Esta etapa foi uma auditoria estática dos arquivos da branch. O comportamento real em navegador, especialmente em dispositivos móveis, ainda precisa ser testado no fechamento do projeto.

- Na auditoria do catálogo, foi identificado que a homepage oferecia o atalho “Oportunidades” para a categoria `Ofertas`, mas não há produtos nessa categoria. O cartão foi convertido em “Ver todo o catálogo”, apontando para `loja.html`, evitando um filtro vazio e uma promessa comercial sem conteúdo.


## 20. Auditoria das páginas individuais de produto — revisão estática

- Revisadas as 27 páginas individuais em relação ao catálogo central `data/produtos.json`.
- Corrigido, nas 27 páginas, o endereço do item intermediário do `BreadcrumbList` em JSON-LD: de `https://luxuriosa.com.br/#catalogo` para `https://luxuriosa.com.br/loja.html`, alinhando os dados estruturados ao breadcrumb visual e à arquitetura atual.
- Canonicals conferidos: cada página mantém seu próprio endereço individual de produto.
- Preços atuais exibidos nas páginas conferidos contra o campo `preco` do catálogo: os 27 valores coincidem.
- Preços antigos exibidos nas páginas que apresentam comparação conferidos contra `precoAntigo`: os valores coincidem. Nos produtos 17 e 18, o catálogo possui preço antigo, mas a página exibe apenas o preço atual; isso não altera o preço de venda e fica registrado como possível melhoria de apresentação, não como divergência comercial.
- Os 27 arquivos mantêm seus caminhos individuais; nenhuma URL de produto foi renomeada.
- A revisão foi estática, sem navegação real, teste de compra ou validação externa dos dados estruturados em navegador. Essas verificações permanecem para a etapa final.


## 21. Auditoria complementar das páginas de produto — imagens, dados e ações

- Conferidos nas 27 páginas o nome do produto no título/H1, o nome no JSON-LD `Product`, o preço da oferta estruturada e a imagem principal: os dados conferidos coincidem com `data/produtos.json`.
- Os 27 arquivos de imagem associados aos produtos existem no diretório `img/produtos/novas`; não foram encontrados caminhos de imagem ausentes no catálogo.
- Conferido o identificador do botão de compra nas páginas com carrinho: os IDs correspondem ao produto da página. O produto 21 está corretamente marcado como esgotado também no JSON-LD (`OutOfStock`) e o script bloqueia a compra.
- Os links de recomendação das 27 páginas apontam para páginas de produto existentes; cada página mantém também o retorno para a Loja.
- **Ponto de decisão identificado:** os seis kits (IDs 22 a 27) estão marcados no catálogo como disponíveis e não estão sob consulta, portanto o catálogo permite adicioná-los ao carrinho. Entretanto, suas páginas individuais oferecem apenas contato pelo WhatsApp e não apresentam o botão de adicionar ao carrinho. Não foi alterada essa regra porque alguns kits incluem item de escolha (por exemplo, versão do Dado do Prazer) e é necessário definir se o cliente deve selecionar a opção antes de adicionar ao carrinho ou se os kits devem continuar com pedido assistido pelo WhatsApp. Essa decisão precisa ser alinhada entre catálogo e página individual antes da implementação.
- Revisão estática concluída para nomes, imagens, preços, dados estruturados, links de recomendação e identificadores. Ainda não houve teste de navegador, compra real ou validação externa de rich results.


## 22. Padronização das ações dos kits nas páginas individuais

- Aplicada a decisão comercial para os seis kits: os kits de composição fixa **Kit Ela (ID 25)** e **Kit Ele (ID 26)** agora têm botão de adicionar ao carrinho, integrado ao fluxo oficial de sincronização de catálogo e carrinho, além do contato pelo WhatsApp.
- Os kits **Descoberta (ID 22)**, **Essência (ID 23)**, **Intensidade (ID 24)** e **Êxtase (ID 27)** permanecem com atendimento pelo WhatsApp, pois incluem a escolha da versão do Dado do Prazer.
- Mantido o botão de retorno ao catálogo nas seis páginas.
- Verificação estática confirmou que as páginas 25 e 26 carregam os scripts de carrinho e compra de produto, usam os IDs corretos e mantêm o contato pelo WhatsApp. As outras quatro páginas não receberam botão de compra direta.
- Não houve teste real em navegador; a validação funcional do clique, inclusão e abertura automática do carrinho permanece para a etapa de testes locais.


## 23. Auditoria de metadados e acessibilidade das páginas de produto

- As 27 páginas individuais possuem título, meta description, canonical próprio e metadados Open Graph de título, descrição e imagem.
- As imagens principais possuem texto alternativo descritivo. A página do Egg Masturbador também possui textos alternativos próprios para as três imagens adicionais da galeria.
- As 27 páginas apresentam dados estruturados `Product` e `BreadcrumbList` em JSON-LD parseável na revisão estática.
- Os scripts de carrinho, compra individual e consentimento estão presentes nas páginas que utilizam esse fluxo; os seis kits também carregam os scripts, respeitando a decisão de compra direta apenas para os kits 25 e 26.
- A revisão não substitui avaliação com leitor de tela, auditoria automatizada de acessibilidade, teste visual responsivo ou validação de rich results no Google.


## 24. Auditoria aprofundada da homepage e da Loja — revisão estática

### Homepage
- Conferida a hierarquia principal: um H1 editorial, CTAs para Loja e Atendimento, atalhos de categoria, seleção de quatro produtos em destaque e resumos de Atendimento e Sobre.
- Os seis atalhos de categoria usam os nomes aceitos pelo mecanismo de filtros e direcionam para parâmetros de URL compatíveis com a página Loja.
- Os quatro produtos destacados (IDs 11, 17, 22 e 24) existem no catálogo central e estão marcados como destaques.
- A homepage não carrega o grid completo do catálogo; mantém apenas a vitrine selecionada e encaminha o usuário para a Loja, evitando duplicação de navegação e excesso de produtos na página inicial.
- Os links de atendimento, entrega e Sobre apontam para páginas próprias. O carrinho e os scripts compartilhados permanecem integrados.

### Loja e descoberta de produtos
- A página apresenta título, descrição, canonical, Open Graph, dados estruturados `CollectionPage`, breadcrumb e navegação principal.
- A busca considera nome, tipo, categoria, descrição, marca, subtítulo e tags; ignora diferenças de acentuação e exige que todos os termos digitados estejam presentes no conteúdo pesquisável.
- Os parâmetros `categoria` e `q` são lidos na URL. Categorias só são aplicadas quando reconhecidas e possuem produtos; buscas são normalizadas e exibidas no campo.
- Os filtros são gerados conforme as categorias que realmente possuem produtos. Os botões usam `aria-pressed` e `aria-controls`, e o foco é preservado após a atualização dos filtros.
- O catálogo informa a quantidade de resultados e apresenta estado vazio com orientação para tentar outra busca ou consultar o atendimento.
- A ordenação atual prioriza produtos marcados como destaque e mantém a ordem original dos demais itens. Não existe controle visível para ordenar por preço, nome ou novidade; fica registrado como melhoria futura, não como falha funcional.
- No celular, os filtros passam a uma faixa horizontal rolável. A barra de rolagem é ocultada; avaliar posteriormente uma indicação visual discreta de que há mais filtros na horizontal.
- A região de resultados é anunciada por `aria-live`. Como a busca atualiza a lista a cada digitação, recomenda-se testar com leitor de tela se a frequência de anúncios é confortável; não foi alterada sem teste assistivo.

### Carrinho e integridade comercial
- O carrinho mantém persistência local e sincroniza nome, imagem, categoria, preço e disponibilidade com o catálogo atual.
- O checkout fica desabilitado enquanto o catálogo não foi confirmado ou quando há produto indisponível no carrinho.
- Produto esgotado ou sob consulta não deve seguir para finalização direta; divergências de preço são sinalizadas para revisão.
- A regra de frete exibida e calculada continua alinhada à condição comercial registrada: Bauru/SP, R$ 15,00 sem kit e frete grátis quando o pedido inclui pelo menos um kit; outras cidades têm frete a confirmar.
- A página Loja e a homepage reutilizam os mesmos scripts e IDs funcionais, sem duplicação da lógica de catálogo, modal, carrinho ou checkout.

### Resultado e limites
- Não foi identificado, nesta leitura estática, defeito inequívoco que justifique alterar regras comerciais ou a lógica central da busca, dos filtros e do carrinho.
- Melhorias de descoberta que podem ser avaliadas depois: ordenação explícita, indicação visual da rolagem horizontal dos filtros e teste da frequência de anúncios da busca para leitores de tela.
- A homepage não possui um bloco independente de chamada final; os CTAs existentes em Destaques, Atendimento e Sobre já oferecem caminhos de ação. A necessidade de um CTA final separado deve ser decidida após a avaliação visual, para não acrescentar repetição desnecessária.
- Esta auditoria foi feita por leitura dos arquivos e validações estáticas na branch `uiux-reformulacao`. Não equivale a teste visual ou funcional em navegador, teste em dispositivos reais, leitor de tela ou compra real.
- Nenhuma alteração foi feita na branch `main`, e a reformulação não foi publicada.


## 25. Auditoria de conversão e consistência comercial — revisão estática

- Revisadas as mensagens comerciais da homepage, Loja, Atendimento, FAQ e checkout, com foco em preços, frete, prazo, disponibilidade, pagamento, embalagem e conclusão do pedido.
- Confirmada a consistência da regra de entrega em Bauru: frete padrão de R$ 15,00 e gratuidade para pedidos que incluam pelo menos um kit. Para outras cidades, valor e disponibilidade permanecem sujeitos à confirmação.
- Confirmado que o subtotal exibido no carrinho se refere aos produtos e não inclui o frete; o checkout informa o custo aplicável a Bauru ou deixa o destino externo sujeito à confirmação.
- Ajustada a resposta do FAQ sobre prazo para deixar explícito que os prazos informados (até 30 minutos em Bauru e previsão de até 2 horas nas demais cidades atendidas) dependem de disponibilidade e validação do endereço/destino, em linha com a página Atendimento.
- Removida a repetição literal na resposta do FAQ sobre formas de pagamento; a mensagem agora informa de forma direta que as opções serão confirmadas no atendimento antes da conclusão.
- Reconfirmado que o envio da mensagem pelo WhatsApp não confirma automaticamente a compra nem processa o pagamento; disponibilidade, valores e condições finais são confirmados pelo atendimento.
- Mantidas as condições comerciais existentes. Não foram alterados preços, frete, prazos operacionais, política de embalagem ou formas de pagamento.
- Não foi feita análise jurídica da política de trocas/devoluções nem validação da operação real de entrega; esses temas exigem confirmação operacional e, se necessário, orientação profissional específica.
- Revisão estática dos textos e funções da branch `uiux-reformulacao`; não houve teste de compra real, navegação em navegador ou alteração na branch `main`.


## 26. Auditoria final estática de acessibilidade, SEO técnico e desempenho

- Revisadas as seis páginas principais (Início, Loja, Atendimento, Sobre, FAQ e Privacidade), as 27 páginas individuais de produto e as quatro páginas regionais.
- Nas 31 páginas de produto e região, todas apresentam título, descrição, canonical, Open Graph e exatamente um H1. As 27 páginas de produto possuem texto alternativo nas imagens principais; a galeria do Egg Masturbador também possui alts. Os blocos JSON-LD verificados nas páginas individuais e regionais são JSON válido.
- Nas páginas principais, títulos, descrições, canonical e hierarquia H1 foram encontrados. A página de Privacidade era a exceção na padronização de Open Graph e ícones; metadados Open Graph/Twitter e favicons foram adicionados.
- Identificado e corrigido erro de digitação no CSS responsivo mobile: a propriedade min-height do cabeçalho do carrinho estava dividida em dois tokens (8 e 2px) e, portanto, inválida. Valor corrigido para 82px.
- As imagens de catálogo em uso referenciam a pasta img/produtos/novas/, com arquivos JPG geralmente na faixa aproximada de 190–295 KB. O repositório ainda contém PNGs antigos de aproximadamente 1,2–2,4 MB; não foram excluídos nem substituídos porque não são necessários para corrigir a experiência e a remoção de ativos exige confirmação de que não há uso externo.
- Os scripts das páginas individuais são carregados no final do body, depois do conteúdo principal; não foi aplicada alteração indiscriminada para defer, evitando mudanças desnecessárias na ordem de inicialização.
- robots.txt permite rastreamento e aponta para o sitemap. O sitemap contém 37 URLs únicas; as URLs listadas correspondem a arquivos existentes na branch.
- Limites: revisão estática de marcação, referências, tamanhos informados pelo GitHub e sintaxe; não houve Lighthouse, medição de Core Web Vitals, teste com teclado/leitor de tela, validação de contraste automatizada, teste visual em navegador ou compra real.
- Nenhuma alteração na branch main; nenhuma publicação foi realizada.


## 27. Refinamento inicial da direção de arte — homepage

- Removida a composição de três fotografias sobrepostas e inclinadas no hero. A homepage passa a apresentar uma única imagem principal, reduzindo a sensação de produtos flutuando e evitando recortes conflitantes.
- A imagem principal do hero passou a usar proporção vertical 4:5 e `object-fit: contain`, preservando a composição original e evitando cortes do kit. O enquadramento foi ajustado também no breakpoint mobile.
- A imagem quadrada da marca foi retirada da seção de apresentação Sobre na homepage. Em seu lugar, foi criado um painel tipográfico responsivo com o nome Luxuriosa, assinatura “Sex Shop & Lingerie” e localização, integrado ao fundo escuro da identidade visual. Isso evita a aparência de uma fotografia quadrada encaixada no layout.
- O cabeçalho mantém o wordmark textual existente, que se adapta melhor a larguras menores; não foi criada uma nova versão raster da logo nem alterados favicons, imagens de perfil ou OG.
- As imagens de kits e produtos do catálogo não foram substituídas por imagens artificiais. A seleção final de fotografias reais será feita após o usuário fotografar os kits físicos.
- Arquivos alterados: `index.html`, `css/style.css` e `css/responsive.css`.
- Limite desta etapa: alteração estática de HTML/CSS; ainda é necessário validar visualmente em desktop e celular no navegador local. Nenhuma alteração na branch `main` e nenhuma publicação.


## 28. Direção visual das categorias e enquadramento dos cards

- As quatro categorias com fotografia passaram a usar imagens de produtos individuais já existentes: gel Xana Loka, vibrador Golfinho rosa, Dado do Prazer e Perfume Sensual Melancia. Os arquivos são decorativos nos links e usam `alt=""` para não duplicar os nomes acessíveis.
- Os cartões usam camada de contraste em degradê para manter os títulos legíveis sobre as fotografias. As categorias Kits especiais e Ver todo o catálogo receberam tratamento tipográfico/editorial sem foto de kit, evitando destacar montagens antigas nas quais alguns itens parecem suspensos.
- O recorte das imagens das categorias foi ajustado para priorizar o produto e reduzir a repetição da marca impressa no topo dos arquivos verticais.
- O enquadramento das imagens dos cards de produto também passou a priorizar a região central/inferior da fotografia, reduzindo a presença da marca repetida e mantendo o produto como foco.
- A fotografia do hero passou a usar preenchimento com recorte vertical controlado, priorizando a região do kit em vez da assinatura repetida no alto da arte. O arquivo original permanece intacto.
- Mantido o layout mobile em duas colunas para categorias, com dimensões compactas já definidas no breakpoint de 600px.
- Não foram alterados nomes, preços, descrições, estoque, IDs, links de categoria ou regras de compra.
- Arquivos alterados nesta etapa: `index.html` e `css/style.css`. O breakpoint mobile existente foi revisado e já contemplava duas colunas.
- Limite: ajustes estáticos de HTML/CSS; os recortes precisam ser conferidos no navegador em diferentes larguras antes da aprovação. As imagens dos kits serão substituídas por fotografias reais quando o usuário as produzir.
- Nenhuma alteração na branch `main`; nenhuma publicação.


## 29. Padronização visual das páginas individuais de produto

- Criada a folha compartilhada `css/produto.css`, aplicada às 27 páginas individuais de produto.
- Refinada a apresentação da página: área de imagem com fundo editorial discreto, melhor hierarquia de título/categoria/marca/preço, ações de compra mais organizadas e bloco de descrição separado visualmente.
- A imagem permanece em `object-fit: contain`, sem alteração dos arquivos ou dos recortes originais.
- A área de recomendações recebeu acabamento visual alinhado à identidade vinho, preto e dourado.
- No mobile, a imagem aparece antes das informações, os botões ocupam a largura disponível e o layout passa a uma coluna.
- Não foram alterados nomes, descrições, preços, disponibilidade, IDs, dados estruturados, URLs, estoque, regras de compra ou mensagens de WhatsApp.
- A alteração é exclusivamente visual. A validação visual em navegador das páginas individuais ainda precisa ser feita pelo usuário em desktop e mobile.
- Nenhuma alteração na branch `main`; nenhuma publicação.


## 30. Refinamento da página Sobre — painel de identidade visual

- Substituída a imagem quadrada antiga da logo no hero da página Sobre por um painel tipográfico construído em HTML e CSS, seguindo a solução já aprovada na homepage.
- O painel apresenta a assinatura Luxuriosa, a identificação “Sex Shop & Lingerie”, a localização Bauru · SP e o slogan “Sinta-se ainda mais você.”
- A composição é responsiva e não depende de uma nova imagem; o arquivo original foi preservado no repositório.
- Não foram alterados o texto institucional, os princípios da marca, os metadados SEO, os links ou os demais conteúdos da página.
- Alteração visual estática na branch uiux-reformulacao; requer validação do usuário em desktop e mobile. Nenhuma alteração na branch main e nenhuma publicação.


## 31. Refinamento editorial da página Sobre

- Removido o painel tipográfico grande do hero, que repetia a assinatura visual da homepage e competia com a história da marca.
- Hero reorganizado em uma composição editorial simples, com título em destaque, texto introdutório e assinatura discreta da marca.
- História mantida integralmente e apresentada em uma coluna de leitura confortável.
- Princípios de respeito, cuidado e privacidade mantidos em cartões mais leves.
- Slogan e chamadas para Loja e Atendimento concentrados no fechamento da página.
- Preservados conteúdo institucional, metadados SEO, JSON-LD, navegação e links existentes.
- Nenhuma imagem genérica foi adicionada; a página fica preparada para receber fotografia própria no futuro, caso faça sentido.
- Alteração visual estática na branch `uiux-reformulacao`; depende de validação do usuário em desktop e mobile. Nenhuma alteração na branch `main` e nenhuma publicação.
