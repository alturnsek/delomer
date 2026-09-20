const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { loginLimiter } = require("../src/middleware/rateLimit");

// Minimalna aplikacija z enakim vrstnim redom kot v pravi: json parser -> loginLimiter -> handler.
// Pravi IP simuliramo z Cloudflare headerjem, ki ga bere getClientIp().
function startApp() {
  const app = express();
  app.use(express.json());
  app.post("/login", loginLimiter, (req, res) => {
    if (req.body.password === "pravilno") return res.json({ message: "OK" });
    res.status(400).json({ message: "Napačen email ali geslo" });
  });

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/login` });
    });
  });
}

function login(url, ip, email, password) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ email, password })
  });
}

async function withApp(fn) {
  const { server, url } = await startApp();
  try {
    await fn(url);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

test("loginLimiter blokira prijavo po 10 neuspešnih poskusih istega IP in emaila", () =>
  withApp(async (url) => {
    for (let i = 0; i < 10; i++) {
      const res = await login(url, "203.0.113.10", "a@primer.si", "napacno");
      assert.equal(res.status, 400);
    }
    // 11. poskus je blokiran, tudi če je geslo pravilno
    const blocked = await login(url, "203.0.113.10", "a@primer.si", "pravilno");
    assert.equal(blocked.status, 429);
  }));

test("loginLimiter ne blokira istega emaila z drugega IP naslova (zaščita pred zaklepanjem kioska)", () =>
  withApp(async (url) => {
    for (let i = 0; i < 11; i++) {
      await login(url, "203.0.113.20", "kiosk@primer.si", "napacno");
    }
    const other = await login(url, "203.0.113.21", "kiosk@primer.si", "pravilno");
    assert.equal(other.status, 200);
  }));

test("loginLimiter ne šteje uspešnih prijav", () =>
  withApp(async (url) => {
    for (let i = 0; i < 15; i++) {
      const res = await login(url, "203.0.113.30", "b@primer.si", "pravilno");
      assert.equal(res.status, 200);
    }
  }));
