// Pure RFV domain logic shared by the Luxuriosa Intelligence Edge Function and Node tests.
// Monetary inputs are integer cents. Only confirmed paid transactions belong in this model.

export const RFV_MODEL_VERSION = "RFV-1.0";

export const PRODUCT_INTEREST_MAP = {
  "1": "jogos_brincadeiras", "2": "jogos_brincadeiras", "3": "jogos_brincadeiras",
  "4": "acessorios_casais", "5": "acessorios_casais",
  "7": "geles_lubrificantes", "8": "estimulacao", "9": "estimulacao",
  "10": "kits_presentes", "11": "estimulacao", "12": "geles_lubrificantes",
  "13": "geles_lubrificantes", "14": "estimulacao", "15": "estimulacao",
  "16": "cosmeticos_sensuais", "17": "estimulacao", "18": "estimulacao",
  "19": "estimulacao", "20": "estimulacao",
  "22": "kits_presentes", "23": "kits_presentes", "24": "kits_presentes",
  "25": "kits_presentes", "26": "kits_presentes", "27": "kits_presentes",
  "28": "kits_presentes", "29": "kits_presentes"
};

const CUSTOMER_INTERESTS = [
  { key: "cosmeticos_sensuais", label: "Cosméticos sensuais" },
  { key: "geles_lubrificantes", label: "Géis e lubrificantes" },
  { key: "acessorios_casais", label: "Acessórios para casais" },
  { key: "jogos_brincadeiras", label: "Jogos e brincadeiras" },
  { key: "massagem_relaxamento", label: "Massagem e relaxamento" },
  { key: "estimulacao", label: "Produtos de estimulação" },
  { key: "fantasias_acessorios", label: "Fantasias e acessórios" },
  { key: "higiene_intima", label: "Higiene íntima" },
  { key: "kits_presentes", label: "Kits e presentes" }
];

const CUSTOMER_COMPLEMENTARY_CATEGORIES = {
  geles_lubrificantes: ["acessorios_casais", "massagem_relaxamento"],
  acessorios_casais: ["geles_lubrificantes", "jogos_brincadeiras"],
  estimulacao: ["geles_lubrificantes", "massagem_relaxamento"],
  jogos_brincadeiras: ["acessorios_casais", "geles_lubrificantes"],
  cosmeticos_sensuais: ["massagem_relaxamento", "geles_lubrificantes"],
  massagem_relaxamento: ["cosmeticos_sensuais", "geles_lubrificantes"],
  fantasias_acessorios: ["acessorios_casais", "kits_presentes"],
  kits_presentes: ["geles_lubrificantes", "acessorios_casais"]
};


export function excludeKnownTestTransactions(sales = [], orders = [], knownTestOrderIds = []) {
  const known = new Set(knownTestOrderIds.map(String));
  const excludedOrders = orders.filter(order => known.has(String(order.id)));
  const excludedOrderIds = new Set(excludedOrders.map(order => String(order.id)));
  const excludedSaleIds = new Set(excludedOrders.map(order => order.management_sale_id).filter(Boolean).map(String));
  return {
    sales: sales.filter(sale =>
      !(sale.source_order_id && excludedOrderIds.has(String(sale.source_order_id))) &&
      !excludedSaleIds.has(String(sale.id))
    ),
    orders: orders.filter(order => !excludedOrderIds.has(String(order.id)))
  };
}

