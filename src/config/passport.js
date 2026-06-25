require('dotenv').config();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
//const TwitterStrategy = require("passport-twitter").Strategy;
const bcrypt = require("bcrypt");

const db = require("./db");
console.log("GOOGLE ID:", process.env.GOOGLE_CLIENT_ID);
/* =========================
   ✅ SERIALIZE / DESERIALIZE
========================= */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const rows = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    if (!rows.length) return done(null, false);

    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});


/* =========================
   ✅ LOCAL STRATEGY
========================= */

passport.use(new LocalStrategy(
  { usernameField: "email" },
  async (email, password, done) => {
    try {
      const rows = await db.query(
        "SELECT * FROM users WHERE email = ?",
        [email.trim().toLowerCase()]
      );

      if (!rows.length) {
        return done(null, false, { message: "Uporabnik ne obstaja" });
      }

      const user = rows[0];

      // ✅ IMPORTANT: social accounts nimajo passworda
      if (!user.password_hash) {
        return done(null, false, { message: "Uporabi social login" });
      }

      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return done(null, false, { message: "Napačno geslo" });
      }

      return done(null, user);

    } catch (err) {
      return done(err);
    }
  }
));


/* =========================
   ✅ GOOGLE STRATEGY
========================= */

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/api/users/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      return done(null, false, { message: "No email from Google" });
    }

    let [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    // ✅ če user NE obstaja → ga ustvarimo
    if (!rows.length) {
      const [result] = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES (?, '', ?, ?)`,
        [
          email,
          profile.name?.givenName || "",
          profile.name?.familyName || ""
        ]
      );

      const [newUser] = await db.query(
        "SELECT * FROM users WHERE id = ?",
        [result.insertId]
      );

      return done(null, newUser[0]);
    }

    // ✅ če obstaja
    return done(null, rows[0]);

  } catch (err) {
    return done(err);
  }
}));


/* =========================
   ✅ FACEBOOK (READY)
   ⚠️ Rabi app keys
========================= */

/*passport.use(new FacebookStrategy({
  clientID: process.env.FB_CLIENT_ID,
  clientSecret: process.env.FB_CLIENT_SECRET,
  callbackURL: "/api/users/auth/facebook/callback",
  profileFields: ["id", "emails", "name"]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;

    let [rows] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (!rows.length) {
      const [result] = await db.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES (?, '', ?, ?)`,
        [
          email,
          profile.name?.givenName || "",
          profile.name?.familyName || ""
        ]
      );

      const [newUser] = await db.query(
        "SELECT * FROM users WHERE id = ?",
        [result.insertId]
      );

      return done(null, newUser[0]);
    }

    return done(null, rows[0]);

  } catch (err) {
    return done(err);
  }
}));*/


