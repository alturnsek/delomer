require('dotenv').config();
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

const db = require("./db");

/* =========================
  SERIALIZE / DESERIALIZE
========================= */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const rows = await db.query(
      `SELECT users.*, organizations.name AS organization_name
       FROM users
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE users.id = ?`,
      [id]
    );

    if (!rows.length) return done(null, false);

    done(null, rows[0]);
  } catch (err) {
    done(err);
  }
});


/* =========================
  LOCAL STRATEGY
========================= */

passport.use(new LocalStrategy(
  { usernameField: "email" },
  async (email, password, done) => {
    try {
      const rows = await db.query(
        `SELECT users.*, organizations.name AS organization_name
         FROM users
         LEFT JOIN organizations ON organizations.id = users.organization_id
         WHERE users.email = ?`,
        [email.trim().toLowerCase()]
      );

      if (!rows.length) {
        return done(null, false, { message: "Uporabnik ne obstaja" });
      }

      const user = rows[0];

      // prazen password_hash = račun še ni aktiviran (čaka na vabilo) ali social login
      if (!user.password_hash) {
        return done(null, false, { message: "Račun še ni aktiviran - preveri povabilo po emailu" });
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
