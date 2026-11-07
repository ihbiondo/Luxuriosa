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
