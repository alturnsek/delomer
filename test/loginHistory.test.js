const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getClientIp, describeBrowser, describeLocation } = require("../src/utils/loginHistory");

test("getClientIp da prednost CF-Connecting-IP pred req.ip", () => {
  const req = { headers: { "cf-connecting-ip": "1.2.3.4" }, ip: "9.9.9.9" };
  assert.equal(getClientIp(req), "1.2.3.4");
});

test("getClientIp pade nazaj na req.ip, če CF-Connecting-IP manjka", () => {
  const req = { headers: {}, ip: "9.9.9.9" };
  assert.equal(getClientIp(req), "9.9.9.9");
});

test("getClientIp vrne null, če ni na voljo nobenega naslova", () => {
  const req = { headers: {}, connection: {} };
  assert.equal(getClientIp(req), null);
});

test("describeBrowser vrne null za manjkajoč user-agent", () => {
  assert.equal(describeBrowser(null), null);
  assert.equal(describeBrowser(""), null);
});

test("describeBrowser prepozna Chrome na Windows", () => {
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const result = describeBrowser(ua);

  assert.match(result, /Chrome/);
  assert.match(result, /Windows/);
});

test("describeLocation vrne null za manjkajoč IP", () => {
  assert.equal(describeLocation(null), null);
  assert.equal(describeLocation(""), null);
});

test("describeLocation vrne niz ali null za veljaven javni IP", () => {
  const result = describeLocation("8.8.8.8");
  assert.ok(result === null || typeof result === "string");
});
