import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ALLOWED_ORIGINS = new Set([
  "https://luxuriosa.com.br",
  "https://www.luxuriosa.com.br",
  "http://127.0.0.1:1421",
  "http://localhost:1421"
]);

function reply(body: unknown, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "vary": "Origin"
    }
  });
}

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function hashPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

class ValidationError extends Error {}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 80) {
    throw new ValidationError("Adicione de 1 a 80 itens à venda.");
  }

  return value.map((raw: any) => {
    const productId = cleanText(raw?.product_id, 100);
    const productName = cleanText(raw?.product_name, 180);
    const quantity = Number(raw?.quantity);
    const unitPrice = Number(raw?.unit_price_cents);

    if (!productName || !Number.isInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isSafeInteger(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
      throw new ValidationError("Um dos itens possui dados inválidos.");
    }

    const lineTotal = quantity * unitPrice;
    if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0) {
      throw new ValidationError("O valor de um item ultrapassa o limite permitido.");
    }

    return {
      product_id: productId || null,
      product_name: productName,
      quantity,
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal
    };
  });
}

async function authorize(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Faça login para acessar a Gestão.", status: 401 };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: "Sessão inválida. Entre novamente.", status: 401 };

  const { data: permission, error: permissionError } = await admin
    .from("user_permissions")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (permissionError) return { error: "Não foi possível validar a permissão administrativa.", status: 500 };
  if (permission?.role !== "admin") return { error: "Acesso restrito à administração.", status: 403 };

  return { user: data.user };
}