export function scoreCustomerRfv(input) {
  const frequency = Math.max(0, Number(input?.paid_purchase_count) || 0);
  const monetary = Math.max(0, Number(input?.paid_gross_cents) || 0);
  const recencyDays = input?.days_since_last_purchase;

  if (!frequency) {
    return {
      model_version: RFV_MODEL_VERSION,
      r_score: 0, f_score: 0, v_score: 0, score_code: null,
      segment: "no_purchase",
      segment_label: "Sem histórico pago",
      segment_description: "Ainda não há compra com pagamento confirmado vinculada a este cadastro."
    };
  }

  const r = recencyDays === null || recencyDays === undefined
    ? 0
    : recencyDays <= 30 ? 5
    : recencyDays <= 60 ? 4
    : recencyDays <= 90 ? 3
    : recencyDays <= 180 ? 2 : 1;

  const frequencyScore = frequency >= 8 ? 5
    : frequency >= 5 ? 4
    : frequency >= 3 ? 3
    : frequency >= 2 ? 2 : 1;

  const valueScore = monetary >= 35000 ? 5
    : monetary >= 20000 ? 4
    : monetary >= 10000 ? 3
    : monetary >= 5000 ? 2 : 1;

  let segment = "regular";
  if (r >= 4 && frequencyScore >= 4 && valueScore >= 4) segment = "champion";
  else if (r <= 2 && valueScore >= 4) segment = "high_value_at_risk";
  else if (r <= 2 && frequencyScore >= 2) segment = "at_risk";
  else if (r === 1 && frequencyScore <= 2) segment = "hibernating";
  else if (frequencyScore >= 4 && r >= 3) segment = "loyal";
  else if (frequencyScore === 1 && r >= 4) segment = "new_customer";
  else if (r >= 4 && frequencyScore >= 2) segment = "potential_loyal";

  const labels = {
    champion: { label: "Campeão", description: "Compra recente, recorrente e com alto valor acumulado." },
    loyal: { label: "Fiel", description: "Compra com frequência; vale preservar a experiência e a confiança." },
    potential_loyal: { label: "Potencial fiel", description: "Já voltou a comprar e está ativo; pode desenvolver recorrência." },
    new_customer: { label: "Novo cliente", description: "Uma compra paga recente; priorize uma boa experiência inicial." },
    high_value_at_risk: { label: "Alto valor em risco", description: "Histórico de alto valor, mas sem compra recente." },
    at_risk: { label: "Em risco", description: "Já comprou mais de uma vez, porém está há algum tempo sem voltar." },
    hibernating: { label: "Hibernando", description: "Poucas compras e longo período sem atividade paga." },
    regular: { label: "Regular", description: "Relacionamento ativo ou histórico ainda sem padrão forte de recorrência." }
  };

  return {
    model_version: RFV_MODEL_VERSION,
    r_score: r, f_score: frequencyScore, v_score: valueScore,
    score_code: String(r) + String(frequencyScore) + String(valueScore),
    segment,
    segment_label: labels[segment].label,
    segment_description: labels[segment].description
  };
}

