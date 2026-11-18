import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarTelefoneWhatsApp,
  montarResumoPedidoWhatsApp,
  criarLinkWhatsApp
} from "../js/pedido-whatsapp.js";

const order = {
  id: "order-1",
  order_number: 42,
  status: "confirmed",
  payment_status: "paid",
  payment_method: "pix",
  fulfillment_type: "express",
  subtotal: 55,
  shipping_amount: 15,
  total_amount: 70,
  club_discount_amount_cents: 0,
  created_at: "2026-11-18T12:00:00-03:00",
  paid_at: "2026-11-18T12:05:00-03:00"
};
const items = [
  { order_id: "order-1", product_name: "Produto íntimo reservado", quantity: 2, unit_price: 27.5, line_total: 55 },
  { order_id: "other-order", product_name: "Não pertence ao pedido", quantity: 1, unit_price: 99, line_total: 99 }
];

test("normaliza telefone com DDD e código do Brasil", () => {
  assert.equal(normalizarTelefoneWhatsApp("(14) 99999-0000"), "5514999990000");
  assert.equal(normalizarTelefoneWhatsApp("+55 14 99999-0000"), "5514999990000");
});
test("rejeita número sem formato brasileiro válido", () => {
  assert.equal(normalizarTelefoneWhatsApp("12345"), "");
  assert.equal(normalizarTelefoneWhatsApp("00000000000"), "");
});
test("resumo padrão não revela nome de produto íntimo", () => {
  const message = montarResumoPedidoWhatsApp(order, items);
  assert.match(message, /Pedido #42/);
  assert.match(message, /Pagamento: aprovado/);
  assert.match(message, /Quantidade: 2 itens/);
  assert.match(message, /Total do pedido: R\$\s*70,00/);
  assert.doesNotMatch(message, /Produto íntimo reservado/);
  assert.doesNotMatch(message, /Não pertence ao pedido/);
});
test("nomes dos produtos só entram com opção expressa", () => {
  const message = montarResumoPedidoWhatsApp(order, items, true);
  assert.match(message, /Produto íntimo reservado/);
  assert.doesNotMatch(message, /Não pertence ao pedido/);
});
test("gera link wa.me com mensagem codificada", () => {
  const url = criarLinkWhatsApp("14999990000", "Pedido #42\nPagamento aprovado");
  assert.match(url, /^https:\/\/wa\.me\/5514999990000\?text=/);
  assert.match(url, /Pedido%20%2342/);
});
test("não gera link para telefone inválido", () => {
  assert.throws(() => criarLinkWhatsApp("111", "Resumo"), /número de WhatsApp brasileiro válido/);
});