function localAnalyticsParts(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function summarizeSales(rows: any[]) {
  const result = {
    sales_count: 0,
    paid_count: 0,
    pending_count: 0,
    sold_cents: 0,
    received_cents: 0,
    pending_cents: 0,
    discount_cents: 0,
    subtotal_cents: 0,
    average_paid_ticket_cents: 0,
    paid_rate_percent: 0,
    discount_rate_percent: 0,
    units_sold: 0,
    costed_sales_count: 0,
    sales_without_cost_count: 0,
    sold_cost_of_goods_cents: 0,
    paid_cost_of_goods_cents: 0,
    gross_profit_cents: 0,
    costed_paid_revenue_cents: 0,
    gross_margin_percent: null,
    recorded_expenses_cents: 0,
    expense_count: 0,
    partial_operating_result_cents: null,
    expense_categories: [] as any[],
    top_products: [] as any[],
    payment_methods: [] as any[],
    trend: [] as any[],
    weekday_activity: [] as any[],
    hourly_activity: [] as any[]
  };

  const products = new Map<string, { name: string; quantity: number; gross_cents: number }>();
  const methods = new Map<string, { method: string; sales_count: number; paid_count: number; pending_count: number; received_cents: number; pending_cents: number }>();
  const days = new Map<string, { date: string; sales_count: number; paid_count: number; sold_cents: number; received_cents: number; pending_cents: number }>();
  const weekdays = new Map<string, number>();
  const hours = new Map<string, number>();

  for (const sale of rows) {
    const total = Number(sale.total_cents) || 0;
    const discount = Number(sale.discount_cents) || 0;
    const subtotal = Number(sale.subtotal_cents) || 0;
    const paid = sale.payment_status === "paid";
    const methodName = cleanText(sale.payment_method, 30) || "OUTRO";
    let saleCostKnown = true;
    let saleCost = 0;

    result.sales_count += 1;
    result.sold_cents += total;
    result.discount_cents += discount;
    result.subtotal_cents += subtotal;

    if (paid) {
      result.paid_count += 1;
      result.received_cents += total;
    } else {
      result.pending_count += 1;
      result.pending_cents += total;
    }

    const method = methods.get(methodName) || {
      method: methodName, sales_count: 0, paid_count: 0, pending_count: 0,
      received_cents: 0, pending_cents: 0
    };
    method.sales_count += 1;
    if (paid) {
      method.paid_count += 1;
      method.received_cents += total;
    } else {
      method.pending_count += 1;
      method.pending_cents += total;
    }
    methods.set(methodName, method);

    for (const item of (Array.isArray(sale.items) ? sale.items : [])) {
      const name = cleanText(item?.product_name, 180) || "Item sem descrição";
      const quantity = Number(item?.quantity) || 0;
      const line = Number(item?.line_total_cents) || 0;
      const product = products.get(name) || { name, quantity: 0, gross_cents: 0 };
      product.quantity += quantity;
      product.gross_cents += line;
      products.set(name, product);
      result.units_sold += quantity;
      if (item?.unit_cost_cents === null || item?.unit_cost_cents === undefined || !Number.isSafeInteger(Number(item.unit_cost_cents))) {
        saleCostKnown = false;
      } else {
        saleCost += Number(item.unit_cost_cents) * quantity;
      }
    }

    if (saleCostKnown && Array.isArray(sale.items) && sale.items.length) {
      result.costed_sales_count += 1;
      result.sold_cost_of_goods_cents += saleCost;
      if (paid) {
        result.paid_cost_of_goods_cents += saleCost;
        result.costed_paid_revenue_cents += total;
        result.gross_profit_cents += total - saleCost;
      }
    } else {
      result.sales_without_cost_count += 1;
    }

    const local = localAnalyticsParts(sale.created_at);
    const dayKey = `${local.year}-${local.month}-${local.day}`;
    const day = days.get(dayKey) || {
      date: dayKey, sales_count: 0, paid_count: 0, sold_cents: 0,
      received_cents: 0, pending_cents: 0
    };
    day.sales_count += 1;
    day.sold_cents += total;
    if (paid) {
      day.paid_count += 1;
      day.received_cents += total;
    } else {
      day.pending_cents += total;
    }
    days.set(dayKey, day);

    const weekday = local.weekday || "—";
    weekdays.set(weekday, (weekdays.get(weekday) || 0) + 1);
    const hour = local.hour || "00";
    hours.set(hour, (hours.get(hour) || 0) + 1);
  }

  result.gross_margin_percent = result.costed_paid_revenue_cents
    ? Math.round((result.gross_profit_cents / result.costed_paid_revenue_cents) * 1000) / 10 : null;
  result.average_paid_ticket_cents = result.paid_count
    ? Math.round(result.received_cents / result.paid_count) : 0;
  result.paid_rate_percent = result.sales_count
    ? Math.round((result.paid_count / result.sales_count) * 1000) / 10 : 0;
  result.discount_rate_percent = result.subtotal_cents
    ? Math.round((result.discount_cents / result.subtotal_cents) * 1000) / 10 : 0;
  result.top_products = [...products.values()]
    .sort((a, b) => b.quantity - a.quantity || b.gross_cents - a.gross_cents)
    .slice(0, 8);
  result.payment_methods = [...methods.values()]
    .sort((a, b) => b.received_cents + b.pending_cents - (a.received_cents + a.pending_cents));
  result.trend = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  result.weekday_activity = [...weekdays.entries()]
    .map(([weekday, sales_count]) => ({ weekday, sales_count }))
    .sort((a, b) => b.sales_count - a.sales_count);
  result.hourly_activity = [...hours.entries()]
    .map(([hour, sales_count]) => ({ hour, sales_count }))
    .sort((a, b) => b.sales_count - a.sales_count);
  return result;
}

async function readExpensesForAnalytics(userId: string, from: string, to: string) {
  const { data, error } = await admin.from("management_expenses")
    .select("expense_date, category, amount_cents")
    .eq("created_by", userId)
    .eq("status", "active")
    .gte("expense_date", from.slice(0, 10))
    .lte("expense_date", to.slice(0, 10))
    .order("expense_date", { ascending: true })
    .limit(10000);
  if (error) throw error;
  return data || [];
}

async function readSalesForAnalytics(userId: string, from: string, to: string) {
  const rows: any[] = [];
  const pageSize = 500;
  const maximumRows = 10000;
  let truncated = false;

  for (let offset = 0; offset < maximumRows; offset += pageSize) {
    const { data, error } = await admin.from("management_sales")
      .select("created_at, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status")
      .eq("created_by", userId)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated };
  }

  truncated = true;
  return { rows, truncated };
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://luxuriosa.com.br",
        "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
        "vary": "Origin"
      }
    });
  }
  if (request.method !== "POST") return reply({ error: "Método não permitido." }, 405, origin);
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply({ error: "Origem não autorizada." }, 403, origin);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 128 * 1024) return reply({ error: "Solicitação muito grande." }, 413, origin);

  let body: any;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 128 * 1024) {
      return reply({ error: "Solicitação muito grande." }, 413, origin);
    }
    body = JSON.parse(rawBody);
  } catch {
    return reply({ error: "Corpo da solicitação inválido." }, 400, origin);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reply({ error: "Corpo da solicitação inválido." }, 400, origin);
  }

  try {
    const auth = await authorize(request);
    if ("error" in auth) return reply({ error: auth.error }, auth.status, origin);

    const action = body.action;

    if (action === "website-sync-retry") {
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(body.limit) || 50)));
      const { data: pendingOrders, error: pendingError } = await admin.from("orders")
        .select("id, order_number, management_sales_sync_status")
        .eq("source", "website")
        .eq("payment_provider", "infinitepay")
        .eq("payment_status", "paid")
        .in("management_sales_sync_status", ["pending", "error", "not_applicable"])
        .order("paid_at", { ascending: true })
        .limit(limit);
      if (pendingError) throw pendingError;

      let synced = 0;
      let failed = 0;
      const results: any[] = [];
      for (const order of pendingOrders || []) {
        const { data, error } = await admin.rpc("sync_online_order_to_management_sale", {
          p_order_id: order.id
        });
        if (error || data?.synced !== true) {
          failed += 1;
          results.push({
            order_number: order.order_number,
            outcome: "error"
          });
        } else {
          synced += 1;
          results.push({
            order_number: order.order_number,
            outcome: data.outcome || "synced"
          });
        }
      }

      return reply({
        ok: true,
        scanned: (pendingOrders || []).length,
        synced,
        failed,
        results,
        batch_limit: limit
      }, 200, origin);
    }

    if (action === "cost-list") {
      const { data, error } = await admin.from("management_product_costs")
        .select("product_id, product_name, unit_cost_cents, updated_at")
        .order("product_name", { ascending: true });
      if (error) throw error;
      return reply({ ok: true, costs: data || [] }, 200, origin);
    }

    if (action === "cost-upsert") {
      const productId = cleanText(body.product_id, 100);
      const productName = cleanText(body.product_name, 180);
      const unitCost = Number(body.unit_cost_cents);
      if (!productId || !productName || !Number.isSafeInteger(unitCost) || unitCost < 0 || unitCost > 100000000) {
        return reply({ error: "Informe produto e custo válido em centavos." }, 400, origin);
      }
      const { data, error } = await admin.from("management_product_costs")
        .upsert({
          product_id: productId,
          product_name: productName,
          unit_cost_cents: unitCost,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "product_id" })
        .select("product_id, product_name, unit_cost_cents, updated_at")
        .single();
      if (error) throw error;
      return reply({ ok: true, cost: data }, 200, origin);
    }

    if (action === "stock-list") {
      const [{ data: stock, error: stockError }, { data: movements, error: movementError }] = await Promise.all([
        admin.from("management_inventory")
          .select("product_id, product_name, quantity_on_hand, reorder_point, stock_control_enabled, updated_at")
          .order("product_name", { ascending: true }),
        admin.from("management_inventory_movements")
          .select("id, product_id, product_name, movement_type, quantity_delta, balance_after, reference_sale_id, note, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ]);
      if (stockError) throw stockError;
      if (movementError) throw movementError;
      return reply({ ok: true, stock: stock || [], movements: movements || [] }, 200, origin);
    }

    if (action === "stock-configure") {
      const productId = cleanText(body.product_id, 100);
      const productName = cleanText(body.product_name, 180);
      const reorderPoint = Number(body.reorder_point ?? 0);
      if (!productId || !productName || !Number.isSafeInteger(reorderPoint) || reorderPoint < 0 || reorderPoint > 1000000 || typeof body.stock_control_enabled !== "boolean") {
        return reply({ error: "Dados de controle de estoque inválidos." }, 400, origin);
      }
      const { data, error } = await admin.from("management_inventory")
        .upsert({
          product_id: productId,
          product_name: productName,
          reorder_point: reorderPoint,
          stock_control_enabled: body.stock_control_enabled,
          updated_at: new Date().toISOString()
        }, { onConflict: "product_id" })
        .select("product_id, product_name, quantity_on_hand, reorder_point, stock_control_enabled, updated_at")
        .single();
      if (error) throw error;
      return reply({ ok: true, item: data }, 200, origin);
    }

    if (action === "stock-move") {
      const productId = cleanText(body.product_id, 100);
      const productName = cleanText(body.product_name, 180);
      const movementType = cleanText(body.movement_type, 20);
      const quantity = Number(body.quantity);
      const note = cleanText(body.note, 500);
      const signs: Record<string, number> = { opening: 1, inbound: 1, return: 1, outbound: -1, loss: -1 };
      if (!productId || !productName || !Object.hasOwn(signs, movementType) || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) {
        return reply({ error: "Informe produto, tipo e quantidade válida." }, 400, origin);
      }
      const { data, error } = await admin.rpc("management_record_inventory_movement", {
        p_product_id: productId,
        p_product_name: productName,
        p_movement_type: movementType,
        p_quantity_delta: quantity * signs[movementType],
        p_note: note || null,
        p_created_by: auth.user.id
      });
      if (error) throw error;
      return reply({ ok: true, item: data }, 200, origin);
    }

    if (action === "kit-recipes-list") {
      const { data, error } = await admin.from("management_kit_components")
        .select("kit_product_id, kit_product_name, component_product_id, component_product_name, quantity, updated_at")
        .order("kit_product_name", { ascending: true })
        .order("component_product_name", { ascending: true });
      if (error) throw error;
      return reply({ ok: true, recipes: data || [] }, 200, origin);
    }

    if (action === "kit-recipe-upsert") {
      const kitId = cleanText(body.kit_product_id, 100);
      const kitName = cleanText(body.kit_product_name, 180);
      const componentId = cleanText(body.component_product_id, 100);
      const componentName = cleanText(body.component_product_name, 180);
      const quantity = Number(body.quantity);
      if (!/^\d+$/.test(kitId) || !/^\d+$/.test(componentId) || kitId === componentId ||
          !kitName || !componentName || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) {
        return reply({ error: "Composição de kit inválida." }, 400, origin);
      }
      const { data, error } = await admin.from("management_kit_components")
        .upsert({
          kit_product_id: kitId,
          kit_product_name: kitName,
          component_product_id: componentId,
          component_product_name: componentName,
          quantity,
          updated_by: auth.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "kit_product_id,component_product_id" })
        .select("kit_product_id, kit_product_name, component_product_id, component_product_name, quantity, updated_at")
        .single();
      if (error) throw error;
      return reply({ ok: true, recipe: data }, 200, origin);
    }

    if (action === "kit-recipe-remove") {
      const kitId = cleanText(body.kit_product_id, 100);
      const componentId = cleanText(body.component_product_id, 100);
      if (!/^\d+$/.test(kitId) || !/^\d+$/.test(componentId)) {
        return reply({ error: "Composição não encontrada." }, 400, origin);
      }
      const { error } = await admin.from("management_kit_components")
        .delete()
        .eq("kit_product_id", kitId)
        .eq("component_product_id", componentId);
      if (error) throw error;
      return reply({ ok: true }, 200, origin);
    }

    if (action === "expense-list") {
      const { data, error } = await admin.from("management_expenses")
        .select("id, expense_date, category, description, amount_cents, payment_method, recurring, status, void_reason, created_at")
        .eq("created_by", auth.user.id)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return reply({ ok: true, expenses: data || [] }, 200, origin);
    }

    if (action === "expense-create") {
      const category = cleanText(body.category, 30);
      const description = cleanText(body.description, 180);
      const amount = Number(body.amount_cents);
      const expenseDate = cleanText(body.expense_date, 10);
      const method = body.payment_method ? cleanText(body.payment_method, 30) : null;
      const recurring = body.recurring === true;
      const validCategories = ["FORNECEDOR","FRETE","TAXAS","MARKETING","EMBALAGEM","ALUGUEL","SERVICOS","IMPOSTOS","OUTROS"];
      const validMethods = ["DINHEIRO","PIX","TRANSFERENCIA","CARTAO_CREDITO","CARTAO_DEBITO","OUTRO"];
      if (!validCategories.includes(category) || !description || description.length < 2 ||
          !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ||
          (method && !validMethods.includes(method))) {
        return reply({ error: "Confira categoria, descrição, data e valor da despesa." }, 400, origin);
      }
      const { data, error } = await admin.from("management_expenses")
        .insert({
          created_by: auth.user.id,
          expense_date: expenseDate,
          category,
          description,
          amount_cents: amount,
          payment_method: method,
          recurring
        })
        .select("id, expense_date, category, description, amount_cents, payment_method, recurring, status, created_at")
        .single();
      if (error) throw error;
      return reply({ ok: true, expense: data }, 201, origin);
    }

    if (action === "expense-void") {
      const id = cleanText(body.id, 50);
      const reason = cleanText(body.reason, 250);
      if (!isUuid(id) || !reason || reason.length < 4) {
        return reply({ error: "Informe o lançamento e o motivo do cancelamento." }, 400, origin);
      }
      const { data, error } = await admin.from("management_expenses")
        .update({ status: "void", void_reason: reason, voided_at: new Date().toISOString(), voided_by: auth.user.id })
        .eq("id", id)
        .eq("created_by", auth.user.id)
        .eq("status", "active")
        .select("id, status, void_reason")
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: "Despesa não encontrada ou já cancelada." }, 404, origin);
      return reply({ ok: true, expense: data }, 200, origin);
    }

    if (action === "create") {
      if (!isUuid(body.idempotency_key)) return reply({ error: "Chave de operação inválida. Atualize a venda e tente novamente." }, 400, origin);

      const items: any[] = normalizeItems(body.items);
      const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))];
      if (productIds.length) {
        const { data: costs, error: costError } = await admin.from("management_product_costs")
          .select("product_id, unit_cost_cents")
          .in("product_id", productIds);
        if (costError) throw costError;
        const costMap = new Map((costs || []).map((row) => [row.product_id, Number(row.unit_cost_cents)]));
        for (const item of items) {
          item.unit_cost_cents = item.product_id && costMap.has(item.product_id)
            ? costMap.get(item.product_id)
            : null;
        }
      } else {
        for (const item of items) item.unit_cost_cents = null;
      }
      const subtotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);
      if (!Number.isSafeInteger(subtotal) || subtotal <= 0) return reply({ error: "Subtotal inválido." }, 400, origin);

      const discount = Number(body.discount_cents ?? 0);
      if (!Number.isSafeInteger(discount) || discount < 0 || discount >= subtotal) {
        return reply({ error: "Desconto inválido. Ele deve ser menor que o subtotal." }, 400, origin);
      }

      const total = subtotal - discount;
      const method = cleanText(body.payment_method, 30);
      const validMethods = ["DINHEIRO", "PIX", "TRANSFERENCIA", "CARTAO_CREDITO", "CARTAO_DEBITO", "OUTRO"];
      if (!validMethods.includes(method)) return reply({ error: "Forma de pagamento inválida." }, 400, origin);

      const paymentStatus = body.payment_status;
      if (paymentStatus !== "paid" && paymentStatus !== "pending") {
        return reply({ error: "Informe se o pagamento foi recebido ou está pendente." }, 400, origin);
      }
      const received = paymentStatus === "paid" ? Number(body.amount_received_cents ?? total) : 0;
      if (!Number.isSafeInteger(received) || received < 0 || received > 1000000000 ||
          (paymentStatus === "paid" && received < total)) {
        return reply({ error: "Valor recebido insuficiente ou inválido." }, 400, origin);
      }
      if (paymentStatus === "paid" && method !== "DINHEIRO" && received !== total) {
        return reply({ error: "Para esta forma de pagamento, o valor recebido deve ser igual ao total." }, 400, origin);
      }

      const customerName = cleanText(body.customer_name, 120) || null;
      const change = paymentStatus === "paid" ? received - total : 0;
      const requestHash = await hashPayload({
        customer_name: customerName,
        items,
        subtotal_cents: subtotal,
        discount_cents: discount,
        total_cents: total,
        payment_method: method,
        payment_status: paymentStatus,
        amount_received_cents: received,
        change_cents: change
      });

      const { data: sale, error: insertError } = await admin.from("management_sales")
        .insert({
          created_by: auth.user.id,
          idempotency_key: body.idempotency_key,
          request_hash: requestHash,
          customer_name: customerName,
          items,
          subtotal_cents: subtotal,
          discount_cents: discount,
          total_cents: total,
          payment_method: method,
          payment_status: paymentStatus,
          paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
          amount_received_cents: received,
          change_cents: change
        })
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .single();

      if (insertError?.code === "23505") {
        const { data: reused, error: retryError } = await admin.from("management_sales")
          .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue, request_hash")
          .eq("created_by", auth.user.id)
          .eq("idempotency_key", body.idempotency_key)
          .single();
        if (retryError) throw retryError;
        if (reused.request_hash !== requestHash) {
          return reply({ error: "Esta chave já foi usada para outro conteúdo. Consulte o histórico antes de tentar novamente." }, 409, origin);
        }
        const { request_hash: _hash, ...reusedSale } = reused;
        return reply({ ok: true, sale: reusedSale, reused: true }, 200, origin);
      }
      if (insertError) throw insertError;
      return reply({ ok: true, sale, reused: false }, 201, origin);
    }

    if (action === "mark-paid") {
      if (!isUuid(body.id)) return reply({ error: "Comprovante não encontrado." }, 400, origin);

      const { data: currentSale, error: currentError } = await admin.from("management_sales")
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .eq("id", body.id)
        .eq("created_by", auth.user.id)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!currentSale) return reply({ error: "Comprovante não encontrado." }, 404, origin);

      const received = Number(body.amount_received_cents ?? currentSale.total_cents);
      if (!Number.isSafeInteger(received) || received < currentSale.total_cents || received > 1000000000) {
        return reply({ error: "O valor recebido é insuficiente ou inválido." }, 400, origin);
      }
      if (currentSale.payment_method !== "DINHEIRO" && received !== currentSale.total_cents) {
        return reply({ error: "Para esta forma de pagamento, o valor recebido deve ser igual ao total." }, 400, origin);
      }

      if (currentSale.payment_status === "paid") {
        if (received !== currentSale.amount_received_cents) {
          return reply({ error: "Este pagamento já foi confirmado com outro valor." }, 409, origin);
        }
        return reply({ ok: true, sale: currentSale, reused: true }, 200, origin);
      }

      const { data: updated, error: updateError } = await admin.from("management_sales")
        .update({
          payment_status: "paid",
          amount_received_cents: received,
          change_cents: received - currentSale.total_cents,
          paid_at: new Date().toISOString()
        })
        .eq("id", body.id)
        .eq("created_by", auth.user.id)
        .eq("payment_status", "pending")
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .maybeSingle();

      if (updateError) throw updateError;
      if (updated) return reply({ ok: true, sale: updated, reused: false }, 200, origin);

      const { data: raced, error: raceError } = await admin.from("management_sales")
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .eq("id", body.id)
        .eq("created_by", auth.user.id)
        .maybeSingle();
      if (raceError) throw raceError;
      if (raced?.payment_status === "paid" && raced.amount_received_cents === received) {
        return reply({ ok: true, sale: raced, reused: true }, 200, origin);
      }
      return reply({ error: "O pagamento foi alterado em outra operação. Atualize a lista e confira o comprovante." }, 409, origin);
    }


