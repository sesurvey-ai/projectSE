/**
 * เล่นซ้ำการคิดเงินจริงจากระบบเดิม — ยามเฝ้าโค้ดคิดเงิน
 *
 * `backend/tests/fixtures/billing_captures.json` = ยอดที่ **se-billing คิดจริงบนหน้า ISURVEY**
 * 32 งาน (ยกมาจากตาราง captures) พร้อมอินพุตครบ · ไฟล์เรทยกมาจากแหล่งเดียวกับ seed
 *
 * เทสนี้ป้อนอินพุตเดิมเข้าเครื่องคิดเลขตัวใหม่ แล้วเทียบผลกับของเดิมทีละบาท
 * **ต่างแม้บาทเดียว = พอร์ตสูตรพลาด** — คิดเงินผิดคือบั๊กที่รู้ตัวช้าที่สุดในระบบนี้
 *
 * ไม่ต่อฐานข้อมูล (เรียก computePay ตรง ๆ) จึงรันที่ไหนก็ได้
 *
 * รัน:  npx ts-node --transpile-only tests/pay.replay.test.ts
 */
import { computePay, PayInput, ResolvedRates } from '../src/services/pay.service';

/* eslint-disable @typescript-eslint/no-var-requires */
const captures = require('./fixtures/billing_captures.json') as Capture[];
const rates = require('./fixtures/billing_rates.json') as RateFixture;

interface Capture {
  id: number;
  province_id: string | null;
  amphur_id: string | null;
  tumbon_id: string | null;
  mtype_id: string | null;
  surveyor_name: string | null;
  is_se: number | null;
  sur_invest: number | null;
  ins_invest: number | null;
  ins_trans: number | null;
  ins_photo: number | null;
  out_of_area_amt: number | null;
  out_of_hours_amt: number | null;
  deduct_amt: number | null;
  oss_company: string | null;
}

interface RateFixture {
  amphur: Record<string, Record<string, unknown>>;
  tumbon: Record<string, Record<string, unknown>>;
  province: Record<string, { sur_invest: number }>;
  teams: Record<string, string>;
}

const teamOf = (name: string | null): string | null => {
  const m = /\b(SEC\d+)\b/i.exec(name || '');
  return m ? rates.teams[m[1].toUpperCase()] ?? null : null;
};

const lookup = (c: Capture): ResolvedRates => ({
  amphur: c.amphur_id ? (rates.amphur[c.amphur_id] as never) ?? null : null,
  tumbon: c.tumbon_id ? (rates.tumbon[c.tumbon_id] as never) ?? null : null,
  province: c.province_id ? rates.province[c.province_id] ?? null : null,
});

let pass = 0;
const fails: string[] = [];
const skipped: string[] = [];

for (const c of captures) {
  // แถวที่ระบบเดิมไม่ได้เติมยอดให้ (เช่น OSS ที่ผู้ใช้กรอกเอง) ไม่มีอะไรให้เทียบ
  if (c.sur_invest === null && c.ins_invest === null) {
    skipped.push(`#${c.id} (ระบบเดิมไม่ได้เติมยอด — OSS/กรอกเอง)`);
    continue;
  }

  const input: PayInput = {
    provinceId: c.province_id,
    amphurId: c.amphur_id,
    tumbonId: c.tumbon_id,
    mtypeId: c.mtype_id,
    team: teamOf(c.surveyor_name),
    isSE: c.is_se !== 0,
    outOfArea: c.out_of_area_amt,
    outOfHours: c.out_of_hours_amt,
    deduct: c.deduct_amt,
  };

  const got = computePay(lookup(c), input);
  const diff: string[] = [];
  const cmp = (label: string, expected: number | null, actual: number | null) => {
    // ระบบเดิมบางแถวเว้นช่องไว้ (null) ทั้งที่มีเรท — เทียบเฉพาะแถวที่ของเดิมมีค่า
    if (expected === null) return;
    if (Number(expected) !== Number(actual)) diff.push(`${label} ควร ${expected} แต่ได้ ${actual}`);
  };
  cmp('sur_invest', c.sur_invest, got.surInvest);
  cmp('ins_invest', c.ins_invest, got.insInvest);
  cmp('ins_trans', c.ins_trans, got.insTrans);
  cmp('ins_photo', c.ins_photo, got.insPhoto);

  if (diff.length) {
    fails.push(`#${c.id} อำเภอ ${c.amphur_id} mtype ${c.mtype_id} ทีม ${input.team ?? '-'}\n     ${diff.join('\n     ')}`);
  } else {
    pass++;
  }
}

console.log(`\nเล่นซ้ำการคิดเงิน ${captures.length} งาน`);
console.log(`  ตรง   ${pass}`);
console.log(`  ต่าง  ${fails.length}`);
console.log(`  ข้าม  ${skipped.length}`);
skipped.forEach((s) => console.log(`     ${s}`));
if (fails.length) {
  console.log('\n❌ ผลไม่ตรงกับระบบเดิม:');
  fails.forEach((f) => console.log(`  ${f}`));
  process.exit(1);
}
console.log('\n✅ ตรงกับระบบเดิมทุกงาน');
