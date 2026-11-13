# Arquitetura oficial — 4 projetos Luxuriosa

**Status:** mapeamento técnico e convenção de nomenclatura  
**Repositório de referência:** `ihbiondo/Luxuriosa`  
**Backend compartilhado:** Supabase `byiykxfugvxuowueuxca`  
**Portal interno:** `/442/`

Este documento passa a ser a referência para separar responsabilidades e nomes. Ele não renomeia tabelas, funções, domínios ou rotas em produção: identificadores técnicos antigos permanecem como compatibilidade até uma migração planejada.

## 1. Os quatro projetos

| Nº | Nome oficial | Responsabilidade principal | O que não deve fazer |
|---|---|---|---|
| 1 | **Loja Luxuriosa** | Presença pública, catálogo, páginas de produto, conta do cliente, carrinho e início da compra | Administrar estoque interno, conciliar pagamentos manualmente ou calcular indicadores gerenciais |
| 2 | **Pedidos Online** | Criar e acompanhar pedidos do site, checkout, links InfinitePay, confirmação/consulta de pagamento, notificações e fluxo de separação/entrega | Ser o caixa de vendas presenciais ou a fonte de relatórios gerenciais |
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
- `orders-admin`: endpoint autenticado para atualização de etapa operacional; `cart-orders` mantém a ação antiga temporariamente como compatibilidade.
- `payment-admin`: consulta/conciliação administrativa. O slug permanece por compatibilidade, mas pertence conceitualmente a **Pedidos Online**.

**Regra:** situação financeira e etapa de entrega são dimensões independentes. Pedido não é sinônimo de pagamento. A aprovação de pagamento online depende de validação da InfinitePay, não de alteração manual no painel.

### Operação interna — Lux-Gestão
- `management_sales`: livro operacional de vendas do caixa e vendas online sincronizadas.
- `management_inventory`, `management_inventory_movements`: saldo e histórico de estoque.
- `management_product_costs`: custos unitários cadastrados.
- `management_kit_components`: composição de kits.
- `management_expenses`: despesas operacionais.
- `management_customers`, `management_customer_addresses`: cadastro comercial, contatos e endereços.
- `management-sales`: API de operação da Gestão: caixa, vendas, comprovantes, clientes, custos, estoque, kits e despesas.

**Regra:** Gestão mantém e executa registros operacionais. Seu histórico de cliente pode mostrar compras vinculadas e itens pagos/brindes separados, mas não deve apresentar segmentação RFV, scoring, recomendações, análise de comportamento ou oportunidades comerciais. Campos RFV/recomendações ainda emitidos por `customer-get` e `customers-list` são compatibilidade técnica temporária; não são a fonte oficial de inteligência e serão retirados após a migração do consumidor.

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
| **management-sales** serve vendas, estoque e parte de inteligência | O nome técnico não descreve toda a API | Manter slug para compatibilidade; documentar os domínios e separar ações/endpoints gradualmente |
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

Contagens são fotografia do banco no momento da inspeção; não são metas nem garantias de operação concluída.

- 8 pedidos em `orders`.
- 0 eventos registrados em `payment_provider_events` no momento da inspeção.
- 0 vendas em `management_sales` no momento da inspeção.
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


### Separação do dashboard administrativo

A ação `admin_dashboard` é atendida pelo endpoint autenticado `orders-admin`. O endpoint legado `cart-orders` mantém a ação por compatibilidade temporária; a interface Pedidos Online utiliza o endpoint dedicado. Consultas de atividade ao vivo e inteligência permanecem no legado até suas respectivas migrações e validações.


## 9. Fronteira funcional consolidada — atualização 13/11/2026

Esta seção prevalece sobre descrições históricas anteriores neste documento.

| Projeto | Pode manter | Não deve assumir |
|---|---|---|
| Loja Luxuriosa | Catálogo público, conteúdo, conta do cliente, carrinho e início da compra | Estoque interno, conciliação administrativa, venda de caixa ou inteligência gerencial |
| Pedidos Online | Pedidos, checkout, confirmação de pagamento, expedição e trilha de ocorrências | Cadastro operacional geral, caixa presencial, estoque físico ou relatórios executivos |
| Lux-Gestão | Cadastro comercial, endereços, vendas, comprovantes, custos, kits, estoque e despesas | RFV, recomendações, funil digital, carrinhos abandonados ou painel executivo |
| Luxuriosa Inteligência | Indicadores, rentabilidade analítica, RFV, comportamento, alertas, oportunidades e recuperação comercial | Gravar ou alterar transações operacionais |

**RFV transferido:** a ação autenticada `customer-rfv` da Luxuriosa Inteligência calcula segmentação e recomendações. `management-sales` não calcula nem devolve RFV. Gestão mantém cadastro e histórico transacional.

**Lux-Central:** não é um quinto sistema. Funil, eventos, abandono de carrinho e recuperação comercial são módulos da Luxuriosa Inteligência. O nome antigo permanece apenas em slugs, rotas e identificadores técnicos até migração compatível.

**Portal 442:** catálogo de acesso aos quatro projetos, com distinção visual entre a Loja pública e os três ambientes administrativos. Não possui regras comerciais nem motor analítico próprio.

**Infraestrutura:** Supabase, GitHub e Cloudflare são serviços compartilhados, não projetos funcionais adicionais. O desktop Tauri é um cliente legado do projeto Lux-Gestão, não outro sistema; não recebe novas funcionalidades enquanto não houver decisão explícita de retomada.


### RFV transferido — atualização 13/11/2026

- Ação de leitura: `luxuriosa-intelligence` / `customer-rfv`, protegida por JWT e papel administrativo.
- A implementação é compartilhada em `supabase/functions/_shared/customer-rfv.mjs`, com testes unitários.
- RFV usa histórico de vendas pagas e pedidos explicitamente vinculados; sincronizações online são deduplicadas.
- Sugestões de produto usam apenas pedidos pagos de contas com consentimento de personalização v2 vigente.
- Gestão mantém cadastro e histórico, e não exibe nem calcula RFV.
- A antiga tela de Relatórios da Gestão foi substituída por Custos e despesas. A Inteligência é a tela executiva/analítica.


### Pedidos Online — escopo operacional

- A fila de Pedidos administra pedidos, confirmação/concilição do pagamento, etapas de separação/entrega, ocorrências e vínculo explícito do cliente.
- O painel não mantém um livro de vendas do caixa nem apresenta faturamento, ticket médio, série diária ou produtos mais vendidos. O registro oficial de vendas e comprovantes pertence ao Lux-Gestão; a análise financeira pertence à Luxuriosa Inteligência.
- A integração de Pedidos com Gestão limita-se a sincronizar a venda paga e verificar o estado da baixa de estoque para liberar a expedição. O detalhe de sincronização é exibido no pedido porque bloqueia/autoriza a operação, não para duplicar o caixa.
