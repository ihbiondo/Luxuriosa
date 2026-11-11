import { normalizeInventoryMovementDelta } from "./inventory.ts";

function expectEqual(actual: number | null, expected: number | null, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recebido ${actual}`);
  }
}

Deno.test("movimentos comuns preservam a direção configurada", () => {
  expectEqual(normalizeInventoryMovementDelta("opening", 12, null), 12, "abertura");
  expectEqual(normalizeInventoryMovementDelta("inbound", 3, null), 3, "entrada");
  expectEqual(normalizeInventoryMovementDelta("return", 2, null), 2, "devolução");
  expectEqual(normalizeInventoryMovementDelta("outbound", 4, null), -4, "saída");
  expectEqual(normalizeInventoryMovementDelta("loss", 1, null), -1, "perda");
});

Deno.test("ajuste aceita correção positiva e negativa", () => {
  expectEqual(normalizeInventoryMovementDelta("adjustment", null, 5), 5, "ajuste positivo");
  expectEqual(normalizeInventoryMovementDelta("adjustment", null, -3), -3, "ajuste negativo");
});

Deno.test("movimentações inválidas são recusadas", () => {
  expectEqual(normalizeInventoryMovementDelta("adjustment", null, 0), null, "ajuste zero");
  expectEqual(normalizeInventoryMovementDelta("adjustment", null, 1_000_001), null, "ajuste acima do limite");
  expectEqual(normalizeInventoryMovementDelta("adjustment", null, 1.5), null, "ajuste fracionado");
  expectEqual(normalizeInventoryMovementDelta("outbound", 0, null), null, "saída zero");
  expectEqual(normalizeInventoryMovementDelta("unknown", 1, null), null, "tipo desconhecido");
});
