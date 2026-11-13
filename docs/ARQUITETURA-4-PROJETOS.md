# Arquitetura oficial — 4 projetos Luxuriosa

**Status:** mapeamento técnico e convenção de nomenclatura  
**Repositório de referência:** `ihbiondo/Luxuriosa`  
**Backend compartilhado:** Supabase `byiykxfugvxuowueuxca`  
**Portal interno:** `/442/`

Este documento é a referência para separar responsabilidades e nomes. Slugs e rotas históricas podem permanecer como aliases, mas ações de backend que duplicavam responsabilidades foram removidas após a migração dos consumidores.

## 1. Os quatro projetos

| Nº | Nome oficial | Responsabilidade principal | O que não deve fazer |
|---|---|---|---|
| 1 | **Loja Luxuriosa** | Presença pública, catálogo, páginas de produto, conta do cliente, carrinho e início da compra | Administrar estoque interno, conciliar pagamentos manualmente ou calcular indicadores gerenciais |
| 2 | **Pedidos Online** | Criar e acompanhar pedidos do site, confirmação/conciliação de pagamento, vínculo comercial, etapas de separação/entrega e ocorrências | Manter livro de vendas do caixa, emitir relatórios financeiros, calcular ticket médio, série de faturamento ou produtos mais vendidos |
| 3 | **Lux-Gestão** | Operação interna: PDV/caixa, vendas presenciais, despesas, estoque, custos, composição de kits e movimentações | Criar links de checkout do site ou declarar pagamento online como aprovado sem validação do provedor |
| 4 | **Luxuriosa Inteligência** | Indicadores, análise financeira/comercial, comportamento agregado, alertas e recomendações para decisão | Editar pedidos, confirmar pagamentos, movimentar estoque ou substituir os registros transacionais |

### 1.1 Portal de acesso não é um quinto projeto

**Portal 442** é somente a porta de entrada para os sistemas. Não é o nome do painel de inteligência nem uma base de dados própria.

## 2. Endereços e implantação observados

| Projeto | Endereço / implantação atual | Situação técnica |
|---|---|---|
| Loja Luxuriosa | `https://luxuriosa.com.br/` | Site estático no GitHub Pages; catálogo em `data/produtos.json`; páginas públicas no mesmo repositório |
| Pedidos Online | `https://luxuriosa.com.br/lux-gestao-pedidos/` | Aplicação estática no GitHub Pages; integra com Edge Functions do Supabase |
| Lux-Gestão | `https://luxuriosa.com.br/lux-gestao/` | Cloudflare Worker; o código-fonte do Worker não foi localizado no repositório GitHub inspecionado |
| Luxuriosa Inteligência | `https://luxuriosa.com.br/lux-central/` → `/previa/lux-central/` | Interface executiva estática; `/lux-central/` e `/previa/lux-central/` são identificadores de rota legados, não nomes de produto |
| Portal 442 | `https://luxuriosa.com.br/442/` | Página estática de navegação para os três ambientes administrativos |

**Observação importante:** existe também o aplicativo desktop Tauri chamado Luxuriosa Gestão no ambiente local informado anteriormente. Ele deve ser tratado como cliente desktop/implementação paralela do projeto **Lux-Gestão**, e não como um quinto produto. Antes de unificar ou desativar qualquer cliente, é necessário conferir sua versão local, esquema SQLite e sincronização efetiva com o Supabase.

## 3. Fonte de verdade por domínio

### Pedidos e pagamentos online
- `orders`: registro do pedido do site.
- `order_items`: itens e snapshot do pedido.
- `payment_status`: estado financeiro do pedido.
- `status`: etapa operacional do pedido (confirmação, processamento, saída para entrega, entregue ou cancelado).
- `payment_provider_events`: evidências/eventos recebidos do provedor.
- `infinitepay-webhook`, `payment-status`, `create-payment-order`, `cart-orders`: funções do fluxo online.
- `orders-admin` v28: endpoint administrativo autenticado para a fila de pedidos, detalhes, vínculo de cliente, confirmação financeira/operacional, sincronização, bloqueios de estoque e ciclo de entrega. `admin_orders_list` retorna somente dados operacionais da fila; `admin_dashboard` foi removido.
- `cart-orders` v34: endpoint público da Loja para registrar eventos de navegação/carrinho e etapas de checkout, conforme consentimentos aplicáveis. Não possui ações administrativas, dashboards ou motor de indicadores.
- `payment-admin`: consulta/conciliação administrativa. O slug permanece por compatibilidade, mas pertence conceitualmente a **Pedidos Online**.

