import '../widgets/damage_notice_slip.dart';

/// ทะเบียนของ "ใบเอกสารหน้างาน" ทั้งหมด + ท้ายใบรายบริษัทประกัน
///
/// แยกออกมาเป็นไฟล์ข้อมูลล้วน เพื่อให้เพิ่มแบบใบ/เพิ่มบริษัท = แก้ที่นี่ที่เดียว
/// ไม่ต้องแตะทั้ง widget ที่วาดใบและหน้าจอที่เรียกใช้

// ────────────────────────── ท้ายใบรายบริษัท ──────────────────────────

/// ท้ายใบ **ต่างกันมากกว่าที่คิด ไม่ใช่แค่มี/ไม่มี QR** — กำหนดวันติดต่อก็คนละเลข
/// (ไอโออิ 7 วัน · ไทยไพบูลย์ 15 วัน) ถ้าพิมพ์ผิดบริษัท ลูกค้าจะได้กำหนดเวลาผิด
///
/// คีย์ = รหัสบริษัทประกันของระบบประกัน (ทำอยู่จริง 2 บริษัท)
const Map<String, InsurerFooter> kInsurerFooters = {
  // ไอโออิ กรุงเทพ ประกันภัย
  '1059': InsurerFooter(
    lines: [
      '*** กรุณาติดต่อบริษัทฯภายใน 7 วัน',
      'บริษัทไอโออิ กรุงเทพ ประกันภัย จำกัด (มหาชน)',
      'ฝ่ายสินไหม 02-7808000 กด 7',
      '(เวลา 08:30-16:30น.)',
    ],
    caption: 'ท่านสามารถตรวจสอบรายชื่อสาขา/ศูนย์/อู่ในสัญญา ได้โดยการสแกน QR Code',
    // ชี้โดเมนของเราเอง ไม่ใช่ se.isurvey.mobi ของระบบเก่า — ใบที่แจกไปแล้วอยู่ในมือคนนอก
    // เรียกกลับไม่ได้ ถ้าโดเมนเก่าตายเมื่อไหร่ QR บนใบเก่าทุกใบตายตาม
    qrUrl: 'https://survey.sesurvey.cloud/branches/1059',
  ),
  // ไทยไพบูลย์ประกันภัย — ไม่ใช้ QR พิมพ์ลิงก์เป็นข้อความลงบนใบเลย (กติกา user)
  '2429': InsurerFooter(
    lines: [
      '*** กรุณาติดต่อบริษัทฯภายใน 15 วัน',
      'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)',
      'ติดต่อสำนักงานใหญ่ กทม. กด 1525',
      'ติดต่อสาขาปริมณฑล กด 4019',
      'ติดต่อฝ่ายสินไหมรถยนต์ฝ่ายราคา กด 4007',
    ],
    caption: 'ท่านสามารถตรวจสอบรายชื่อในเครือ',
    linkText: 'ได้ตามลิ้งค์ https://thaipaiboon.com',
  ),
};

/// จับชื่อบริษัทที่พนักงานพิมพ์ (ข้อความอิสระ เขียนไม่สม่ำเสมอ) → รหัสบริษัท
///
/// ในระบบไม่มีตาราง master บริษัทประกันและช่องเป็น free text — เคสจริงเจอทั้ง
/// 'ไทยไพบูลย์ประกันภัย' และ 'บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)' ในเคลมเดียวกัน
/// จึงจับด้วยคำหลักแทนการเทียบทั้งสตริง
String? insurerCodeFromName(String raw) {
  final s = raw.replaceAll(' ', '');
  if (s.contains('ไอโออิ') || s.toUpperCase().contains('AIOI')) return '1059';
  if (s.contains('ไทยไพบูลย์')) return '2429';
  return null;
}

// ────────────────────────── แบบใบทั้ง 10 ──────────────────────────

/// ใบผูกกับ "ใคร" — ตัวนี้กำหนดว่าต้องเลือกคู่กรณี/ผู้บาดเจ็บคันไหนก่อนพิมพ์
enum SlipSubject {
  insuredCar('รถประกัน'),
  opponentCar('รถคู่กรณี'),
  injured('ผู้บาดเจ็บ/เสียชีวิต'),
  property('ทรัพย์สิน'),
  payment('รับเงินค่าเสียหาย');

  const SlipSubject(this.label);
  final String label;
}

/// นิยามของใบ 1 แบบ — ยังไม่ใช่ข้อมูลจริง เป็นแค่ "แบบนี้มีบล็อกอะไรบ้าง"
class SlipType {
  const SlipType({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.subject,
    required this.signers,
    this.ready = true,
    this.showDamages = true,
    this.showDeductible = false,
    this.showNote = true,
    this.showInjuredRole = false,
    this.note,
    this.docsTitle,
    this.docs = const [],
    this.docsFootnote,
    this.certifyText = kCertifyDamage,
  });

