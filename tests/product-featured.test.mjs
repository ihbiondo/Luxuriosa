import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const catalog = JSON.parse(readFileSync("data/produtos.json", "utf8"));
const products = catalog.produtos ?? catalog;

test("produtos principais do catálogo seguem a curadoria definida", () => {
  const mainIds = products
    .filter(product => product.destaque === true && ![22, 23, 24, 27].includes(Number(product.id)))
    .map(product => Number(product.id))
    .sort((a, b) => a - b);

  assert.deepEqual(mainIds, [7, 10, 17]);
});

test("Egg Stepper e Plug Vermelho não ocupam a seleção principal", () => {
  for (const id of [8, 20]) {
    const product = products.find(item => Number(item.id) === id);
    assert.ok(product, `Produto ${id} precisa existir no catálogo.`);
    assert.notEqual(product.destaque, true);
  }
});

test("os quatro kits destacados continuam preservados", () => {
  for (const id of [22, 23, 24, 27]) {
    const product = products.find(item => Number(item.id) === id);
    assert.ok(product, `Kit ${id} precisa existir no catálogo.`);
    assert.equal(product.destaque, true);
  }
});