export function summarizeCustomerRelationship(sales = [], orders = [], now = Date.now()) {
  const linkedOrderIds = new Set(orders.map(order => order.id).filter(Boolean));
  const linkedSaleIds = new Set(orders.map(order => order.management_sale_id).filter(Boolean));
  const standaloneSales = sales.filter(sale =>
    !(sale.source_order_id && linkedOrderIds.has(sale.source_order_id)) &&
    !linkedSaleIds.has(sale.id)
  );

  const events = [];
  let pendingTransactionCount = 0;

  for (const sale of standaloneSales) {
    if (sale.payment_status === "paid") {
      events.push({
        id: "sale:" + sale.id, channel: "cash",
        at: sale.paid_at || sale.created_at,
        amount_cents: Math.max(0, Number(sale.total_cents) || 0)
      });
    } else if (sale.payment_status === "pending") {
      pendingTransactionCount += 1;
    }
  }

  for (const order of orders) {
    if (order.payment_status === "paid") {
      const amount = Number(order.total_amount);
      events.push({
        id: "order:" + order.id, channel: "online",
        at: order.paid_at || order.created_at,
        amount_cents: Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0
      });
    } else if (order.payment_status === "pending" || order.payment_status === "review_required") {
      pendingTransactionCount += 1;
    }
  }

  const uniqueEvents = [...new Map(events.map(event => [event.id, event])).values()]
    .filter(event => event.at && Number.isFinite(Date.parse(event.at)))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const paidCashCount = uniqueEvents.filter(event => event.channel === "cash").length;
  const paidOnlineCount = uniqueEvents.filter(event => event.channel === "online").length;
  const paidGrossCents = uniqueEvents.reduce((sum, event) => sum + event.amount_cents, 0);
  const intervals = [];
  for (let index = 1; index < uniqueEvents.length; index += 1) {
    const days = (Date.parse(uniqueEvents[index].at) - Date.parse(uniqueEvents[index - 1].at)) / 86400000;
    if (Number.isFinite(days) && days >= 0) intervals.push(days);
  }

  const firstPurchaseAt = uniqueEvents[0]?.at || null;
  const lastPurchaseAt = uniqueEvents.at(-1)?.at || null;
  const daysSinceLastPurchase = lastPurchaseAt
    ? Math.max(0, Math.floor((now - Date.parse(lastPurchaseAt)) / 86400000))
    : null;
  const paidPurchaseCount = uniqueEvents.length;

  const summary = {
    paid_purchase_count: paidPurchaseCount,
    paid_cash_count: paidCashCount,
    paid_online_count: paidOnlineCount,
    paid_gross_cents: paidGrossCents,
    average_ticket_cents: paidPurchaseCount ? Math.round(paidGrossCents / paidPurchaseCount) : 0,
    first_purchase_at: firstPurchaseAt,
    last_purchase_at: lastPurchaseAt,
    days_since_last_purchase: daysSinceLastPurchase,
    average_interval_days: intervals.length
      ? Math.round((intervals.reduce((sum, days) => sum + days, 0) / intervals.length) * 10) / 10
      : null,
    pending_transaction_count: pendingTransactionCount
  };
  summary.rfv = scoreCustomerRfv(summary);
  return { standalone_sales: standaloneSales, summary, paid_events: uniqueEvents };
}

// Product-level suggestions are intentionally built only from paid orders that passed
// the caller's explicit personalization-consent check. Gifts, freight and kit components
// never become paid purchase evidence.
export function summarizeConsentedPaidProducts(orders = [], orderItems = []) {
  const paidOrders = new Map(orders.filter(order => order.payment_status === "paid").map(order => [String(order.id), order]));
  const products = new Map();

  for (const item of orderItems) {
    const order = paidOrders.get(String(item.order_id));
    if (!order) continue;
    const snapshot = item?.product_snapshot && typeof item.product_snapshot === "object" && !Array.isArray(item.product_snapshot)
      ? item.product_snapshot : {};
    const productId = item?.product_id === null || item?.product_id === undefined ? "" : String(item.product_id);
    const productName = typeof item?.product_name === "string" ? item.product_name.trim().slice(0, 180) : "Item sem descrição";
    const quantity = Number(item?.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100000) continue;
    if (item?.is_gift === true || snapshot.is_gift === true || item?.is_kit_component === true || snapshot.is_kit_component === true) continue;
    if (!productId && /^(entrega|frete)\b/i.test(productName)) continue;
    const lineValue = item?.line_total === null || item?.line_total === undefined
      ? (Number(item?.unit_price) || 0) * quantity
      : Number(item.line_total) || 0;
    if (!Number.isFinite(lineValue) || lineValue <= 0) continue;

    const key = productId || productName.toLocaleLowerCase("pt-BR");
    const row = products.get(key) || {
      product_id: productId || null, product_name: productName,
      paid_units: 0, purchase_ids: new Set(), last_paid_at: null
    };
    row.paid_units += quantity;
    row.purchase_ids.add(String(order.id));
    const paidAt = order.paid_at || order.created_at || null;
    if (paidAt && (!row.last_paid_at || paidAt > row.last_paid_at)) row.last_paid_at = paidAt;
    products.set(key, row);
  }

  return [...products.values()].map(row => ({
    product_id: row.product_id,
    product_name: row.product_name,
    paid_units: row.paid_units,
    purchase_count: row.purchase_ids.size,
    last_paid_at: row.last_paid_at
  })).sort((a, b) => b.paid_units - a.paid_units || a.product_name.localeCompare(b.product_name, "pt-BR"));
}

