const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPasswordValid } = require("../src/utils/password");

test("zavrne prekratko geslo", () => {
  assert.equal(isPasswordValid("Ab1!"), false);
});

test("zavrne geslo brez velike črke", () => {
  assert.equal(isPasswordValid("dolgogeslo1!"), false);
});

test("zavrne geslo brez male črke", () => {
  assert.equal(isPasswordValid("DOLGOGESLO1!"), false);
});

test("zavrne geslo brez številke", () => {
  assert.equal(isPasswordValid("DolgoGeslo!!"), false);
});

test("zavrne geslo brez posebnega znaka", () => {
  assert.equal(isPasswordValid("DolgoGeslo123"), false);
});

test("sprejme geslo, ki izpolnjuje vse zahteve", () => {
  assert.equal(isPasswordValid("DolgoGeslo1!"), true);
});

test("zavrne prazno ali manjkajoče geslo", () => {
  assert.equal(isPasswordValid(""), false);
  assert.equal(isPasswordValid(undefined), false);
});
