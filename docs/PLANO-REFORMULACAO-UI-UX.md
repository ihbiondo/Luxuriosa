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