  final String id;
  final String title;
  final String subtitle;
  final SlipSubject subject;

  /// ป้ายใต้ช่องเซ็น — ใบทั่วไปมีช่องเดียว **ใบบันทึกรับเงินมี 3 ช่อง**
  /// (ผู้รับเงิน · ผู้ชำระเงิน · ผู้ขับขี่รถประกัน/พยาน)
  final List<String> signers;

  /// false = รู้แค่หัวกระดาษ ยังไม่เคยเห็นเนื้อในใบจริง → โชว์ในรายการแต่กดพิมพ์ไม่ได้
  /// ดีกว่าเดาเนื้อหาเอกสารที่คนนอกต้องเซ็นรับรอง
  final bool ready;

  final bool showDamages;
  final bool showDeductible;

  /// ใบรถมีบรรทัด "*หมายเหตุ" เสมอ (เว้นให้เขียนมือ) — ใบทรัพย์สิน/ผู้บาดเจ็บ/รับเงินไม่มี
  final bool showNote;

  /// บรรทัด "ตำแหน่งขณะเกิดเหตุ" (ผู้ขับขี่/ผู้โดยสาร รถประกัน/คู่กรณี)
  /// **มีเฉพาะใบหลักฐานผู้บาดเจ็บ · ใบติดต่อผู้บาดเจ็บไม่มี** (เทียบใบจริงอย่างละ 2 ใบ)
  final bool showInjuredRole;
  final String? note;
  final String? docsTitle;
  final List<String> docs;
  final String? docsFootnote;
  final String? certifyText;

  String get name => '$title $subtitle';
}

const kCertifyDamage = 'ข้าพเจ้าได้ตรวจสอบรายการความเสียหายที่ระบุไว้ข้างต้น '
    'ขอรับรองว่า ครบถ้วนถูกต้องทุกประการ';

/// ใบทรัพย์สินใช้คำรับรองคนละประโยคกับใบรถ (คัดจากใบจริง 26/08/69)
const kCertifyProperty =
    'ขอรับรองว่ารายละเอียดอุบัติเหตุและความเสียหายข้างต้นถูกต้องทุกประการ';

/// ใบบันทึกรับเงิน — เป็นการรับรอง "ได้รับเงินแล้ว" ไม่ใช่รับรองรายการความเสียหาย
const kCertifyPayment = '*ข้าพเจ้าขอยืนยันว่าได้รับเงินเป็นการชดใช้ค่าเสียหาย '
    'ดังกล่าวข้างต้นไว้ครบถ้วนถูกต้องแล้ว';

/// เอกสาร 3 อย่างที่คู่กรณีต้องเตรียมไปติดต่อบริษัทประกัน (คัดจากใบจริง)
const _kContactDocs = [
  'สำเนาบัตรประชาชนเจ้าของรถ / ผู้ครอบครอง',
  'สำเนาทะเบียนรถ',
  'สำเนากรมธรรม์ประกันภัย',
];

const _kContactFootnote = 'เอกสารนี้ใช้เพื่ออ้างอิงการติดต่อกับบริษัทฯเท่านั้น';

