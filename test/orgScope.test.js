const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildScopedQuery } = require("../src/utils/orgScope");

test("buildScopedQuery vstavi organization_id na mesto markerja {org} kot prvi parameter", () => {
  const { sql, params } = buildScopedQuery(7, "SELECT * FROM teams WHERE {org} AND id = ?", [42]);
  assert.equal(sql, "SELECT * FROM teams WHERE organization_id = ? AND id = ?");
  assert.deepEqual(params, [7, 42]);
});

test("buildScopedQuery deluje tudi brez dodatnih parametrov", () => {
  const { sql, params } = buildScopedQuery(3, "SELECT COUNT(*) FROM work_logs WHERE {org}");
  assert.equal(sql, "SELECT COUNT(*) FROM work_logs WHERE organization_id = ?");
  assert.deepEqual(params, [3]);
});

test("buildScopedQuery vrže napako, če SQL ne vsebuje markerja {org}", () => {
  assert.throws(
    () => buildScopedQuery(7, "SELECT * FROM teams WHERE id = ?", [42]),
    /marker/
  );
});

test("buildScopedQuery vrže napako, če organizationId manjka", () => {
  assert.throws(() => buildScopedQuery(null, "SELECT * FROM teams WHERE {org}"), /organizationId/);
  assert.throws(() => buildScopedQuery(undefined, "SELECT * FROM teams WHERE {org}"), /organizationId/);
});

test("buildScopedQuery ne spremeni izvirnega params argumenta", () => {
  const original = [42];
  buildScopedQuery(7, "SELECT * FROM teams WHERE {org} AND id = ?", original);
  assert.deepEqual(original, [42]);
});
