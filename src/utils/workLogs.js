function toNumber(value) {
  return typeof value === "bigint" ? Number(value) : value;
}

function serializeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, toNumber(value)])
  );
}

// pool: mariadb pool/connection z .query(); rows: serializirani work_logs (imajo .id)
async function attachParticipants(pool, rows) {
  if (!rows.length) return rows;

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const participantRows = await pool.query(
    `SELECT work_log_participants.work_log_id, users.id, users.first_name, users.last_name
     FROM work_log_participants
     JOIN users ON users.id = work_log_participants.user_id
     WHERE work_log_participants.work_log_id IN (${placeholders})`,
    ids
  );

  const byWorkLog = {};

  for (const p of participantRows) {
    const key = toNumber(p.work_log_id);
    if (!byWorkLog[key]) byWorkLog[key] = [];
    byWorkLog[key].push({ id: toNumber(p.id), first_name: p.first_name, last_name: p.last_name });
  }

  return rows.map(r => ({ ...r, participants: byWorkLog[r.id] || [] }));
}

module.exports = { toNumber, serializeRow, attachParticipants };
