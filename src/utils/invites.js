const crypto = require("crypto");

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dni

function createInviteToken() {
  return {
    token: crypto.randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS)
  };
}

// TODO: nadomesti z dejanskim pošiljanjem emaila, ko bo na voljo ponudnik
function logInviteEmail(email, token) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  console.log(`[INVITE] ${email} -> ${base}/set-password.html?token=${token}`);
}

module.exports = { createInviteToken, logInviteEmail };
