const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { getClientIp } = require("../utils/loginHistory");

// Omejevanje števila zahtev (rate limiting). Ključ je pravi IP odjemalca -
// za Cloudflare/NPM proxyjem je req.ip lahko IP proxyja, zato uporabimo isto
// logiko kot zgodovina prijav (CF-Connecting-IP, sicer req.ip).
function clientKey(req) {
  return ipKeyGenerator(getClientIp(req) || "unknown");
}

// Splošna omejitev za vse /api zahteve: 300 zahtev na minuto na IP.
// SPA ob odpiranju posameznega pogleda sproži več klicev, več članov društva
// pa je lahko za istim IP (skupni Wi-Fi), zato je meja namenoma ohlapna -
// ustavi samo skripte in zlorabo, ne pa običajne uporabe.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { message: "Preveč zahtev. Poskusi znova čez nekaj trenutkov." }
});

// Prijava: 10 NEUSPEŠNIH poskusov na 15 minut za kombinacijo IP + email.
// Uspešne prijave se ne štejejo. Ključ vsebuje IP, zato napadalec z drugega
// naslova ne more zakleniti računa (npr. skupnega kiosk računa) za prave
// uporabnike.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${clientKey(req)}|${String(req.body?.email || "").trim().toLowerCase()}`,
  message: { message: "Preveč neuspešnih poskusov prijave. Poskusi znova čez 15 minut." }
});

module.exports = { apiLimiter, loginLimiter };
