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
  // หัวหน้า "whitelist รวม" — ทุก surveyor เห็นชุดเดียวกัน
  // คืน 1 entry ต่อ 1 เบอร์ (หัวหน้า 1 คนมีได้หลายเบอร์: ส่วนตัว/ออฟฟิศ)
  // _staffId คงไว้เป็น signature เดิม (sync เรียกใช้) แต่ไม่ได้กรองตามคนแล้ว
  async supervisorsFor(_staffId: number) {
    const { rows } = await db.query(
      `SELECT s.id AS supervisor_id, s.name, n.number
         FROM consult_supervisors s
         JOIN consult_supervisor_numbers n ON n.supervisor_id = s.id
        WHERE s.is_active = true
        ORDER BY s.id, n.id`
    );
    return rows.map((r: { supervisor_id: number; name: string; number: string }) => ({
      supervisor_id: r.supervisor_id,
      name: r.name,
      number: normalizePhone(r.number),
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

    // started_at เก็บเป็น TIMESTAMP (naive) = เวลา UTC (Postgres session tz = UTC) →
    // แปลงเป็นเวลาไทยก่อน filter/bucket ให้ตรงกับส่วนอื่นของระบบ (attendance/leave ใช้ Asia/Bangkok)
    // เดิม date_trunc/filter ทำบนเวลา UTC → รายงานราย วัน/สัปดาห์ ตัดวันเพี้ยนไป 7 ชม.
    const bkk = "(l.started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok')";
    const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

    // from/to = วันที่แบบไทย (YYYY-MM-DD); รูปแบบผิด/ไม่ส่ง → ใช้ default (กัน 500 จาก Invalid Date เดิมที่ toISOString throw)
    const dayMs = 86400000;
    const bkkDate = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const fromStr = isDate(q.from) ? String(q.from) : bkkDate(new Date(Date.now() - 30 * dayMs));
    const toStr = isDate(q.to) ? String(q.to) : bkkDate(new Date(Date.now() + dayMs));

    const where: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    where.push(`${bkk} >= $${p++}::timestamp`); params.push(fromStr);
    where.push(`${bkk} <  $${p++}::timestamp`); params.push(toStr);
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
               s.name                                                     AS supervisor_name,
               (SELECT n.number FROM consult_supervisor_numbers n
                 WHERE n.supervisor_id = s.id ORDER BY n.id LIMIT 1)       AS supervisor_number,
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
          LEFT JOIN consult_supervisors s ON s.id = l.supervisor_id
         WHERE ${whereSql}
         GROUP BY l.supervisor_id, s.id, s.name
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
        SELECT date_trunc('${bucket}', ${bkk})                            AS bucket,
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
    return { range: { from: fromStr, to: toStr }, group_by: groupBy, count: rows.length, rows };
  },
};
