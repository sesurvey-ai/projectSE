// พนักงานสำรวจต่างจังหวัด (SEC) — สกัดจาก captures-20260627.xlsx
// ใช้ province id เป็น "center_id" ใน duty_schedules → จัดการ/จัดเวรได้จากหน้า DutyRoster เหมือนศูนย์ กทม.
// แก้ไฟล์นี้ได้ด้วยมือ (ต่างจาก roster-jun.ts ที่ auto-extract)
// ค่าเริ่มต้นเวร: ทุกคน "เวร 1 · เช้า (07–16)" ทุกวัน (DEFAULT_SHIFT='s1') — แก้รายคน/รายวันได้ในหน้า DutyRoster

export const PROVINCE_CENTERS: { id: string; name: string; region: 'upc' }[] = [
  { id: 'chonburi', name: 'ชลบุรี', region: 'upc' },
  { id: 'rayong', name: 'ระยอง', region: 'upc' },
  { id: 'nakhonratchasima', name: 'นครราชสีมา', region: 'upc' },
  { id: 'saraburi', name: 'สระบุรี', region: 'upc' },
  { id: 'chachoengsao', name: 'ฉะเชิงเทรา', region: 'upc' },
  { id: 'ayutthaya', name: 'พระนครศรีอยุธยา', region: 'upc' },
  { id: 'khonkaen', name: 'ขอนแก่น', region: 'upc' },
  { id: 'chiangmai', name: 'เชียงใหม่', region: 'upc' },
  { id: 'songkhla', name: 'สงขลา', region: 'upc' },
  { id: 'phuket', name: 'ภูเก็ต', region: 'upc' },
  { id: 'chanthaburi', name: 'จันทบุรี', region: 'upc' },
  { id: 'kanchanaburi', name: 'กาญจนบุรี', region: 'upc' },
  { id: 'ubonratchathani', name: 'อุบลราชธานี', region: 'upc' },
  { id: 'nakhonsithammarat', name: 'นครศรีธรรมราช', region: 'upc' },
  { id: 'chumphon', name: 'ชุมพร', region: 'upc' },
  { id: 'suphanburi', name: 'สุพรรณบุรี', region: 'upc' },
  { id: 'sakaeo', name: 'สระแก้ว', region: 'upc' },
  { id: 'phitsanulok', name: 'พิษณุโลก', region: 'upc' },
];

