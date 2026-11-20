import test from "node:test";
import assert from "node:assert/strict";
import { buildFulfillmentNotification } from "../supabase/functions/infinitepay-webhook/fulfillment-notification.mjs";

test("retirada mostra local, horário de Brasília e frete gratuito", () => {
  const result = buildFulfillmentNotification({
    fulfillment_type: "pickup",
    pickup_requested_at: "2026-11-22T13:30:00.000Z",
    shipping_amount: 0,
    delivery_address: {
      zip: "17030290",
      street: "Rua Madre Clélia",
      number: "5-44",
      district: "Jardim Cruzeiro do Sul",
      city: "Bauru",
      state: "SP"
    }
  });

  assert.equal(result.fulfillmentLabel, "Retirada agendada");
  assert.equal(result.destinationLabel, "Local de retirada");
  assert.equal(
    result.destinationText,
    "Rua Madre Clélia, 5-44, Jardim Cruzeiro do Sul, Bauru/SP, CEP 17030-290"
  );
  assert.equal(result.scheduleLabel, "Data/hora pretendida para retirada");
  assert.equal(result.scheduleText, "22/11/2026 às 10:30");
  assert.equal(result.freightLabel, "Frete na retirada");
  assert.equal(result.freightText, "Gratuito");
});

test("entrega imediata mantém endereço e valor de frete", () => {
  const result = buildFulfillmentNotification({
    fulfillment_type: "express",
    shipping_amount: 15,
    delivery_address: {
      street: "Rua de Teste",
      number: "123",
      district: "Centro",
      city: "Bauru",
      state: "SP",
      zip: "17010000"
    }
  });

  assert.equal(result.fulfillmentLabel, "Entrega imediata");
  assert.equal(result.destinationLabel, "Endereço de entrega");
  assert.equal(
    result.destinationText,
    "Rua de Teste, 123, Centro, Bauru/SP, CEP 17010-000"
  );
  assert.equal(result.scheduleLabel, "");
  assert.equal(result.freightLabel, "Frete");
  assert.equal(result.freightText, "R$ 15,00");
});

test("entrega agendada exibe a janela registrada", () => {
  const result = buildFulfillmentNotification({
    fulfillment_type: "scheduled",
    scheduled_delivery_date: "2026-11-24",
    scheduled_window_start: "14:00:00",
    scheduled_window_end: "16:00:00",
    shipping_amount: 0,
    delivery_address: { street: "Avenida Brasil", number: "10", city: "Bauru", state: "SP" }
  });

  assert.equal(result.fulfillmentLabel, "Entrega agendada");
  assert.equal(result.scheduleLabel, "Janela de entrega");
  assert.equal(result.scheduleText, "24/11/2026, das 14:00 às 16:00");
  assert.equal(result.freightText, "Gratuito");
});

test("pedido antigo sem modalidade continua identificado como entrega imediata", () => {
  const result = buildFulfillmentNotification({
    shipping_amount: 10,
    delivery_address: { street: "Rua Antiga", number: "1", city: "Bauru", state: "SP" }
  });

  assert.equal(result.fulfillmentLabel, "Entrega imediata");
  assert.equal(result.destinationLabel, "Endereço de entrega");
  assert.equal(result.freightText, "R$ 10,00");
});
