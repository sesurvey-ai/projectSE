import { db } from '../config/database';
import { normalizePhone } from '../utils/phone';

const VALID = new Set(['answered', 'no_answer', 'missed', 'rejected']);
const RETRY_WINDOW = '30 minutes'; // โทรซ้ำหัวหน้าคนเดิมภายในช่วงนี้ = นับเป็น "โทรซ้ำ"
const GROUPS = ['supervisor', 'staff', 'day', 'week'];

interface SyncItem {
  device_call_id?: unknown;
  number?: unknown;
  started_at?: unknown;
  duration_sec?: unknown;
  status?: unknown;
}

export const consultService = {
  // หัวหน้าของพนักงานคนนี้ (จาก users.supervisor_id) ที่มีเบอร์
  async supervisorsFor(staffId: number) {
    const { rows } = await db.query(
      `SELECT s.id, (s.first_name || ' ' || s.last_name) AS name, s.phone
         FROM users u JOIN users s ON s.id = u.supervisor_id
        WHERE u.id = $1 AND s.is_active = true AND s.phone IS NOT NULL`,
      [staffId]
    );
    return rows.map((r: { id: number; name: string; phone: string }) => ({
      supervisor_id: r.id,
      name: r.name,
      number: normalizePhone(r.phone),
    }));
  },

  // อัปโหลด call log ที่กรองเป็นเบอร์หัวหน้าแล้ว — upsert กันซ้ำด้วย (staff_id, device_call_id)
  async sync(staffId: number, items: SyncItem[]) {
    const sups = await this.supervisorsFor(staffId);
    const map = new Map(sups.map((s) => [s.number, s.supervisor_id]));
    const skipped = { unmatched_number: 0, invalid_status: 0, invalid_date: 0, missing_device_id: 0 };
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const it of items) {
      const dev = it?.device_call_id ? String(it.device_call_id) : '';
      if (!dev) { skipped.missing_device_id++; continue; }
      const status = String(it?.status || '');
      if (!VALID.has(status)) { skipped.invalid_status++; continue; }
      const ms = typeof it?.started_at === 'number' ? it.started_at : Date.parse(String(it?.started_at));
      if (!ms || isNaN(ms)) { skipped.invalid_date++; continue; }
      const num = normalizePhone(it?.number as string | undefined);
      const supId = map.get(num);
      if (!supId) { skipped.unmatched_number++; continue; }
      const dur = Number.isFinite(+(it?.duration_sec as number)) ? Math.max(0, Math.trunc(+(it!.duration_sec as number))) : 0;
      values.push(`($${p++},$${p++},$${p++},to_timestamp($${p++}/1000.0),$${p++},$${p++},$${p++})`);
      params.push(staffId, supId, num, ms, dur, status, dev);
    }
    let upserted = 0;
    if (values.length) {
      const r = await db.query(
        `INSERT INTO call_consult_log
           (staff_id, supervisor_id, supervisor_number, started_at, duration_sec, status, device_call_id)
         VALUES ${values.join(',')}
         ON CONFLICT (staff_id, device_call_id) DO UPDATE
           SET supervisor_id=EXCLUDED.supervisor_id, supervisor_number=EXCLUDED.supervisor_number,
               started_at=EXCLUDED.started_at, duration_sec=EXCLUDED.duration_sec, status=EXCLUDED.status
         RETURNING id`,
        params
      );
      upserted = r.rowCount ?? 0;
    }
    const skippedN = Object.values(skipped).reduce((a, b) => a + b, 0);
    return { received: items.length, upserted, skipped: skippedN, skipped_detail: skipped };
  },

  // รีพอร์ต — พอร์ตจาก se-callphone/api/src/routes/reports.js แต่ join users (staff=supervisor=users)
  async report(groupByRaw: string, q: Record<string, unknown>) {
    const groupBy = GROUPS.includes(groupByRaw) ? groupByRaw : 'supervisor';

    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    const from = q.from ? new Date(String(q.from)) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const to = q.to ? new Date(String(q.to)) : new Date();
    where.push(`l.started_at >= $${p++}`); params.push(from.toISOString());
    where.push(`l.started_at <  $${p++}`); params.push(to.toISOString());
    if (q.supervisor_id && Number.isFinite(Number(q.supervisor_id))) {
      where.push(`l.supervisor_id = $${p++}`); params.push(Number(q.supervisor_id));
    }
    if (q.staff_id && Number.isFinite(Number(q.staff_id))) {
      where.push(`l.staff_id = $${p++}`); params.push(Number(q.staff_id));
    }
    const whereSql = where.join(' AND ');

    let sql: string;
    if (groupBy === 'supervisor') {
      sql = `
        SELECT l.supervisor_id,
               (s.first_name || ' ' || s.last_name)                       AS supervisor_name,
               s.phone                                                    AS supervisor_number,
               COUNT(*)::int                                              AS total,
               COUNT(*) FILTER (WHERE l.status = 'answered')::int         AS answered,
               COUNT(*) FILTER (WHERE l.status = 'no_answer')::int        AS no_answer,
               COUNT(*) FILTER (WHERE l.status = 'missed')::int           AS missed,
               COUNT(*) FILTER (WHERE l.status = 'rejected')::int         AS rejected,
               ROUND(100.0 * COUNT(*) FILTER (WHERE l.status <> 'answered')
                     / NULLIF(COUNT(*), 0), 1)                            AS not_answered_rate,
               COALESCE(ROUND(AVG(l.duration_sec)
                     FILTER (WHERE l.status = 'answered'))::int, 0)       AS avg_talk_sec
          FROM call_consult_log l
          LEFT JOIN users s ON s.id = l.supervisor_id
         WHERE ${whereSql}
         GROUP BY l.supervisor_id, s.first_name, s.last_name, s.phone
         ORDER BY total DESC`;
    } else if (groupBy === 'staff') {
      sql = `
        WITH ordered AS (
          SELECT staff_id, supervisor_id, started_at, status,
                 LAG(status)     OVER w AS prev_status,
                 LAG(started_at) OVER w AS prev_started
            FROM call_consult_log l
           WHERE ${whereSql}
          WINDOW w AS (PARTITION BY staff_id, supervisor_id ORDER BY started_at)
        ),
        agg AS (
          SELECT staff_id,
                 COUNT(*)::int                                       AS total_calls,
                 COUNT(*) FILTER (WHERE status = 'answered')::int    AS connected,
                 COUNT(*) FILTER (
                   WHERE prev_status IS NOT NULL
                     AND prev_status <> 'answered'
                     AND started_at - prev_started <= INTERVAL '${RETRY_WINDOW}'
                 )::int                                              AS retry_calls
            FROM ordered
           GROUP BY staff_id
        )
        SELECT a.staff_id, (st.first_name || ' ' || st.last_name) AS staff_name,
               a.total_calls, a.connected, a.retry_calls
          FROM agg a
          LEFT JOIN users st ON st.id = a.staff_id
         ORDER BY a.total_calls DESC`;
    } else {
      const bucket = groupBy === 'day' ? 'day' : 'week';
      sql = `
        SELECT date_trunc('${bucket}', l.started_at)                      AS bucket,
               COUNT(*)::int                                              AS total,
               COUNT(*) FILTER (WHERE l.status = 'answered')::int         AS answered,
               COUNT(*) FILTER (WHERE l.status <> 'answered')::int        AS not_answered,
               ROUND(100.0 * COUNT(*) FILTER (WHERE l.status <> 'answered')
                     / NULLIF(COUNT(*), 0), 1)                            AS not_answered_rate,
               COALESCE(ROUND(AVG(l.duration_sec)
                     FILTER (WHERE l.status = 'answered'))::int, 0)       AS avg_talk_sec
          FROM call_consult_log l
         WHERE ${whereSql}
         GROUP BY bucket
         ORDER BY bucket`;
    }

    const { rows } = await db.query(sql, params);
    return { range: { from: from.toISOString(), to: to.toISOString() }, group_by: groupBy, count: rows.length, rows };
  },
};
