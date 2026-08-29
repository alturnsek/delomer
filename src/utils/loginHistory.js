const geoip = require("geoip-lite");
const UAParser = require("ua-parser-js");
const db = require("../config/db");

// Cloudflare postavi pravi originalni IP v ta header - zanesljivejše kot
// zanašanje na X-Forwarded-For preko vseh vmesnih skokov (NPM ipd.).
function getClientIp(req) {
  const cfIp = req.headers["cf-connecting-ip"];
  if (cfIp) return cfIp;
  return req.ip || req.connection?.remoteAddress || null;
}

function describeBrowser(userAgentString) {
  if (!userAgentString) return null;

  const result = new UAParser(userAgentString).getResult();

  const browser = [result.browser.name, result.browser.version].filter(Boolean).join(" ");
  const os = [result.os.name, result.os.version].filter(Boolean).join(" ");

  return [browser, os].filter(Boolean).join(" · ") || userAgentString.slice(0, 100);
}

function describeLocation(ip) {
  if (!ip) return null;

  const cleanIp = ip.replace("::ffff:", ""); // IPv4-mapped IPv6 naslovi
  const geo = geoip.lookup(cleanIp);

  if (!geo) return null;

  return [geo.city, geo.country].filter(Boolean).join(", ") || null;
}

async function recordLogin(req, userId) {
  try {
    const ip = getClientIp(req);

    await db.query(
      "INSERT INTO login_history (user_id, ip_address, location, browser) VALUES (?, ?, ?, ?)",
      [userId, ip, describeLocation(ip), describeBrowser(req.headers["user-agent"])]
    );
  } catch (err) {
    console.error("RECORD LOGIN ERROR:", err);
  }
}

module.exports = { recordLogin };
