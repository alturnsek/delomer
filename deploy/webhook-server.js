// Preprost webhook receiver za samodejni redeploy ob push-u na main.
// Namenoma brez zunanjih odvisnosti (samo Node "http" in "crypto"), da ga
// lahko poganjamo kot ločen systemd servis, neodvisno od glavne aplikacije.
//
// Varnost:
// - zahteva veljaven HMAC-SHA256 podpis (X-Signature-256), primerjan
//   s timing-safe compare, da prepreči ponarejene/naključne klice
// - telo zahteve se NIKOLI ne uporabi v ukazu lupine (ni tveganja
//   za command injection) — deploy.sh se poganja brez argumentov
// - deploy.sh teče prek execFile (ne exec/shell), z zaklenjeno potjo

const http = require("http");
const crypto = require("crypto");
const { execFile } = require("child_process");
const path = require("path");

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.DEPLOY_WEBHOOK_SECRET;
const DEPLOY_SCRIPT = path.join(__dirname, "deploy.sh");

if (!SECRET) {
  console.error("DEPLOY_WEBHOOK_SECRET ni nastavljen. Ustavljam se.");
  process.exit(1);
}

function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(rawBody)
    .digest("hex");

  const provided = signatureHeader.slice("sha256=".length);

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");

  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

function runDeploy() {
  console.log(`[${new Date().toISOString()}] Sprožam deploy.sh`);

  execFile("/bin/bash", [DEPLOY_SCRIPT], (err, stdout, stderr) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] Deploy NAPAKA:`, err.message);
    }
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/deploy-webhook") {
    res.writeHead(404).end();
    return;
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));

  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);
    const signature = req.headers["x-signature-256"];

    if (!verifySignature(rawBody, signature)) {
      console.warn(`[${new Date().toISOString()}] Neveljaven podpis, zahteva zavrnjena`);
      res.writeHead(401).end();
      return;
    }

    res.writeHead(202).end("Deploy sprožen");
    runDeploy();
  });
});

server.listen(PORT, () => {
  console.log(`Webhook receiver posluša na vratih ${PORT}`);
});
