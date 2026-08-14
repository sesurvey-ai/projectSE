/**
 * นำเข้าทะเบียนพนักงานสำรวจจากไฟล์ Excel ที่ฝ่ายบุคคลทำอยู่
 * ("รายชื่อพนักงานสำรวจอุบัติเหตุ (Update d-m-yy).xlsx")
 *
 * ── รูปแบบไฟล์ ────────────────────────────────────────────────────────────
 * ไฟล์จัดหน้าเป็น "บล็อกของหัวหน้า" เรียงลงมา แต่ละบล็อกกว้าง 4 คอลัมน์:
 *
 *   [ชื่อหัวหน้า]        [เบอร์]   [ควบคุมพนักงาน N คน]  [เซอร์เวย์นอก M จังหวัด]
 *   [พื้นที่]            [โทรศัพท์] [เซอร์เวย์นอก]        [โทรศัพท์]
 *   ชื่อจังหวัด/อำเภอ (ไม่มีรหัส) ← ข้าม
 *   SEC125 นาย สมภพ ...  [เบอร์]   หจก ศรีราชาเคลม ...   [เบอร์]
 *
 * ⛔ คอลัมน์ 3-4 คือ "เซอร์เวย์นอก" = ผู้รับจ้างภายนอก ไม่ใช่พนักงานเรา ห้ามสร้างบัญชีให้
 * ⚠️ ตัวเลข "ควบคุมพนักงาน N คน" ในไฟล์เป็นเลขที่คนพิมพ์เอง เคยไม่ตรงกับรายชื่อจริง
 *    → ใช้เป็นข้อมูลประกอบเท่านั้น ห้ามเอามาตัดสินอะไร
 *
 * ── หลักการ ──────────────────────────────────────────────────────────────
 * ทำ 2 จังหวะเสมอ: วางแผน (dry-run) → ให้คนดู → ค่อย apply
 * ไม่ลบบัญชีใครทิ้ง คนที่หายจากไฟล์แค่ปิดใช้งาน (is_active=false) เพราะยังมีเคส/
 * ประวัติการจ่ายเงินผูกอยู่ ลบแล้วรายงานย้อนหลังพัง
 */
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { AppError } from '../middleware/errorHandler';

const STAFF_RE = /^(SEC?)\s*(\d+)\s*(.*)$/i;
const PHONE_RE = /0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4}/;
const HEAD_RE = /ควบคุมพนักงาน/;
const THAI_RE = /[ก-๙]/;
/** คำนำหน้าชื่อ — ตัดทิ้งก่อนเทียบชื่อ ไฟล์กับระบบใส่ไม่เหมือนกัน */
const TITLE_RE = /^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|คุณ)\s*/;

export type StaffRow = { code: string; name: string; phone: string; supervisor: string };
export type ImportPlan = {
  file: { supervisors: number; staff: number; withPhone: number };
  create: Array<{ code: string; name: string; phone: string; supervisor: string }>;
  updatePhone: Array<{ id: number; code: string; who: string; from: string; to: string }>;
  updateName: Array<{ id: number; code: string; from: string; to: string }>;
  linkSupervisor: Array<{ id: number; code: string; supervisor: string; supervisorId: number }>;
  deactivate: Array<{ id: number; code: string; who: string }>;
  unknownSupervisors: string[];
  conflicts: Array<{ code: string; reason: string }>;
};

const digits = (v: string) => (PHONE_RE.exec(v || '')?.[0] || '').replace(/\D/g, '');
const bare = (v: string) => (v || '').replace(TITLE_RE, '').replace(/\s+/g, '');

/** อ่านไฟล์ → รายชื่อพนักงาน + ชื่อหัวหน้าของแต่ละคน */
export async function parseRoster(buf: Buffer): Promise<{ staff: StaffRow[]; supervisors: Map<string, string> }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new AppError(400, 'ไฟล์ Excel ไม่มีชีทข้อมูล');

  const cell = (r: number, c: number) => String(ws.getCell(r, c).text ?? '').trim();
  const staff: StaffRow[] = [];
  const supervisors = new Map<string, string>();   // ชื่อหัวหน้า -> เบอร์

  // แถวหัวบล็อก = คอลัมน์ 1 เป็นชื่อไทย และคอลัมน์ 3 มีคำว่า "ควบคุมพนักงาน"
  const heads: number[] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    if (HEAD_RE.test(cell(r, 3)) && THAI_RE.test(cell(r, 1))) heads.push(r);
  }
  if (heads.length === 0) throw new AppError(400, 'อ่านไฟล์ไม่ออก — ไม่พบหัวข้อ "ควบคุมพนักงาน" สักบล็อก');

  heads.forEach((hr, i) => {
    const end = i + 1 < heads.length ? heads[i + 1]! : ws.rowCount + 1;
    const sup = cell(hr, 1);
    supervisors.set(sup, digits(cell(hr, 2)));
    const seen = new Set<string>();
    for (let r = hr + 1; r < end; r++) {
      const m = STAFF_RE.exec(cell(r, 1));
      if (!m) continue;                       // ชื่อจังหวัด/อำเภอ — ไม่มีรหัส
      const code = (m[1] + m[2]).toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);
      staff.push({ code, name: (m[3] || '').trim(), phone: digits(cell(r, 2)), supervisor: sup });
    }
  });
  return { staff, supervisors };
}

