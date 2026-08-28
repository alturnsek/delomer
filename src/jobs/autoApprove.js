const pool = require("../config/db");

async function runAutoApprove() {
  try {
    const result = await pool.query(
      `UPDATE work_logs
       SET status = 'APPROVED', is_auto_approved = 1, reviewed_at = NOW()
       WHERE status = 'PENDING' AND pending_since < (NOW() - INTERVAL 30 DAY)`
    );

    if (result.affectedRows) {
      console.log(`[AUTO-APPROVE] Samodejno potrjenih ${result.affectedRows} vnosov (30+ dni PENDING)`);
    }
  } catch (err) {
    console.error("AUTO-APPROVE ERROR:", err);
  }
}

module.exports = { runAutoApprove };