**Regra:** situação financeira e etapa de entrega são dimensões independentes. Pedido não é sinônimo de pagamento. A aprovação de pagamento online depende de validação/concilição da InfinitePay. A tela Pedidos não mantém livro de vendas do caixa, métricas de faturamento, ticket médio, série diária ou ranking de produtos; isso pertence ao Lux-Gestão (registro oficial) e à Inteligência (análise).

### Operação interna — Lux-Gestão
- `management_sales`: livro operacional de vendas do caixa e vendas online sincronizadas.
- `management_inventory`, `management_inventory_movements`: saldo e histórico de estoque.
- `management_product_costs`: custos unitários cadastrados.
- `management_kit_components`: composição de kits.
- `management_expenses`: despesas operacionais.
- `management_customers`, `management_customer_addresses`: cadastro comercial, contatos e endereços.
- `management-sales`: API de operação da Gestão: caixa, vendas, comprovantes, clientes, custos, estoque, kits e despesas.

**Regra:** Gestão mantém e executa registros operacionais. A lista/ficha de clientes mostra cadastro, endereços, contagem simples de registros e histórico individual de vendas/pedidos, com itens, brindes, pagamento e etapa de entrega. Não calcula nem apresenta frequência paga, valor bruto acumulado, ticket médio, recência, estágio de relacionamento, consumo agregado, RFV ou recomendações. Esses indicadores pertencem à Inteligência. O backend `management-sales` não calcula nem retorna agregados comportamentais; ações analíticas antigas respondem HTTP 410.

Vendas presenciais nascem na Gestão. Pedidos online nascem em Pedidos Online e, após confirmação do pagamento e sincronização idempotente, aparecem no livro operacional sem criar uma segunda venda ou cobrança.

### Inteligência — Luxuriosa Inteligência
- `luxuriosa-intelligence`: endpoint dedicado e autenticado para indicadores, análise financeira/comercial, comportamento agregado, preferências autorizadas, RFV e recomendações comerciais.
- `analytics`: consolidação de vendas, custos, despesas, estoque, pedidos e sinais digitais; somente leitura.
- `customer-insights`: preferências, eventos e compras agregadas com consentimento aplicável.
- **RFV por cliente:** responsabilidade exclusiva da Inteligência. Deve usar somente transações pagas e vínculos explícitos; presentes/brindes não contam como frequência, valor ou evidência de recompra. A Gestão não executa nem exibe a segmentação.
- A Inteligência pode ler as fontes operacionais e produzir interpretações, mas não altera pedidos, pagamentos, vendas, clientes, custos, despesas ou estoque.
- Métricas distinguem valores confirmados, pendentes, cancelados e dados incompletos. Ausência de dados não deve ser apresentada como desempenho zero sem explicação.

### Loja e relacionamento
- `profiles`, `addresses`, `preferences`, `user_permissions`: conta, endereço, preferências e permissões.
- `cart_sessions`, `site_events`: carrinho e eventos de navegação.
- `account_data_consents`, `contact_consents`, `club_intimate_consent_events`: registros de consentimento. Dados sensíveis/intimidade devem permanecer sob finalidade e autorização explícitas, sem exposição em painéis agregados.

## 4. Contradições de nomenclatura e correções

| Encontrado | Problema | Convenção corrigida |
|---|---|---|
| **Lux-Central** usado como nome do produto e **Inteligência** como categoria | Dois nomes para o mesmo painel confundem o usuário | Nome único do produto: **Luxuriosa Inteligência**; `/lux-central/` e `/previa/lux-central/` permanecem como rotas legadas |
| **Lux-Gestão** descrito como responsável por “pagamentos” | Pode sugerir que o Worker aprova cobranças online | Gestão cuida do caixa e registros operacionais; **Pedidos Online** cuida do checkout e conciliação InfinitePay |
| **Pedidos Online** aparece como parte da Gestão em alguns títulos/rotas | Mistura sistemas e dificulta suporte | É projeto próprio; manter `/lux-gestao-pedidos/` apenas como URL histórica |
| **management-sales** tem slug histórico amplo | O nome técnico não descreve o contrato operacional atual | Manter slug por compatibilidade; cadastro, caixa, estoque, custos, kits e despesas ficam na Gestão; analytics/RFV são responsabilidade da Inteligência |
| **Portal 442** chamado de Central de Operação | Pode ser confundido com Luxuriosa Inteligência | Nome funcional: **Portal 442 — Acesso aos sistemas** |
| Aplicativo Tauri “Luxuriosa Gestão” e Worker “Lux-Gestão” | Mesmo nome, clientes e implantações distintas | Ambos pertencem ao projeto **Lux-Gestão**; distinguir como “Gestão Desktop (Tauri)” e “Gestão Web (Worker)” até validar paridade |