/** เทียบไฟล์กับทะเบียนในระบบ → แผนการเปลี่ยนแปลง (ยังไม่เขียนอะไร) */
export async function planImport(buf: Buffer): Promise<ImportPlan> {
  const { staff, supervisors } = await parseRoster(buf);
  const users = await db.query(
    `SELECT id, UPPER(TRIM(code)) AS code, first_name, last_name, role, is_active,
            COALESCE(NULLIF(TRIM(phone), ''), '') AS phone
       FROM users`);
  const byCode = new Map<string, (typeof users.rows)[number]>();
  users.rows.forEach((u: { code: string | null }) => { if (u.code) byCode.set(u.code, u); });

  // หัวหน้า: จับคู่กับบัญชีในระบบด้วยชื่อ (ตัดคำนำหน้า/ช่องว่าง) — หาไม่เจอก็ไม่ผูก แต่รายงานไว้
  const supId = new Map<string, number>();
  const unknownSupervisors: string[] = [];
  for (const name of supervisors.keys()) {
    const hit = users.rows.find((u: { first_name: string; last_name: string }) =>
      bare(`${u.first_name} ${u.last_name}`) === bare(name));
    if (hit) supId.set(name, hit.id); else unknownSupervisors.push(name);
  }

  const plan: ImportPlan = {
    file: { supervisors: supervisors.size, staff: staff.length, withPhone: staff.filter((s) => s.phone).length },
    create: [], updatePhone: [], updateName: [], linkSupervisor: [],
    deactivate: [], unknownSupervisors, conflicts: [],
  };
  const inFile = new Set<string>();

  for (const s of staff) {
    if (inFile.has(s.code)) { plan.conflicts.push({ code: s.code, reason: 'รหัสซ้ำในไฟล์ — ใช้รายการแรก' }); continue; }
    inFile.add(s.code);
    const u = byCode.get(s.code);
    if (!u) { plan.create.push({ code: s.code, name: s.name, phone: s.phone, supervisor: s.supervisor }); continue; }
    const who = `${u.first_name} ${u.last_name}`.trim();
    if (s.phone && s.phone !== u.phone) plan.updatePhone.push({ id: u.id, code: s.code, who, from: u.phone, to: s.phone });
    if (s.name && bare(s.name) !== bare(who)) plan.updateName.push({ id: u.id, code: s.code, from: who, to: s.name });
    const sid = supId.get(s.supervisor);
    if (sid && sid !== u.id) plan.linkSupervisor.push({ id: u.id, code: s.code, supervisor: s.supervisor, supervisorId: sid });
  }

  // อยู่ในระบบ (ยัง active, เป็นผู้สำรวจ, มีรหัส) แต่ไม่มีในไฟล์ = ออกแล้ว → ปิดใช้งาน ไม่ลบ
  for (const u of users.rows) {
    if (u.code && u.is_active && u.role === 'surveyor' && !inFile.has(u.code)) {
      plan.deactivate.push({ id: u.id, code: u.code, who: `${u.first_name} ${u.last_name}`.trim() });
    }
  }
  return plan;
}

export type ApplyOpts = {
  newPassword?: string;
  doCreate?: boolean; doPhone?: boolean; doName?: boolean; doSupervisor?: boolean; doDeactivate?: boolean;
};

/** ลงมือแก้จริงตามแผน — เลือกได้ว่าจะทำหมวดไหนบ้าง */
export async function applyImport(buf: Buffer, opts: ApplyOpts) {
  const plan = await planImport(buf);
  const done = { created: 0, phone: 0, name: 0, supervisor: 0, deactivated: 0 };

  if (opts.doCreate && plan.create.length > 0) {
    // ⛔ ไม่ตั้งรหัสผ่านให้เอง — แอดมินต้องพิมพ์มากับคำสั่ง กันบัญชีใหม่มีรหัสที่เดาได้
    if (!opts.newPassword || opts.newPassword.length < 6) {
      throw new AppError(400, 'ต้องกำหนดรหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว) สำหรับบัญชีที่จะสร้างใหม่');
    }
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    if (opts.doCreate) {
      const hash = await bcrypt.hash(opts.newPassword as string, 10);
      for (const c of plan.create) {
        const [first, ...rest] = c.name.replace(TITLE_RE, '').trim().split(/\s+/);
        const dup = await client.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [c.code]);
        if (dup.rows.length > 0) continue;      // มี username ชนอยู่แล้ว — ข้าม ไม่ทับของเดิม
        await client.query(
          `INSERT INTO users (username, password_hash, first_name, last_name, role, code, phone)
           VALUES ($1, $2, $3, $4, 'surveyor', $5, $6)`,
          [c.code.toLowerCase(), hash, first || c.name, rest.join(' '), c.code, c.phone || null]);
        done.created++;
      }
    }
    if (opts.doPhone) {
      for (const p of plan.updatePhone) {
        await client.query('UPDATE users SET phone = $1 WHERE id = $2', [p.to, p.id]);
        done.phone++;
      }
    }
    if (opts.doName) {
      for (const n of plan.updateName) {
        const [first, ...rest] = n.to.replace(TITLE_RE, '').trim().split(/\s+/);
        await client.query('UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3',
          [first || n.to, rest.join(' '), n.id]);
        done.name++;
      }
    }
    if (opts.doSupervisor) {
      for (const l of plan.linkSupervisor) {
        await client.query('UPDATE users SET supervisor_id = $1 WHERE id = $2', [l.supervisorId, l.id]);
        done.supervisor++;
      }
    }
    if (opts.doDeactivate) {
      for (const d of plan.deactivate) {
        await client.query('UPDATE users SET is_active = false WHERE id = $1', [d.id]);
        done.deactivated++;
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { done, plan };
}