export function buildCustomerRecommendations(relationship = {}, products = [], now = Date.now()) {
  const rfv = relationship?.rfv || {};
  const recommendations = [];
  const paidProducts = products.filter(item => Number(item.paid_units) > 0);

  if (!Number(relationship?.paid_purchase_count)) {
    return [{
      type: "collect_history", priority: "low", title: "Construir histórico comercial",
      reason: "Ainda não há compras pagas explicitamente vinculadas. Associe as próximas vendas ao cadastro para iniciar o RFV.",
      source: "confirmed_paid_transactions"
    }];
  }

  if (["high_value_at_risk", "at_risk", "hibernating"].includes(rfv.segment)) {
    recommendations.push({
      type: "relationship_review",
      priority: rfv.segment === "high_value_at_risk" ? "high" : "medium",
      title: "Revisar relacionamento",
      reason: Number.isFinite(Number(relationship.days_since_last_purchase))
        ? "Última compra paga há " + Number(relationship.days_since_last_purchase) + " dias. Avalie atendimento individual, sem contato automático."
        : "O cliente tem histórico de compras, mas a data da última compra não está disponível.",
      source: "rfv_recency_frequency_value"
    });
  }

  const repeatCandidates = paidProducts
    .filter(item => Number(item.purchase_count) >= 2 && item.last_paid_at)
    .map(item => ({
      ...item,
      days_since_paid: Math.max(0, Math.floor((now - Date.parse(item.last_paid_at)) / 86400000))
    }))
    .filter(item => {
      const expectedInterval = Number(relationship.average_interval_days);
      const threshold = Number.isFinite(expectedInterval) && expectedInterval > 0
        ? Math.max(30, expectedInterval)
        : 45;
      return item.days_since_paid >= threshold;
    })
    .sort((a, b) => b.purchase_count - a.purchase_count || b.paid_units - a.paid_units);

  if (repeatCandidates.length) {
    const item = repeatCandidates[0];
    recommendations.push({
      type: "possible_repurchase", priority: "medium",
      title: "Avaliar recompra: " + item.product_name,
      reason: "Produto adquirido em " + item.purchase_count + " compras pagas; última compra há " + item.days_since_paid + " dias.",
      product_id: item.product_id,
      source: "consented_paid_online_product_history"
    });
  }

  const categoryUnits = new Map();
  for (const item of paidProducts) {
    const category = item.product_id ? PRODUCT_INTEREST_MAP[String(item.product_id)] : null;
    if (!category) continue;
    categoryUnits.set(category, (categoryUnits.get(category) || 0) + Number(item.paid_units || 0));
  }
  const dominantCategory = [...categoryUnits.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominantCategory) {
    const complementKey = (CUSTOMER_COMPLEMENTARY_CATEGORIES[dominantCategory[0]] || [])
      .find(key => key !== dominantCategory[0]);
    const complement = CUSTOMER_INTERESTS.find(item => item.key === complementKey);
    if (complement) {
      recommendations.push({
        type: "complementary_category", priority: "low",
        title: "Explorar categoria complementar: " + complement.label,
        reason: "Sugestão baseada em " + dominantCategory[1] + " unidade(s) paga(s) na categoria " +
          (CUSTOMER_INTERESTS.find(item => item.key === dominantCategory[0])?.label || dominantCategory[0]) + ".",
        category: complement.key,
        source: "consented_paid_online_product_history"
      });
    }
  }

  if (rfv.segment === "champion") {
    recommendations.push({
      type: "retain_relationship", priority: "medium",
      title: "Preservar experiência de cliente campeão",
      reason: "Recência, frequência e valor estão nas faixas mais altas. Priorize consistência e atendimento.",
      source: "rfv_recency_frequency_value"
    });
  }

  return recommendations.slice(0, 3);
}