// รายชื่อพนักงานต่อจังหวัด
const PROVINCE_PEOPLE: Record<string, { code: string; name: string }[]> = {
  chonburi: [
    { code: 'SEC218', name: 'สุธี ขัติยศ' },
    { code: 'SEC356', name: 'เกียรติศักดิ์ จำทุ่งวัง' },
    { code: 'SEC463', name: 'ภัทรา จันทร์กลาง' },
    { code: 'SEC432', name: 'นนทิกาญจน์ อังคะนาวิน' },
    { code: 'SEC343', name: 'มี วงษ์สุวรรณ' },
    { code: 'SEC125', name: 'สมภพ ปั้นเปรื่อง' },
    { code: 'SEC148', name: 'ฐนกร สดใส' },
    { code: 'SEC264', name: 'บุญศิริ ดีแก้ว' },
    { code: 'SEC189', name: 'บูรณะ ไชยศรีรัมย์' },
    { code: 'SEC212', name: 'สุธิชา วันเสี่ยน' },
    { code: 'SEC303', name: 'สมพงษ์ สีพิลา' },
    { code: 'SEC387', name: 'สุทัศน์ ปั้นเหน่ง' },
    { code: 'SEC481', name: 'อนุสรณ์ เกษมีฤทธิ์' },
  ],
  rayong: [
    { code: 'SEC473', name: 'วิจักร์ ครวญหา' },
    { code: 'SEC455', name: 'กิตติศักดิ์ สุวรรณวัฒน์' },
    { code: 'SEC216', name: 'อัศวิน บุญชู' },
    { code: 'SEC340', name: 'อุดม ทองไชย' },
  ],
  nakhonratchasima: [
    { code: 'SEC452', name: 'ธนกร ประไพ' },
    { code: 'SEC223', name: 'ภาสพงศ์ ถิ่นโพธิ์วงษ์' },
    { code: 'SEC431', name: 'สุวิชาญ สัตย์ซื่อ' },
    { code: 'SEC315', name: 'สุภพงศ์ เพ็งเพ็ชร' },
  ],
  saraburi: [
    { code: 'SEC470', name: 'รังสิมันตุ์ ดีธรรมะ' },
    { code: 'SEC475', name: 'อัฒฑวินทร์ สำราญจิตร' },
    { code: 'SEC462', name: 'สมประสงค์ โคตรวงศ์' },
    { code: 'SEC403', name: 'สุริยา ชอบรัมย์' },
  ],
  chachoengsao: [
    { code: 'SEC147', name: 'ชัยวัฒน์ วัชรเดชาพิสิทธิ์' },
    { code: 'SEC304', name: 'ฐปนพงษ์ ชุมจินดา' },
    { code: 'SEC383', name: 'ศุภชัย ออมสมสวย' },
  ],
  ayutthaya: [
    { code: 'SEC300', name: 'ณัฐพัสธร จันทร์จอม' },
    { code: 'SEC244', name: 'ชินพันธ์ ทองโคตร' },
    { code: 'SEC360', name: 'ภคพงษ์ เฉลิมฤกษ์' },
  ],
  khonkaen: [
    { code: 'SEC380', name: 'กฤติเดช เสริมศรีทอง' },
    { code: 'SEC404', name: 'ทีคิสพงศ์ กองบาง' },
    { code: 'SEC472', name: 'อุเทน คงพรม' },
  ],
  chiangmai: [
    { code: 'SEC313', name: 'วีรวิชญ์ ฐิติยาปราโมทย์' },
    { code: 'SEC202', name: 'สมเกียรติ ฟักน่วม' },
    { code: 'SEC238', name: 'ไกรสร และเชอะ' },
  ],
  songkhla: [
    { code: 'SEC444', name: 'นพรัตน์ วิมลมิ่ง' },
    { code: 'SEC474', name: 'ธีระ บัวหลวง' },
    { code: 'SEC471', name: 'มะตอเฮร์ กียะ' },
  ],
  phuket: [
    { code: 'SEC386', name: 'จีรยุทธ แสนบอโด' },
    { code: 'SEC411', name: 'พิฐากร อ่อนชื่นจิตร' },
    { code: 'SEC434', name: 'ก้องภพ พาร์คเฮาส์' },
  ],
  chanthaburi: [
    { code: 'SEC454', name: 'เอกธนัช จันทะรศ' },
    { code: 'SEC311', name: 'วุฒิศักดิ์ ชูแสง' },
  ],
  kanchanaburi: [
    { code: 'SEC372', name: 'ประกอบ รัตนวรรณ' },
    { code: 'SEC451', name: 'ปิยะณัฐ เอี่ยมโสภณ' },
  ],
  ubonratchathani: [
    { code: 'SEC398', name: 'รุ่งอรุณ ยามพูล' },
    { code: 'SEC359', name: 'กนกวรรณ บุญธรรม' },
  ],
  nakhonsithammarat: [
    { code: 'SEC358', name: 'อุดมศักดิ์ ชนะคช' },
    { code: 'SEC352', name: 'ประยูร เนียมจันทร์' },
  ],
  chumphon: [
    { code: 'SEC373', name: 'นันทวัฒน์ ทิพย์อักษร' },
    { code: 'SEC277', name: 'ไชยา ศรียาภัย' },
  ],
  suphanburi: [
    { code: 'SEC283', name: 'ณัฐพัชร์ เกิดจรัส' },
  ],
  sakaeo: [
    { code: 'SEC71', name: 'ถนอมศักดิ์ แวทไธสง' },
  ],
  phitsanulok: [
    { code: 'SEC423', name: 'สมชาติ หอมมาลา' },
  ],
};

// ค่าเริ่มต้นเวร: ทุกคนเป็น "เวร 1 · เช้า" ทุกวัน (31 วัน × จำนวนคน) — แก้รายคน/รายวันได้ในหน้า DutyRoster
const DEFAULT_SHIFT = 's1';
const fullGrid = (n: number): string[][] =>
  Array.from({ length: 31 }, () => Array(n).fill(DEFAULT_SHIFT));

// seed (shape เดียวกับ ROSTER_JUN) เพื่อ merge เข้าด้วยกันได้
export const PROVINCE_SEED: Record<string, { people: { code: string; name: string }[]; grid: string[][] }> =
  Object.fromEntries(
    Object.entries(PROVINCE_PEOPLE).map(([id, people]) => [id, { people, grid: fullGrid(people.length) }])
  );
