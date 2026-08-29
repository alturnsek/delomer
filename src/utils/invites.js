const crypto = require("crypto");
const db = require("../config/db");

const INVITE_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 ur

function createInviteToken() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS)
  };
}

function buildInviteUrl(token) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/set-password.html?token=${token}`;
}

async function getEmailMode() {
  try {
    const rows = await db.query(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'email_mode'"
    );
    return rows[0]?.setting_value || "log";
  } catch (err) {
    console.error("GET EMAIL MODE ERROR:", err);
    return "log";
  }
}

// Pošlje vabilo - v "log" načinu samo izpiše povezavo v strežniške loge,
// v "real" načinu dejansko pošlje email preko Resend. Način nastavlja
// SUPER_ADMIN v UI (app_settings.email_mode), brez potrebe po redeployu.
async function sendInviteEmail(email, token) {
  const url = buildInviteUrl(token);
  const mode = await getEmailMode();

  if (mode !== "real") {
    console.log(`[INVITE] ${email} -> ${url}`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY manjka v .env - vabilo samo zabeleženo v loge");
    console.log(`[INVITE] ${email} -> ${url}`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.INVITE_EMAIL_FROM || "Delomer <info@delomer.top>",
        to: email,
        subject: "Povabilo v Delomer",
        html: `<p>Bili ste povabljeni v aplikacijo Delomer.</p><p><a href="${url}">Kliknite tukaj za nastavitev gesla</a></p>`
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("RESEND SEND ERROR:", res.status, text);
      console.log(`[INVITE FALLBACK] ${email} -> ${url}`);
    }
  } catch (err) {
    console.error("RESEND SEND ERROR:", err);
    console.log(`[INVITE FALLBACK] ${email} -> ${url}`);
  }
}

// Ustvari nov (svež, 6-urni) token in ponovno pošlje vabilo - za "Ponovno
// pošlji vabilo" akcijo, ko uporabnik še ni aktiviral računa.
async function issueAndSendInvite(userId, email) {
  const { token, expiresAt } = createInviteToken();

  await db.query(
    "UPDATE users SET invite_token = ?, invite_token_expires_at = ? WHERE id = ?",
    [token, expiresAt, userId]
  );

  await sendInviteEmail(email, token);
}

module.exports = { createInviteToken, sendInviteEmail, issueAndSendInvite };
