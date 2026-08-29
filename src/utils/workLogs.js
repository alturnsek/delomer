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
    `SELECT work_log_participants.work_log_id, work_log_participants.minutes_override,
            users.id, users.first_name, users.last_name
     FROM work_log_participants
     JOIN users ON users.id = work_log_participants.user_id
     WHERE work_log_participants.work_log_id IN (${placeholders})`,
    ids
  );

  const byWorkLog = {};

  for (const p of participantRows) {
    const key = toNumber(p.work_log_id);
    if (!byWorkLog[key]) byWorkLog[key] = [];
    byWorkLog[key].push({
      id: toNumber(p.id),
      first_name: p.first_name,
      last_name: p.last_name,
      minutes_override: toNumber(p.minutes_override)
    });
  }

  return rows.map(r => ({ ...r, participants: byWorkLog[r.id] || [] }));
}

// preveri, da so podani uporabniki dejansko iz istega društva; vrne Map<userId, minutesOverride|null>
async function resolveOrgParticipants(conn, organizationId, rawParticipants) {
  const result = new Map();

  const entries = Array.isArray(rawParticipants)
    ? rawParticipants
        .map(p => (typeof p === "object" && p !== null ? p : { user_id: p }))
        .map(p => ({ user_id: Number(p.user_id), minutes_override: p.minutes_override === "" || p.minutes_override == null ? null : Number(p.minutes_override) }))
        .filter(p => p.user_id)
    : [];

  if (!entries.length || !organizationId) return result;

  const ids = entries.map(e => e.user_id);
  const placeholders = ids.map(() => "?").join(",");

  const validRows = await conn.query(
    `SELECT id FROM users WHERE id IN (${placeholders}) AND organization_id = ? AND is_active = 1 AND role != 'PUBLIC'`,
    [...ids, organizationId]
  );

  const validIds = new Set(validRows.map(r => toNumber(r.id)));

  for (const entry of entries) {
    if (validIds.has(entry.user_id)) {
      result.set(entry.user_id, entry.minutes_override);
    }
  }

  return result;
}

async function saveParticipants(conn, workLogId, participantsMap) {
  for (const [userId, minutesOverride] of participantsMap) {
    await conn.query(
      "INSERT IGNORE INTO work_log_participants (work_log_id, user_id, minutes_override) VALUES (?, ?, ?)",
      [workLogId, userId, minutesOverride]
    );
  }
}

module.exports = { toNumber, serializeRow, attachParticipants, resolveOrgParticipants, saveParticipants };
