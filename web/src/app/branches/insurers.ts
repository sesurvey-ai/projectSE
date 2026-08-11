/**
 * ตารางลิงก์ "รายชื่อสาขา / ศูนย์-อู่ในสัญญา" แยกตามบริษัทประกัน
 *
 * QR บนใบแจ้งความเสียหายชี้มาที่ /branches/<รหัสบริษัท> (เช่น /branches/1059)
 * เดิม QR ชี้ไป se.isurvey.mobi/se_qrcode.php ซึ่งเป็นโดเมนของระบบเก่าที่กำลังจะเลิกใช้
 * ใบที่พิมพ์แจกไปแล้วอยู่ในมือคนนอก เรียกกลับไม่ได้ — วันที่โดเมนนั้นตาย QR บนใบเก่าตายตาม
 * จึงย้ายมาไว้บนโดเมนของเราเอง
 *
 * ⚠️ ห้ามเปลี่ยน path /branches/<รหัส> และห้ามลบรหัสที่เคยพิมพ์ลงใบไปแล้ว
 *    (ใบเก่าจะกลายเป็น QR เสียทันที) — ถ้าลิงก์ปลายทางย้าย ให้แก้ url ที่นี่แทน
 *
 * เพิ่มบริษัทใหม่ = เพิ่ม entry ที่นี่ที่เดียว ไม่ต้องแก้หน้าเพจ
 */
export interface InsurerBranchInfo {
  /** ชื่อบริษัทที่ขึ้นหัวหน้า */
  name: string;
  /** บรรทัดรองใต้ชื่อ เช่น "จำกัด (มหาชน)" */
  sub?: string;
  /** ตัวย่อ — ใช้แทนโลโก้ตราบใดที่ยังไม่มีไฟล์รูป */
  code: string;
  /** path รูปใน public (web/public/insurance/*.png) — ใส่ต่อเมื่อวางไฟล์แล้วจริง ไม่งั้นรูปแตกคาหน้า */
  logo?: string;
  /** ปุ่มลิงก์ เรียงตามลำดับที่อยากให้เห็นบนหน้าจอ */
  links: { label: string; url: string }[];
}

export const INSURER_BRANCH_PAGES: Record<string, InsurerBranchInfo> = {
  // ไอโออิ กรุงเทพประกันภัย — ข้อความ 2 บรรทัดนี้ยกมาจากหน้าเดิมของระบบเก่าคำต่อคำ
  '1059': {
    name: 'ไอโออิ กรุงเทพประกันภัย',
    sub: 'จำกัด (มหาชน)',
    code: 'AIOI',
    links: [
      { label: 'ตรวจสอบรายชื่อสาขา', url: 'https://www.aioibkkins.co.th/Contact/ContactBranch' },
      { label: 'ตรวจสอบรายชื่อศูนย์/อู่ในสัญญา', url: 'https://www.aioibkkins.co.th/Claim/Dealer' },
    ],
  },

  // ไทยไพบูลย์ (2429) ไม่มีที่นี่โดยตั้งใจ — ใบของไทยไพบูลย์ไม่ใช้ QR
  // แต่พิมพ์ลิงก์ https://thaipaiboon.com ลงบนใบตรง ๆ จึงยังไม่ต้องมีหน้านี้
  // ถ้าวันหน้าเปลี่ยนมาใช้ QR ค่อยเพิ่ม entry '2429'
};

/** คืน undefined เมื่อรหัสไม่รู้จัก (Record<string, T> เฉย ๆ TS จะหลอกว่าเจอเสมอ) */
export function getInsurerBranchInfo(code: string): InsurerBranchInfo | undefined {
  return INSURER_BRANCH_PAGES[code];
}
