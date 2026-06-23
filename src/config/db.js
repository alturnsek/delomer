const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  connectionLimit: 5,

  //priporočeno za stabilnost
  acquireTimeout: 10000,
  timeout: 10000
});

//test povezave (optional ampak zelo uporaben)
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected to MariaDB');
    conn.release();
  } catch (err) {
    console.error('❌ MariaDB connection failed:', err.message);
  }
}

// pokliči ob startu
testConnection();

module.exports = pool;