/// ⛔ **ทุกแบบในนี้ต้องมีใบจริงรองรับ ห้ามเติมให้ครบตาราง**
///
/// เคยพลาดมาแล้ว: ตอนวางทะเบียนครั้งแรก (`32987d7`) ผมจัดเป็นตาราง "5 หมวด × 2 แบบ"
/// แล้วเติม `pay_receipt_prop` (ใบบันทึกรับเงินฝั่งทรัพย์สิน) เข้าไปให้ครบช่อง
/// **ทั้งที่ไม่เคยเห็นใบจริง** — user ทักเอง 27/08/69 จึงถอดออก
/// เอกสารที่คนนอกต้องเซ็นรับรอง เดาจากรูปแบบไม่ได้
const List<SlipType> kSlipTypes = [
  SlipType(
    id: 'ins_damage',
    title: 'ใบแจ้งความเสียหาย',
    subtitle: 'รถประกัน',
    subject: SlipSubject.insuredCar,
    signers: ['ผู้ขับขี่รถประกัน'],
    showDeductible: true,
  ),
  SlipType(
    id: 'ins_contact',
    title: 'ใบติดต่อ',
    subtitle: 'รถประกัน',
    subject: SlipSubject.insuredCar,
    signers: ['ผู้ขับขี่รถประกัน'],
    showDamages: false,
    note: 'หมายเหตุ ติดต่อ บริษัทประกันภัยของท่านก่อนจัดซ่อม',
    docsTitle: 'เอกสารที่ใช้ในการติดต่อ',
    docs: _kContactDocs,
    docsFootnote: _kContactFootnote,
    certifyText: null,
  ),
  SlipType(
    id: 'opp_damage',
    title: 'ใบแจ้งความเสียหาย',
    subtitle: 'รถคู่กรณี',
    subject: SlipSubject.opponentCar,
    signers: ['ผู้ขับขี่รถคู่กรณี'],
  ),
  SlipType(
    id: 'opp_contact',
    title: 'ใบติดต่อ',
    subtitle: 'รถคู่กรณี',
    subject: SlipSubject.opponentCar,
    signers: ['ผู้ขับขี่รถคู่กรณี'],
    note: 'หมายเหตุ ติดต่อ บริษัทประกันภัยของท่านก่อนจัดซ่อม',
    docsTitle: 'เอกสารที่ใช้ในการติดต่อ',
    docs: _kContactDocs,
    docsFootnote: _kContactFootnote,
    certifyText: null,
  ),
  // ── ทรัพย์สิน / ผู้บาดเจ็บ / รับเงิน — เนื้อใบจาก user 26/08/69 ──
  //
  // ต่างจากใบรถ 3 อย่าง: ไม่มีตารางความเสียหาย (ใช้บรรทัด "รายละเอียด…" แทน) ·
  // ไม่มีบรรทัด "*หมายเหตุ" · มี "วันที่เกิดเหตุ"/"เลขที่รับแจ้ง" เพิ่มมาบนหัวใบ
  SlipType(
    id: 'inj_evidence',
    title: 'ใบหลักฐาน',
    // ใบจริงพิมพ์ว่า "ผู้บาดเจ็บ" เฉย ๆ ไม่ใช่ "การบาดเจ็บ/เสียชีวิต" ที่ผมเดาไว้ตอนแรก
    subtitle: 'ผู้บาดเจ็บ',
    subject: SlipSubject.injured,
    signers: ['ผู้รับหลักฐาน ผู้บาดเจ็บ'],
    showDamages: false,
    showNote: false,
    // ต่างจากใบติดต่อผู้บาดเจ็บ **บรรทัดเดียว** คือ "ตำแหน่งขณะเกิดเหตุ" (ใบจริง 27/08/69)
    showInjuredRole: true,
  ),
  SlipType(
    id: 'inj_contact',
    title: 'ใบติดต่อ',
    subtitle: 'ผู้บาดเจ็บ',
    subject: SlipSubject.injured,
    signers: ['ผู้รับหลักฐาน ผู้บาดเจ็บ'],
    showDamages: false,
    showNote: false,
    // ⛔ ใบติดต่อของผู้บาดเจ็บ **ไม่มีรายการ "เอกสารที่ใช้ในการติดต่อ"** ต่างจากใบติดต่อรถ
    //    (ตรวจกับใบจริง 2 ใบ) อย่าเผลอยก _kContactDocs มาใส่
  ),
  SlipType(
    id: 'prop_evidence',
    title: 'ใบหลักฐาน',
    subtitle: 'ความเสียหายทรัพย์สิน',
    subject: SlipSubject.property,
    signers: ['ผู้รับหลักฐาน/เจ้าของทรัพย์สิน'],
    showDamages: false,
    showNote: false,
    certifyText: kCertifyProperty,
  ),
  // ใบติดต่อทรัพย์สิน = ใบหลักฐานทรัพย์สินทุกบรรทัด **ต่างแค่หัวเรื่อง**
  // (เทียบใบจริง 2 ใบจากเคสเดียวกัน) — จงใจไม่ยุบรวม เพราะเป็นคนละเอกสารในสำนวน
  SlipType(
    id: 'prop_contact',
    title: 'ใบติดต่อ',
    subtitle: 'ความเสียหายทรัพย์สิน',
    subject: SlipSubject.property,
    signers: ['ผู้รับหลักฐาน/เจ้าของทรัพย์สิน'],
    showDamages: false,
    showNote: false,
    certifyText: kCertifyProperty,
  ),
  SlipType(
    id: 'pay_receipt_car',
    // หัวเรื่องบรรทัดเดียว (subtitle ว่าง) ต่างจากใบอื่นที่เป็น 2 บรรทัด
    title: 'ใบบันทึกรับเงินค่าเสียหาย',
    subtitle: '',
    subject: SlipSubject.payment,
    signers: ['ผู้รับเงิน', 'ผู้ชำระเงิน', 'ผู้ขับขี่รถประกัน/พยาน'],
    showDamages: false,
    showNote: false,
    certifyText: kCertifyPayment,
  ),
];
