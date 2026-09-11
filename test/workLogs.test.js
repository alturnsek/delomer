const { test } = require("node:test");
const assert = require("node:assert/strict");
const { toNumber, serializeRow } = require("../src/utils/workLogs");

test("toNumber pretvori BigInt v navaden number", () => {
  assert.equal(toNumber(42n), 42);
  assert.equal(typeof toNumber(42n), "number");
});

test("toNumber pusti ne-BigInt vrednosti nespremenjene", () => {
  assert.equal(toNumber(5), 5);
  assert.equal(toNumber("besedilo"), "besedilo");
  assert.equal(toNumber(null), null);
});

test("serializeRow pretvori vse BigInt vrednosti v vrstici (npr. COUNT/SUM iz MariaDB)", () => {
  const row = { id: 1n, minutes: 90n, task: "Sestanek", category_id: null };

  assert.deepEqual(serializeRow(row), {
    id: 1,
    minutes: 90,
    task: "Sestanek",
    category_id: null
  });
});

test("serializeRow na prazni vrstici vrne prazen objekt", () => {
  assert.deepEqual(serializeRow({}), {});
});