async function readAnalyticsRows(table: string, columns: string, from: string, to: string) {
  const rows: any[] = [];
  const pageSize = 500;
  const maximumRows = 10000;
  let truncated = false;
  for (let offset = 0; offset < maximumRows; offset += pageSize) {
    const { data, error } = await admin.from(table)
      .select(columns)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return { rows, truncated };
  }
  truncated = true;
  return { rows, truncated };
}

async function readBusinessSignals(from: string, to: string) {
  const [eventResult, cartResult, orderResult] = await Promise.all([
    readAnalyticsRows("site_events", "event_name, session_key, created_at", from, to),
    readAnalyticsRows("cart_sessions", "status, session_key, converted_at, created_at", from, to),
    readAnalyticsRows("orders", "status, payment_status, total_amount, created_at, source, management_sales_sync_status, payment_checkout_url", from, to)
  ]);

  const eventMap = new Map<string, { event_name: string; count: number; sessions: Set<string> }>();
  const allSessions = new Set<string>();
  for (const event of eventResult.rows) {
    const name = cleanText(event.event_name, 80) || "unknown";
    const entry = eventMap.get(name) || { event_name: name, count: 0, sessions: new Set<string>() };
    entry.count += 1;
    if (event.session_key) {
      const key = String(event.session_key);
      entry.sessions.add(key);
      allSessions.add(key);
    }
    eventMap.set(name, entry);
  }

  const cartStatuses = new Map<string, number>();
  let convertedCarts = 0;
  for (const cart of cartResult.rows) {
    const status = cleanText(cart.status, 40) || "unknown";
    cartStatuses.set(status, (cartStatuses.get(status) || 0) + 1);
    if (status === "converted" || cart.converted_at) convertedCarts += 1;
  }

  const orderStatuses = new Map<string, number>();
  const paymentStatuses = new Map<string, { status: string; count: number; amount_cents: number }>();
  const websiteSalesSync = new Map<string, number>();
  let failedCheckoutWithoutLinkCount = 0;
  for (const order of orderResult.rows.filter((row: any) => !row.source || row.source === "website")) {
    const status = cleanText(order.status, 50) || "unknown";
    orderStatuses.set(status, (orderStatuses.get(status) || 0) + 1);
    const paymentStatus = cleanText(order.payment_status, 50) || "unknown";
    const payment = paymentStatuses.get(paymentStatus) || { status: paymentStatus, count: 0, amount_cents: 0 };
    payment.count += 1;
    const amount = Number(order.total_amount);
    if (Number.isFinite(amount) && amount > 0) payment.amount_cents += Math.round(amount * 100);
    paymentStatuses.set(paymentStatus, payment);
    if (order.source === "website" && paymentStatus === "failed" && !order.payment_checkout_url) {
      failedCheckoutWithoutLinkCount += 1;
    }
    if (order.source === "website" && paymentStatus === "paid") {
      const syncStatus = cleanText(order.management_sales_sync_status, 40) || "not_applicable";
      websiteSalesSync.set(syncStatus, (websiteSalesSync.get(syncStatus) || 0) + 1);
    }
  }

  const events = [...eventMap.values()]
    .map(entry => ({ event_name: entry.event_name, count: entry.count, sessions: entry.sessions.size }))
    .sort((a, b) => b.count - a.count);

  return {
    site_sessions: allSessions.size,
    site_events: eventResult.rows.length,
    events,
    carts: {
      total: cartResult.rows.length,
      abandoned: cartStatuses.get("abandoned") || 0,
      active: cartStatuses.get("active") || 0,
      converted: convertedCarts,
      statuses: [...cartStatuses.entries()].map(([status, count]) => ({ status, count }))
    },
    orders: {
      total: orderResult.rows.length,
      statuses: [...orderStatuses.entries()].map(([status, count]) => ({ status, count })),
      payment_statuses: [...paymentStatuses.values()].sort((a, b) => b.count - a.count),
      failed_checkout_without_link_count: failedCheckoutWithoutLinkCount,
      paid_website_sales_sync: [...websiteSalesSync.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)
    },
    truncated: eventResult.truncated || cartResult.truncated || orderResult.truncated
  };
}