## 5. Vocabulário oficial da interface

- **Pedido:** solicitação de compra feita pelo cliente.
- **Pagamento:** transação financeira associada ao pedido.
- **Confirmação de pagamento:** validação do provedor.
- **Separação:** conferência e preparação dos itens.
- **Entrega:** deslocamento e conclusão do atendimento.
- **Venda:** registro financeiro/operacional no caixa.
- **Estoque:** saldo físico controlado e seu histórico de movimentações.
- **Custo:** custo de aquisição cadastrado para cálculo de margem.
- **Faturamento:** valor bruto vendido no período, com critério explicitado.
- **Lucro:** somente apresentar quando custos e despesas relevantes estiverem cadastrados; caso contrário, identificar como estimativa ou dado incompleto.

Evitar usar “venda”, “pedido”, “pagamento” e “entrega” como sinônimos.

## 6. Estado operacional observado no mapeamento

Os números desta seção são a fotografia do mapeamento inicial, não um painel de situação atual. Não devem ser usados como saldo/contagem corrente sem nova consulta ao banco.

- 8 pedidos em `orders` na fotografia inicial.
- 0 eventos registrados em `payment_provider_events` na fotografia inicial.
- 0 vendas em `management_sales` na fotografia inicial.
- 29 produtos cadastrados em `management_inventory`; controle de estoque ainda desabilitado nas linhas observadas.
- 4 custos cadastrados em `management_product_costs`.
- 0 composições em `management_kit_components`.
- 18 sessões de carrinho em `cart_sessions`.
- 264 eventos em `site_events`.
- 8 Edge Functions ativas no projeto Supabase, incluindo funções de produção e funções isoladas de teste InfinitePay.

**Interpretação:** o banco e as funções existem, mas isso não comprova por si só que o fluxo completo esteja sendo usado em produção. O estado de estoque zerado/desabilitado não deve ser tratado como contagem física real.

## 7. Regras de arquitetura daqui em diante

1. Cada projeto tem uma responsabilidade e um nome oficial.
2. O Supabase é compartilhado; não criar cópias paralelas de clientes, pedidos ou pagamentos.
3. O domínio de pedidos/pagamentos é separado do domínio de caixa/estoque.
4. A Inteligência é leitura e análise; não altera transações.
5. A Loja é pública; os três ambientes administrativos exigem autenticação e autorização.
6. Não renomear tabela, Edge Function, Worker ou URL sem plano de compatibilidade, atualização de consumidores e testes.
7. Toda alteração começa pela identificação do projeto proprietário, dependências e fonte de verdade.
8. O Portal 442 deve exibir os quatro destinos: Loja pública e os três sistemas internos, mas deixar claro que somente três são ferramentas administrativas.

## 8. Próximas etapas técnicas

1. Atualizar os rótulos visíveis do Portal 442 e das telas para os nomes oficiais, mantendo URLs antigas.
2. Obter e versionar o código-fonte do Worker Lux-Gestão no repositório, com processo seguro de publicação.
3. Mapear o aplicativo desktop Tauri e decidir se será mantido como cliente sincronizado ou aposentado.
4. Separar gradualmente ações de `management-sales` por domínio sem quebrar contratos existentes.
5. Validar ponta a ponta: Loja → pedido → checkout InfinitePay → webhook/consulta → sincronização para Gestão → indicadores na Inteligência.


### Contratos administrativos — estado final de 13/11/2026

