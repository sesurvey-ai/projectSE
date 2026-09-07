'use client';

/**
 * หน้าต่าง "ข้อมูลกรมธรรม์" — วาดชุดข้อมูลแท็บ 7 ของ ISURVEY (survey_reports.policy_info, migration 053)
 * ให้หน้าตาใกล้เคียงแท็บ 7 ที่หัวหน้าคุ้น (user ขอ 07/09/69 "จับภาพแท็บ 7 มาเป็นปุ่มบนแถบกรมธรรม์")
 *
 * ทำไมไม่เก็บเป็นรูป: ตัวดึงงานบนเซิร์ฟเวอร์อ่าน ISURVEY ผ่าน API ไม่มีเบราว์เซอร์ให้จับภาพ · ข้อมูลเป็นข้อความ
 * ก๊อปได้/ค้นได้ และวาดใหม่ได้เมื่อต้นทางเปลี่ยน (อนาคต web service ไอโออิใช้ชุดคีย์คล้ายกัน)
 * แสดงอย่างเดียว — ช่องที่แก้ได้อยู่ในฟอร์มหลัก (เลขกรมธรรม์/พรบ./ส่วนแรก/ซ่อมที่)
 */
type Info = Record<string, string | number | null | undefined>;

const v = (info: Info, k: string): string => {
  const x = info[k];
  if (x === null || x === undefined) return '';
  const s = String(x).trim();
  return s.toLowerCase() === 'null' ? '' : s;
};
const dash = (s: string) => (s ? s : '-');
/** วันที่ ISO (2026-03-19) → 19/03/2026 · อย่างอื่นคืนตามเดิม */
const dmy = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
/** ตัวเลขเงิน: ใส่คอมมา (ต้นทางส่งมาทั้ง "490,000" และ "490000") · ว่าง = 0 */
const amt = (s: string) => {
  const n = Number(String(s).replace(/,/g, ''));
  if (!s) return '0';
  return Number.isFinite(n) ? n.toLocaleString('th-TH') : s;
};

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex gap-2 text-sm ${wide ? 'col-span-2' : ''}`}>
      <span className="w-36 shrink-0 text-gray-500 text-right">{label}:</span>
      <span className="font-semibold text-gray-800 break-words min-w-0">{dash(value)}</span>
    </div>
  );
}

function Money({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm pl-3">
      <span className="text-gray-600">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-gray-800">{amt(value)}</span>
      <span className="w-16 text-gray-500 text-xs">{unit}</span>
    </div>
  );
}

export default function PolicyInfoModal({ info, claimNo, onClose }: { info: Info; claimNo?: string; onClose: () => void }) {
  const drivers = [1, 2, 3, 4, 5].map((i) => v(info, `drv_name${i}`)).filter(Boolean);
  const plate = `${v(info, 'plate_no')} ${v(info, 'plate_provinceID')}`.trim();
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-5xl shadow-xl mt-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: '#1E3E82' }}>
          <span className="text-white font-bold">ข้อมูลกรมธรรม์ (จาก ISURVEY แท็บ 7)</span>
          <span className="text-blue-100 text-xs">แสดงอย่างเดียว · ช่องที่แก้ได้อยู่ในฟอร์มหลัก</span>
          <button type="button" onClick={onClose} className="ml-auto text-white text-xl leading-none hover:text-gray-300" title="ปิด">×</button>
        </div>

        {/* ── ส่วนหัว: กรมธรรม์ + รถ (เรียงตามแท็บ 7) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 px-4 py-3 border-b border-gray-200">
          <Row label="หมายเลขเคลม" value={claimNo || v(info, 'claim_no')} />
          <Row label="กรมธรรม์เลขที่" value={v(info, 'policy_no')} />
          <Row label="ประเภท" value={v(info, 'policy_TypeID')} />
          <Row label="ต่ออายุครั้งที่" value={v(info, 'policy_extended_times') || '0'} />
          <Row label="ชื่อผู้เอาประกัน" value={v(info, 'assured_name')} />
          <Row label="เบอร์โทรศัพท์" value={v(info, 'assured_phone')} />
          <Row label="ค้างชำระ" value={`${v(info, 'debt') || '0'}  (V): ${v(info, 'DEBT_V') || '0 บาท'}  (C): ${v(info, 'DEBT_C') || '0 บาท'}`} wide />
          <Row label="ผู้ขับขี่ตามกรมธรรม์" value={drivers.length ? drivers.join(' / ') : 'ไม่ระบุผู้ขับขี่'} wide />
          <Row label="ทะเบียนรถ" value={plate} />
          <Row label="ซ่อมที่" value={v(info, 'repair_code')} />
          <Row label="ยี่ห้อรถ" value={v(info, 'car_brand')} />
          <Row label="รุ่น" value={v(info, 'car_model')} />
          <Row label="เลขเครื่องยนต์" value={v(info, 'engine_no')} />
          <Row label="เลขตัวถัง" value={v(info, 'chassis_no')} />
          <Row label="สีรถ" value={v(info, 'car_color')} />
          <Row label="UseNo" value={v(info, 'vehType')} />
          <Row label="วันที่คุ้มครอง" value={dmy(v(info, 'effective_date'))} />
          <Row label="วันที่สิ้นสุด" value={dmy(v(info, 'expiry_date'))} />
          <Row label="ผู้รับผลประโยชน์" value={v(info, 'beneficiary')} />
          <Row label="ตัวแทน / ฝ่าย" value={`${v(info, 'insurance_agent')} ${v(info, 'insurance_dept')}`.trim()} />
          <Row label="การสลักหลังกรมธรรม์" value={v(info, 'ENDORSMENT')} wide />
          <Row label="เงื่อนไขพิเศษ" value={v(info, 'SPECL_COND')} wide />
        </div>

        {/* ── วงเงินความคุ้มครอง 3 กลุ่ม ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 border-b border-gray-200">
          <div className="p-3 space-y-1">
            <div className="text-sm font-semibold text-gray-700">ความรับผิดชอบต่อบุคคลภายนอก</div>
            <div className="text-xs text-gray-500">1) ความเสียหายต่อชีวิต ร่างกาย หรืออนามัย (เฉพาะส่วนเกินวงเงินสูงสุดตาม พรบ.)</div>
            <Money label="" value={v(info, 'TPBI_PERSON')} unit="บาท/คน" />
            <Money label="" value={v(info, 'TPBI_ACC')} unit="บาท/ครั้ง" />
            <div className="text-xs text-gray-500 pt-1">2) ความเสียหายต่อทรัพย์สิน</div>
            <Money label="" value={v(info, 'TPPD')} unit="บาท" />
            <div className="text-xs text-red-600 pt-1">3) ความเสียหายส่วนแรก</div>
            <Money label="" value={v(info, 'TPDD')} unit="บาท/ครั้ง" />
          </div>
          <div className="p-3 space-y-1">
            <div className="text-sm font-semibold text-gray-700">รถยนต์เสียหาย / สูญหายไฟไหม้</div>
            <div className="text-xs text-gray-500">1) ความเสียหายต่อรถยนต์</div>
            <Money label="" value={v(info, 'ODSI')} unit="บาท/ครั้ง" />
            <div className="text-xs text-red-600 pt-1">1.1 ความเสียหายส่วนแรก</div>
            <Money label="" value={v(info, 'ODDD')} unit="บาท/ครั้ง" />
            <div className="text-xs text-gray-500 pt-1">2) รถยนต์สูญหาย ไฟไหม้</div>
            <Money label="" value={v(info, 'ODFT')} unit="บาท" />
          </div>
          <div className="p-3 space-y-1">
            <div className="text-sm font-semibold text-gray-700">1) ร.ย.01 &nbsp;1.1 เสียชีวิต สูญเสียอวัยวะ ทุพพลภาพถาวร</div>
            <Money label="ก. ผู้ขับขี่" value={v(info, 'MV01PER_DRV')} unit="บาท" />
            <Money label={`ข. ผู้โดยสาร ${v(info, 'MV01PER_NUM') || '0'} คน`} value={v(info, 'MV01PER_PSG')} unit="บาท/คน" />
            <div className="text-xs text-gray-500 pt-1">1.2 ทุพพลภาพชั่วคราว</div>
            <Money label="ก. ผู้ขับขี่" value={v(info, 'MV01TEM_DRV')} unit="บาท" />
            <Money label={`ข. ผู้โดยสาร ${v(info, 'MV01TEM_NUM') || '0'} คน`} value={v(info, 'MV01TEM_PSG')} unit="บาท/คน" />
            <div className="text-sm font-semibold text-gray-700 pt-1">2) ร.ย.02</div>
            <Money label="" value={v(info, 'MV02MED')} unit="บาท/คน" />
            <div className="text-sm font-semibold text-gray-700">3) ร.ย.03</div>
            <Money label="" value={v(info, 'MV03BAIL')} unit="บาท/ครั้ง" />
          </div>
        </div>

        {/* ── พรบ. + เงื่อนไข ── */}
        <div className="px-4 py-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
            <Row label="พรบ. กรมธรรม์เลขที่" value={v(info, 'COMPULSORY_NO')} />
            <Row label="คค. วงเงิน" value={`${amt(v(info, 'COMPULSORY_PERSON'))} บาท/คน · ${amt(v(info, 'COMPULSORY_ACC'))} บาท/ครั้ง`} />
          </div>
          <div className="flex gap-2 text-sm">
            <span className="w-36 shrink-0 text-gray-500 text-right">เงื่อนไขด้านสินไหม:</span>
            <pre className="flex-1 whitespace-pre-wrap font-sans text-gray-800 border border-gray-200 p-2 min-h-[3rem]">{dash(v(info, 'CLAIM_COND'))}</pre>
          </div>
          {v(info, 'memo') && (
            <div className="flex gap-2 text-sm">
              <span className="w-36 shrink-0 text-red-600 text-right">หมายเหตุ:</span>
              <pre className="flex-1 whitespace-pre-wrap font-sans text-gray-800">{v(info, 'memo')}</pre>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 text-right">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm border border-gray-300 rounded-none hover:bg-gray-50">ปิด</button>
        </div>
      </div>
    </div>
  );
}