const CUSTOMER_INTERESTS = [
  { key: "lingerie", label: "Lingerie" },
  { key: "cosmeticos_sensuais", label: "Cosméticos sensuais" },
  { key: "geles_lubrificantes", label: "Géis e lubrificantes" },
  { key: "acessorios_casais", label: "Acessórios para casais" },
  { key: "jogos_brincadeiras", label: "Jogos e brincadeiras" },
  { key: "massagem_relaxamento", label: "Massagem e relaxamento" },
  { key: "estimulacao", label: "Produtos de estimulação" },
  { key: "fantasias_acessorios", label: "Fantasias e acessórios" },
  { key: "kits_presentes", label: "Kits e presentes" },
  { key: "novidades_lancamentos", label: "Novidades e lançamentos" }
];

const CUSTOMER_PRICE_RANGES = [
  { key: "ate_50", label: "Até R$ 50" },
  { key: "50_100", label: "R$ 50 a R$ 100" },
  { key: "100_200", label: "R$ 100 a R$ 200" },
  { key: "acima_200", label: "Acima de R$ 200" }
];

const CUSTOMER_OFFER_TYPES = [
  { key: "descontos", label: "Descontos e oportunidades" },
  { key: "kits", label: "Kits e combinações" },
  { key: "novidades", label: "Novidades e lançamentos" },
  { key: "recomendacoes", label: "Recomendações personalizadas" }
];

