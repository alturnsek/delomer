const crypto = require("crypto");
const db = require("../config/db");

const INVITE_TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 ur

function createInviteToken() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS)
  };
}

function buildSetPasswordUrl(token) {
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

// Skupna dostava emaila - v "log" načinu (privzeto) samo izpiše fallbackText
// v strežniške loge, v "real" načinu dejansko pošlje preko Resend. Način
// nastavlja SUPER_ADMIN v UI (app_settings.email_mode), brez redeploya.
async function deliverEmail({ to, subject, html, logLabel, fallbackText }) {
  const mode = await getEmailMode();

  if (mode !== "real") {
    console.log(`[${logLabel}] ${to} -> ${fallbackText}`);
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY manjka v .env - email samo zabeležen v loge");
    console.log(`[${logLabel}] ${to} -> ${fallbackText}`);
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
        to,
        subject,
        html
      })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("RESEND SEND ERROR:", res.status, text);
      console.log(`[${logLabel} FALLBACK] ${to} -> ${fallbackText}`);
    }
  } catch (err) {
    console.error("RESEND SEND ERROR:", err);
    console.log(`[${logLabel} FALLBACK] ${to} -> ${fallbackText}`);
  }
}

async function sendInviteEmail(email, token) {
  const url = buildSetPasswordUrl(token);

  await deliverEmail({
    to: email,
    subject: "Povabilo v Delomer",
    html: `<p>Bili ste povabljeni v aplikacijo Delomer.</p><p><a href="${url}">Kliknite tukaj za nastavitev gesla</a></p>`,
    logLabel: "INVITE",
    fallbackText: url
  });
}

// Obvestilo, da je bilo geslo spremenjeno + povezava za takojšnjo ponastavitev,
// če sprememba ni bila legitimna (varnostni ukrep).
async function sendPasswordChangedEmail(email, resetToken) {
  const resetUrl = buildSetPasswordUrl(resetToken);

  await deliverEmail({
    to: email,
    subject: "Vaše geslo je bilo spremenjeno",
    html: `<p>Geslo za vaš Delomer račun je bilo pravkar spremenjeno.</p>
           <p>Če to niste bili vi, takoj ponastavite geslo: <a href="${resetUrl}">Ponastavi geslo</a></p>
           <p>Ta povezava je veljavna 6 ur.</p>`,
    logLabel: "PASSWORD_CHANGED",
    fallbackText: resetUrl
  });
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

// Obvestilo ob samopostrežni registraciji preko registracijske povezave društva
// (varnostni ukrep - da lastnik emaila ve, da je bil ravnokar ustvarjen račun).
async function sendAccountClaimedEmail(email, organizationName) {
  await deliverEmail({
    to: email,
    subject: "Vaš Delomer račun je bil ustvarjen",
    html: `<p>Pravkar ste si preko registracijske povezave društva${organizationName ? ` "${organizationName}"` : ""} ustvarili račun v aplikaciji Delomer.</p>
           <p>Če to niste bili vi, se obrnite na administratorja društva.</p>`,
    logLabel: "ACCOUNT_CLAIMED",
    fallbackText: `Račun za ${email} ustvarjen preko registracijske povezave`
  });
}

module.exports = {
  createInviteToken,
  sendInviteEmail,
  sendPasswordChangedEmail,
  issueAndSendInvite,
  sendAccountClaimedEmail
};
