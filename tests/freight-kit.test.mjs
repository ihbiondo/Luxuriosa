import assert from "node:assert/strict";
import { test } from "node:test";
import { isKitOrderEligibleForFreeBauruDelivery } from "../supabase/functions/_shared/freight.mjs";

const kit = { product_snapshot: { category: "Kits" } };
const regular = { product_snapshot: { category: "Vibradores" } };
const bauru = { city: "Bauru", state: "SP", district: "Jardim Cruzeiro do Sul" };

test("concede frete grátis em Bauru quando o pedido contém kit", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([kit], bauru), true);
});

test("mantém frete grátis quando o kit acompanha produtos avulsos", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([regular, kit], bauru), true);
});

test("não concede frete grátis para pedido sem kit", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([regular], bauru), false);
});

test("não concede frete grátis para kits entregues em outras cidades", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([kit], {
    city: "Agudos", state: "SP", district: "Centro"
  }), false);
});

test("Tibiriçá mantém a tarifa própria mesmo com kit", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([kit], {
    city: "Bauru", state: "SP", district: "Tibiriçá"
  }), false);
});

test("não concede frete grátis para endereço fora de São Paulo", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([kit], {
    city: "Bauru", state: "MG", district: "Centro"
  }), false);
});

test("não concede frete grátis para pedido vazio ou inválido", () => {
  assert.equal(isKitOrderEligibleForFreeBauruDelivery([], bauru), false);
  assert.equal(isKitOrderEligibleForFreeBauruDelivery(null, bauru), false);
});