// Taxonomia comercial explícita. Produtos sem correspondência ficam fora da comparação.
const PRODUCT_INTEREST_MAP: Record<string, string> = {
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

function createCustomerInterestStats() {
  return new Map(CUSTOMER_INTERESTS.map((item) => [item.key, {
    key: item.key,
    label: item.label,
    declared_customers: 0,
    viewing_users: new Set<string>(),
    view_events: 0,
    cart_users: new Set<string>(),
    add_to_cart_events: 0,
    buyers: new Set<string>(),
    paid_orders: new Set<string>(),
    units_sold: 0,
    revenue_cents: 0
  }] as const));
}

async function readCustomerInsights(from: string, to: string, periodDays: number) {
  const [
    profileCountResult,
    preferenceResult,
    consentResult,
    cartResult,
    eventResult,
    orderResult
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("preferences")
      .select("user_id, favorite_categories, preferred_price_range, preferred_offer_type")
      .limit(10000),
    admin.from("account_data_consents")
      .select("user_id, granted, consent_text_version, created_at")
      .eq("purpose", "experience_personalization")
      .order("created_at", { ascending: false })
      .limit(20000),
    admin.from("cart_sessions")
      .select("session_key, user_id")
      .not("user_id", "is", null)
      .limit(20000),
    admin.from("site_events")
      .select("session_key, event_name, product_id, created_at")
      .gte("created_at", from)
      .lte("created_at", to)
      .in("event_name", ["product_view", "add_to_cart"])
      .order("created_at", { ascending: true })
      .limit(20000),
    admin.from("orders")
      .select("id, customer_id, paid_at")
      .eq("payment_status", "paid")
      .not("customer_id", "is", null)
      .gte("paid_at", from)
      .lte("paid_at", to)
      .limit(10000)
  ]);

  for (const result of [profileCountResult, preferenceResult, consentResult, cartResult, eventResult, orderResult]) {
    if (result.error) throw result.error;
  }

  // Usa a autorização mais recente e o texto v2, que contempla as novas preferências comerciais.
  const latestConsent = new Map<string, any>();
  for (const row of consentResult.data || []) {
    if (!latestConsent.has(row.user_id)) latestConsent.set(row.user_id, row);
  }
  const eligibleUsers = new Set<string>();
  for (const [userId, consent] of latestConsent.entries()) {
    if (consent.granted === true && consent.consent_text_version === "luxuriosa-account-data-v2-2026-11") {
      eligibleUsers.add(userId);
    }
  }

  const eligiblePreferences = (preferenceResult.data || [])
    .filter((row: any) => eligibleUsers.has(row.user_id));
  const categoryStats = createCustomerInterestStats();
  const priceCounts = new Map(CUSTOMER_PRICE_RANGES.map((item) => [item.key, 0] as const));
  const offerCounts = new Map(CUSTOMER_OFFER_TYPES.map((item) => [item.key, 0] as const));

  let profilesWithCategories = 0;
  let profilesWithPrice = 0;
  let profilesWithOffer = 0;
  for (const preference of eligiblePreferences) {
    const selected = Array.isArray(preference.favorite_categories)
      ? [...new Set(preference.favorite_categories.filter((key: string) => categoryStats.has(key)))]
      : [];
    if (selected.length) profilesWithCategories += 1;
    if (preference.preferred_price_range && priceCounts.has(preference.preferred_price_range)) {
      priceCounts.set(preference.preferred_price_range, (priceCounts.get(preference.preferred_price_range) || 0) + 1);
      profilesWithPrice += 1;
    }
    if (preference.preferred_offer_type && offerCounts.has(preference.preferred_offer_type)) {
      offerCounts.set(preference.preferred_offer_type, (offerCounts.get(preference.preferred_offer_type) || 0) + 1);
      profilesWithOffer += 1;
    }
    for (const key of selected) {
      const stat = categoryStats.get(key);
      if (stat) stat.declared_customers += 1;
    }
  }

  const sessionOwners = new Map<string, string>();
  for (const cart of cartResult.data || []) {
    if (cart.session_key && cart.user_id && eligibleUsers.has(cart.user_id)) {
      sessionOwners.set(String(cart.session_key), String(cart.user_id));
    }
  }

  const trackedUsers = new Set<string>();
  let linkedProductEvents = 0;
  let unmappedProductEvents = 0;
  for (const event of eventResult.data || []) {
    const userId = sessionOwners.get(String(event.session_key || ""));
    if (!userId || !eligibleUsers.has(userId)) continue;
    linkedProductEvents += 1;
    const interestKey = PRODUCT_INTEREST_MAP[String(event.product_id || "")];
    if (!interestKey || !categoryStats.has(interestKey)) {
      unmappedProductEvents += 1;
      continue;
    }
    const stat = categoryStats.get(interestKey);
    if (!stat) {
      unmappedProductEvents += 1;
      continue;
    }
    trackedUsers.add(userId);
    if (event.event_name === "product_view") {
      stat.view_events += 1;
      stat.viewing_users.add(userId);
    } else if (event.event_name === "add_to_cart") {
      stat.add_to_cart_events += 1;
      stat.cart_users.add(userId);
    }
  }

  const eligibleOrders = (orderResult.data || [])
    .filter((order: any) => order.customer_id && eligibleUsers.has(order.customer_id));
  const orderIds = eligibleOrders.map((order: any) => order.id);
  const orderOwners = new Map(eligibleOrders.map((order: any) => [String(order.id), String(order.customer_id)] as const));
  let unmappedPurchaseItems = 0;
  let paidRevenueCents = 0;
  const purchasedUsers = new Set<string>();
  if (eligibleOrders.length) {
    const { data: orderItems, error: itemError } = await admin.from("order_items")
      .select("order_id, product_id, quantity, unit_price, line_total")
      .in("order_id", orderIds)
      .limit(30000);
    if (itemError) throw itemError;

    for (const item of orderItems || []) {
      const userId = orderOwners.get(String(item.order_id));
      if (!userId) continue;
      const interestKey = PRODUCT_INTEREST_MAP[String(item.product_id || "")];
      if (!interestKey || !categoryStats.has(interestKey)) {
        unmappedPurchaseItems += 1;
        continue;
      }
      const stat = categoryStats.get(interestKey);
      if (!stat) {
        unmappedPurchaseItems += 1;
        continue;
      }
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const lineValue = item.line_total === null || item.line_total === undefined
        ? (Number(item.unit_price) || 0) * quantity
        : Number(item.line_total) || 0;
      stat.units_sold += quantity;
      stat.revenue_cents += Math.round(lineValue * 100);
      stat.paid_orders.add(String(item.order_id));
      stat.buyers.add(userId);
      purchasedUsers.add(userId);
      paidRevenueCents += Math.round(lineValue * 100);
    }
  }

  const categories = CUSTOMER_INTERESTS.map((item) => {
    const stat = categoryStats.get(item.key)!;
    return {
      key: stat.key,
      label: stat.label,
      declared_customers: stat.declared_customers,
      viewing_customers: stat.viewing_users.size,
      product_views: stat.view_events,
      cart_customers: stat.cart_users.size,
      add_to_cart_events: stat.add_to_cart_events,
      buying_customers: stat.buyers.size,
      paid_orders: stat.paid_orders.size,
      units_sold: stat.units_sold,
      revenue_cents: stat.revenue_cents
    };
  });

  return {
    ok: true,
    period_days: periodDays,
    generated_at: new Date().toISOString(),
    total_profiles: profileCountResult.count || 0,
    personalization_eligible_profiles: eligibleUsers.size,
    profiles_with_categories: profilesWithCategories,
    profiles_with_price: profilesWithPrice,
    profiles_with_offer: profilesWithOffer,
    tracked_profiles: trackedUsers.size,
    tracked_product_events: linkedProductEvents,
    purchased_profiles: purchasedUsers.size,
    paid_orders: eligibleOrders.length,
    paid_revenue_cents: paidRevenueCents,
    categories,
    price_ranges: CUSTOMER_PRICE_RANGES.map((item) => ({
      key: item.key, label: item.label, customers: priceCounts.get(item.key) || 0
    })),
    offer_types: CUSTOMER_OFFER_TYPES.map((item) => ({
      key: item.key, label: item.label, customers: offerCounts.get(item.key) || 0
    })),
    coverage: {
      eligible_profiles: eligibleUsers.size,
      eligible_preferences: eligiblePreferences.length,
      linked_product_events: linkedProductEvents,
      unmapped_product_events: unmappedProductEvents,
      unmapped_purchase_items: unmappedPurchaseItems,
      source_limit_reached:
        (preferenceResult.data || []).length >= 10000 ||
        (consentResult.data || []).length >= 20000 ||
        (cartResult.data || []).length >= 20000 ||
        (eventResult.data || []).length >= 20000 ||
        (orderResult.data || []).length >= 10000
    }
  };
}


    if (action === "customer-insights") {
      const periodDays = Number(body.period_days ?? 30);
      if (![7, 30, 90, 365].includes(periodDays)) {
        return reply({ error: "Período inválido. Escolha 7, 30, 90 ou 365 dias." }, 400, origin);
      }
      const now = new Date();
      const from = new Date(now.getTime() - periodDays * 86400000).toISOString();
      const result = await readCustomerInsights(from, now.toISOString(), periodDays);
      return reply(result, 200, origin);
    }

    if (action === "analytics") {
      const periodDays = Number(body.period_days ?? 30);
      if (![7, 30, 90, 365].includes(periodDays)) {
        return reply({ error: "Período inválido. Escolha 7, 30, 90 ou 365 dias." }, 400, origin);
      }
      const now = new Date();
      const currentStart = new Date(now.getTime() - periodDays * 86400000);
      const previousStart = new Date(now.getTime() - periodDays * 2 * 86400000);
      const [{ rows, truncated }, expenseRows] = await Promise.all([
        readSalesForAnalytics(auth.user.id, previousStart.toISOString(), now.toISOString()),
        readExpensesForAnalytics(auth.user.id, previousStart.toISOString(), now.toISOString())
      ]);
      const currentRows = rows.filter((sale) => new Date(sale.created_at).getTime() >= currentStart.getTime());
      const previousRows = rows.filter((sale) => new Date(sale.created_at).getTime() < currentStart.getTime());
      const currentExpenseRows = expenseRows.filter((expense) => expense.expense_date >= currentStart.toISOString().slice(0, 10));
      const previousExpenseRows = expenseRows.filter((expense) => expense.expense_date < currentStart.toISOString().slice(0, 10));
      const summarizeExpenses = (items: any[]) => {
        const categories = new Map<string, number>();
        let total = 0;
        for (const expense of items) {
          const amount = Number(expense.amount_cents) || 0;
          total += amount;
          categories.set(expense.category, (categories.get(expense.category) || 0) + amount);
        }
        return { total, count: items.length, categories: [...categories.entries()].map(([category, amount_cents]) => ({ category, amount_cents })).sort((a,b)=>b.amount_cents-a.amount_cents) };
      };
      const current = summarizeSales(currentRows);
      const previous = summarizeSales(previousRows);
      const currentExpenses = summarizeExpenses(currentExpenseRows);
      const previousExpenses = summarizeExpenses(previousExpenseRows);
      for (const [summary, expenseSummary] of [[current,currentExpenses],[previous,previousExpenses]] as any[]) {
        summary.recorded_expenses_cents = expenseSummary.total;
        summary.expense_count = expenseSummary.count;
        summary.expense_categories = expenseSummary.categories;
        summary.partial_operating_result_cents = summary.costed_paid_revenue_cents > 0
          ? summary.gross_profit_cents - expenseSummary.total : null;
      }
      return reply({
        ok: true,
        generated_at: now.toISOString(),
        timezone: "America/Sao_Paulo",
        period_days: periodDays,
        current,
        previous,
        business_pulse: await readBusinessSignals(currentStart.toISOString(), now.toISOString()),
        truncated
      }, 200, origin);
    }

    if (action === "list") {
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(body.limit) || 20)));
      const { data, error } = await admin.from("management_sales")
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .eq("created_by", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return reply({ ok: true, sales: data || [] }, 200, origin);
    }

    if (action === "get") {
      if (!isUuid(body.id)) return reply({ error: "Comprovante não encontrado." }, 400, origin);
      const { data, error } = await admin.from("management_sales")
        .select("id, sale_number, created_at, customer_name, items, subtotal_cents, discount_cents, total_cents, payment_method, payment_status, amount_received_cents, change_cents, paid_at, source, source_order_id, shipping_cents, stock_control_status, stock_issue")
        .eq("id", body.id)
        .eq("created_by", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: "Comprovante não encontrado." }, 404, origin);
      return reply({ ok: true, sale: data }, 200, origin);
    }

    return reply({ error: "Ação não reconhecida." }, 400, origin);
  } catch (error) {
    if (error instanceof ValidationError) {
      return reply({ error: error.message }, 400, origin);
    }
    console.error("management-sales failure:", error);
    return reply({ error: "Não foi possível concluir a operação. Tente novamente ou consulte o histórico antes de reenviar." }, 500, origin);
  }
});
