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
    required this.signerLabel,
    this.ready = true,
    this.showDamages = true,
    this.showDeductible = false,
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
  final String signerLabel;

  /// false = รู้แค่หัวกระดาษ ยังไม่เคยเห็นเนื้อในใบจริง → โชว์ในรายการแต่กดพิมพ์ไม่ได้
  /// ดีกว่าเดาเนื้อหาเอกสารที่คนนอกต้องเซ็นรับรอง
  final bool ready;

  final bool showDamages;
  final bool showDeductible;
  final String? note;
  final String? docsTitle;
  final List<String> docs;
  final String? docsFootnote;
  final String? certifyText;

  String get name => '$title $subtitle';
}

const kCertifyDamage = 'ข้าพเจ้าได้ตรวจสอบรายการความเสียหายที่ระบุไว้ข้างต้น '
    'ขอรับรองว่า ครบถ้วนถูกต้องทุกประการ';

/// เอกสาร 3 อย่างที่คู่กรณีต้องเตรียมไปติดต่อบริษัทประกัน (คัดจากใบจริง)
const _kContactDocs = [
  'สำเนาบัตรประชาชนเจ้าของรถ / ผู้ครอบครอง',
  'สำเนาทะเบียนรถ',
  'สำเนากรมธรรม์ประกันภัย',
];

const _kContactFootnote = 'เอกสารนี้ใช้เพื่ออ้างอิงการติดต่อกับบริษัทฯเท่านั้น';

/// 10 แบบ = 5 หมวด × (ใบหลักฐาน/แจ้งความเสียหาย + ใบติดต่อ)
///
/// ✅ 4 แบบแรกมีตัวอย่างใบจริงครบทั้งใบ · ⏳ ที่เหลือเห็นแค่หัวกระดาษ (`ready: false`)
const List<SlipType> kSlipTypes = [
  SlipType(
    id: 'ins_damage',
    title: 'ใบแจ้งความเสียหาย',
    subtitle: 'รถประกัน',
    subject: SlipSubject.insuredCar,
    signerLabel: 'ผู้ขับขี่รถประกัน',
    showDeductible: true,
  ),
  SlipType(
    id: 'ins_contact',
    title: 'ใบติดต่อ',
    subtitle: 'รถประกัน',
    subject: SlipSubject.insuredCar,
    signerLabel: 'ผู้ขับขี่รถประกัน',
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
    signerLabel: 'ผู้ขับขี่รถคู่กรณี',
  ),
  SlipType(
    id: 'opp_contact',
    title: 'ใบติดต่อ',
    subtitle: 'รถคู่กรณี',
    subject: SlipSubject.opponentCar,
    signerLabel: 'ผู้ขับขี่รถคู่กรณี',
    note: 'หมายเหตุ ติดต่อ บริษัทประกันภัยของท่านก่อนจัดซ่อม',
    docsTitle: 'เอกสารที่ใช้ในการติดต่อ',
    docs: _kContactDocs,
    docsFootnote: _kContactFootnote,
    certifyText: null,
  ),
  // ── ยังไม่เคยเห็นเนื้อในใบจริง มีแต่หัวกระดาษ ──
  SlipType(
    id: 'inj_evidence',
    title: 'ใบหลักฐาน',
    subtitle: 'การบาดเจ็บ/เสียชีวิต',
    subject: SlipSubject.injured,
    signerLabel: 'ผู้บาดเจ็บ',
    ready: false,
  ),
  SlipType(
    id: 'inj_contact',
    title: 'ใบติดต่อ',
    subtitle: 'ผู้บาดเจ็บเสียชีวิต',
    subject: SlipSubject.injured,
    signerLabel: 'ผู้บาดเจ็บ',
    showDamages: false,
    ready: false,
  ),
  SlipType(
    id: 'prop_evidence',
    title: 'ใบหลักฐาน',
    subtitle: 'ความเสียหายทรัพย์สิน',
    subject: SlipSubject.property,
    signerLabel: 'เจ้าของทรัพย์สิน',
    ready: false,
  ),
  SlipType(
    id: 'prop_contact',
    title: 'ใบติดต่อ',
    subtitle: 'ความเสียหายทรัพย์สิน',
    subject: SlipSubject.property,
    signerLabel: 'เจ้าของทรัพย์สิน',
    showDamages: false,
    ready: false,
  ),
  SlipType(
    id: 'pay_receipt_car',
    title: 'ใบบันทึกรับเงิน',
    subtitle: 'ค่าเสียหาย (รถ)',
    subject: SlipSubject.payment,
    signerLabel: 'ผู้รับเงิน',
    showDamages: false,
    ready: false,
  ),
  SlipType(
    id: 'pay_receipt_prop',
    title: 'ใบบันทึกรับเงิน',
    subtitle: 'ค่าเสียหาย (ทรัพย์สิน)',
    subject: SlipSubject.payment,
    signerLabel: 'ผู้รับเงิน',
    showDamages: false,
    ready: false,
  ),
];