- `orders-admin` v28: a fila Pedidos usa somente `admin_orders_list`. Confirmação manual, reconciliação, sincronização, recuperação de estoque, atualização de etapa, ocorrências e vínculo de cliente permanecem no mesmo domínio. A ação analítica `admin_dashboard` foi removida depois da migração de produção e prévia.
- `cart-orders` v34: recebe apenas eventos de navegação/carrinho e etapas públicas de checkout. As antigas ações administrativas `admin_dashboard`, `admin_live_activity`, `admin_intelligence` e `admin_update_order_status` foram removidas do endpoint e do espelho versionado.
- `management-sales` v51: mantém o livro de vendas, clientes, custos, kits, estoque e despesas; a lista/ficha de clientes contém somente cadastro, contagens simples e histórico individual com itens. Não calcula nem devolve RFV, recomendações ou agregados comportamentais. Ações analíticas antigas respondem HTTP 410.
- `luxuriosa-intelligence` v21: mantém analytics financeiro/comercial, comportamento e RFV; é leitura e não altera transações.
- JWT e papel administrativo são obrigatórios nos três endpoints administrativos (`orders-admin`, `management-sales` e `luxuriosa-intelligence`). `cart-orders` é público apenas para coleta de carrinho/eventos, conforme consentimentos aplicáveis.

## 9. Fronteira funcional consolidada — atualização 13/11/2026

Esta seção prevalece sobre descrições históricas anteriores neste documento.

| Projeto | Pode manter | Não deve assumir |
|---|---|---|
| Loja Luxuriosa | Catálogo público, conteúdo, conta do cliente, carrinho e início da compra | Estoque interno, conciliação administrativa, venda de caixa ou inteligência gerencial |
| Pedidos Online | Pedidos, checkout, confirmação de pagamento, expedição e trilha de ocorrências | Cadastro operacional geral, caixa presencial, estoque físico ou relatórios executivos |
| Lux-Gestão | Cadastro comercial, endereços, vendas, comprovantes, custos, kits, estoque e despesas | RFV, recomendações, funil digital, carrinhos abandonados ou painel executivo |
| Luxuriosa Inteligência | Indicadores, rentabilidade analítica, RFV, comportamento, alertas, oportunidades e recuperação comercial | Gravar ou alterar transações operacionais |

**RFV transferido:** o cálculo e as recomendações pertencem à ação autenticada `customer-rfv` da `luxuriosa-intelligence`. A Gestão mantém cadastro e histórico transacional, sem scoring comercial.

**Lux-Central:** não é um quinto sistema. Funil, eventos, abandono de carrinho e recuperação comercial são módulos da Luxuriosa Inteligência. `cart-orders` registra eventos/snapshots de origem; a Inteligência lê essas fontes para consolidar e interpretar os indicadores. O nome antigo permanece apenas em slugs, rotas e identificadores técnicos até migração compatível.

**Portal 442:** catálogo de acesso aos quatro projetos, com distinção visual entre a Loja pública e os três ambientes administrativos. Não possui regras comerciais nem motor analítico próprio.

**Infraestrutura:** Supabase, GitHub e Cloudflare são serviços compartilhados, não projetos funcionais adicionais. O desktop Tauri é um cliente legado do projeto Lux-Gestão, não outro sistema; não recebe novas funcionalidades enquanto não houver decisão explícita de retomada.


### RFV e separação operacional — estado final 13/11/2026

- Ação de leitura: `luxuriosa-intelligence` / `customer-rfv`, protegida por JWT e papel administrativo.
- A implementação é compartilhada em `supabase/functions/_shared/customer-rfv.mjs`, com testes unitários.
- A Gestão mantém apenas histórico individual por transação e contagens simples de registros; não faz agregação de frequência, valor, ticket, recência ou consumo de produtos por cliente.
- RFV usa histórico de vendas pagas e pedidos explicitamente vinculados; sincronizações online são deduplicadas.
- Sugestões de produto usam apenas pedidos pagos de contas com consentimento de personalização v2 vigente.
- Gestão mantém cadastro e histórico, e não exibe nem calcula RFV.
- A antiga tela de Relatórios da Gestão foi substituída por Custos e despesas. A home da Gestão é operacional. A Inteligência é a tela executiva/analítica.
- Produção e prévia da fila de Pedidos usam `orders-admin` / `admin_orders_list`, sem livro de vendas ou métricas de faturamento; confirmação financeira, sincronização, bloqueios de estoque e ciclo de entrega permanecem no fluxo do pedido.
- As fontes canônicas e versões ativas foram conferidas: `cart-orders` v34, `orders-admin` v28, `management-sales` v51 e `luxuriosa-intelligence` v21. Os arquivos implantados correspondem às fontes versionadas.
