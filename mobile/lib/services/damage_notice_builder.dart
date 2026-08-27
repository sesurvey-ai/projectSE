import '../data/damage_notice_catalog.dart';
import '../widgets/damage_notice_slip.dart';

/// แปลงข้อมูลเคสจริง (payload เดียวกับที่ฟอร์มสำรวจส่งขึ้นเซิร์ฟเวอร์) → ข้อมูลบนใบ
///
/// รับ `Map` ดิบแทนที่จะรับ model เพราะฟอร์มสำรวจเก็บทุกอย่างเป็น map อยู่แล้ว
/// (`_collectFormData()`) และ draft ที่กู้จากเครื่องก็หน้าตาเดียวกัน — ใช้ได้ทั้งตอน
/// กรอกยังไม่ส่งและตอนเปิดงานที่ส่งไปแล้ว
class DamageNoticeBuilder {
  const DamageNoticeBuilder({
    required this.report,
    required this.operatorName,
    required this.operatorPhone,
    this.printedAt,
  });

  /// payload ของฟอร์มสำรวจ (คีย์ตรงกับที่ backend รับ)
  final Map<String, dynamic> report;

  /// "SE206 นายศิริเทพ ทรงวิชาญสกุล" — รหัส + ชื่อผู้สำรวจที่ทำงานนี้
  final String operatorName;
  final String operatorPhone;

  /// เวลาที่พิมพ์ใบ — ส่งเข้ามาเพื่อให้ทดสอบได้ (ไม่ส่ง = เวลาปัจจุบัน)
  final DateTime? printedAt;

  String _s(String key) => (report[key] ?? '').toString().trim();

  /// ท้ายใบตามบริษัทประกันของเคส — จับจากชื่อที่พนักงานพิมพ์
  /// ไม่รู้จักบริษัท = คืน null ให้หน้าจอบอกผู้ใช้ ดีกว่าพิมพ์เบอร์ผิดบริษัทให้ลูกค้า
  InsurerFooter? get footer {
    final code = insurerCodeFromName(_s('insurance_company'));
    return code == null ? null : kInsurerFooters[code];
  }

  List<Map<String, dynamic>> _list(String key) {
    final raw = report[key];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// รายการคู่กรณี (ใช้ตอนเลือกว่าจะพิมพ์ใบของคันไหน)
  /// คีย์ใน payload คือ `opposing_parties` ไม่ใช่ `opponents`
  List<Map<String, dynamic>> get opponents => _list('opposing_parties');
  List<Map<String, dynamic>> get injured => _list('injured_persons');
  List<Map<String, dynamic>> get properties => _list('damaged_property');

  /// รายการที่ต้องเลือกก่อนพิมพ์ใบแบบนี้ — ว่าง = ใบนี้ไม่ผูกกับใครเป็นราย ๆ
  ///
  /// ใบบันทึกรับเงินผูกกับ**คู่กรณี** เพราะเงินรับมาจากคู่กรณีคันนั้น
  List<Map<String, dynamic>> subjectsOf(SlipType type) {
    switch (type.subject) {
      case SlipSubject.opponentCar:
      case SlipSubject.payment:
        return opponents;
      case SlipSubject.injured:
        return injured;
      case SlipSubject.property:
      case SlipSubject.paymentProperty:
        return properties;
      case SlipSubject.insuredCar:
        return const [];
    }
  }

  /// ป้ายในตัวเลือก "จะออกใบของใคร" — พยายามโชว์สิ่งที่ชี้ตัวได้จริง (ทะเบียน/ชื่อ)
  static String subjectLabel(SlipSubject subject, Map<String, dynamic> m, int i) {
    String v(String k) => (m[k] ?? '').toString().trim();
    final detail = switch (subject) {
      SlipSubject.opponentCar || SlipSubject.payment => v('plate'),
      SlipSubject.injured => v('name'),
      SlipSubject.property || SlipSubject.paymentProperty => v('item'),
      SlipSubject.insuredCar => '',
    };
    final head = subject == SlipSubject.opponentCar || subject == SlipSubject.payment
        ? 'คันที่ ${i + 1}'
        : 'รายการที่ ${i + 1}';
    return detail.isEmpty ? head : '$head · $detail';
  }

  /// สร้างใบ 1 ใบ — [index] เลือกว่าเป็นใบของคู่กรณี/ผู้บาดเจ็บ/ทรัพย์สินรายไหน
  /// (ดู [subjectsOf]) · ใบของรถประกันไม่ใช้
  DamageNoticeData build(SlipType type, {int index = 0}) {
    final f = footer;
    if (f == null) {
      throw StateError('ไม่รู้จักบริษัทประกัน "${_s('insurance_company')}" — '
          'ท้ายใบ (เบอร์ติดต่อ/กำหนดวัน) ต่างกันรายบริษัท เติมเองไม่ได้');
    }

    final isOpponent = type.subject == SlipSubject.opponentCar;
    final subjects = subjectsOf(type);
    final item = index >= 0 && index < subjects.length
        ? subjects[index]
        : const <String, dynamic>{};

    String o(String key) => (item[key] ?? '').toString().trim();

    final printedLine =
        SlipField('พิมพ์วันที่', _thaiStamp(printedAt ?? DateTime.now()));
    final accWhen = _thaiDateTime(_s('acc_date'), _s('acc_time'));
    final insuredModel = '${_s('car_brand')}/${_s('car_model')}';

    // ใบแต่ละหมวดมีชุดบรรทัดของตัวเอง — คัดทีละบรรทัดจากใบจริง ไม่ใช่ใบเดียวใช้ร่วมกัน
    final fields = <SlipField>[];
    switch (type.subject) {
      case SlipSubject.injured:
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('วันที่เกิดเหตุ', accWhen),
          SlipField('เลขที่รับแจ้ง', _s('claim_ref_no')),
          SlipField('เลขกรมธรรม์', _s('policy_no')),
          SlipField('ทะเบียนรถประกัน', _s('license_plate')),
          SlipField('ยี่ห้อ/รุ่น', insuredModel),
          SlipField('ชื่อผู้บาดเจ็บ', o('name')),
          // มีเฉพาะใบหลักฐาน ไม่มีในใบติดต่อ · ใบจริงเขียนติดกัน "ผู้โดยสารรถคู่กรณี"
          // ส่วนแอปเก็บตามป้าย master ของระบบประกัน "ผู้โดยสาร - รถคู่กรณี" → ตัดขีดออก
          // ให้หน้าตาตรงกับใบเดิมที่คนเคยเซ็น (เปลี่ยนแค่ตอนพิมพ์ ไม่แตะค่าที่เก็บ)
          if (type.showInjuredRole)
            SlipField('ตำแหน่งขณะเกิดเหตุ', o('person_type').replaceAll(' - ', '')),
          // ทะเบียนรถ**ของผู้บาดเจ็บ** (คนละคันกับรถประกัน) — คนเดินถนนก็เว้นว่างได้
          SlipField('ทะเบียนรถ', o('car_reg')),
          SlipField('รายละเอียดการบาดเจ็บ', o('symptom')),
        ]);
      case SlipSubject.property:
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('วันที่เกิดเหตุ', accWhen),
          SlipField('เลขที่รับแจ้ง', _s('claim_ref_no')),
          SlipField('เลขกรมธรรม์', _s('policy_no')),
          SlipField('ทะเบียนรถ', _s('license_plate')),
          SlipField('ยี่ห้อ/รุ่น', insuredModel),
          SlipField('ชื่อทรัพย์สิน', o('item')),
          // แอปเก็บแค่ที่อยู่เจ้าของทรัพย์สิน ไม่มีช่องเขต/อำเภอ-จังหวัดแยก
          // → เว้นว่างเหมือนใบจริงที่เจอ (บางใบก็เว้น) ดีกว่าเดาจากที่เกิดเหตุ
          SlipField('ที่อยู่ทรัพย์สิน', o('owner_address')),
          const SlipField('เขต/อำเภอ', ''),
          const SlipField('จังหวัด', ''),
          SlipField('รายละเอียดความเสียหาย', o('detail')),
        ]);
      case SlipSubject.payment:
        final amount = _money(report['acc_claim_amount']);
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('เลขที่รับแจ้ง', _s('claim_ref_no')),
          SlipField('รับเงินจำนวน', amount == null ? '' : '${_thousands(amount)} บาท'),
          SlipField('รับเงินจาก', '${o('first_name')} ${o('last_name')}'.trim()),
          SlipField('ที่อยู่', o('address')),
          SlipField('โทรศัพท์', o('phone')),
          SlipField('เจ้าของ/ผู้ขับรถ ทะเบียน', o('plate')),
          SlipField('ยี่ห้อ/รุ่น', '${o('car_brand')}/${o('car_model')}'),
          const SlipField.blank(),
          const SlipField.plain('ขับรถโดยประมาทได้ชนรถ'),
          SlipField('ทะเบียนรถประกัน', _s('license_plate')),
          SlipField('ยี่ห้อ/รุ่น', insuredModel),
          SlipField('ของ', _s('assured_name')),
          SlipField('เหตุเกิดวันที่', accWhen),
          SlipField('เหตุเกิดที่', _s('acc_place')),
        ]);
      case SlipSubject.paymentProperty:
        final amount = _money(report['acc_claim_amount']);
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('เลขที่รับแจ้ง', _s('claim_ref_no')),
          SlipField('รับเงินจำนวน', amount == null ? '' : '${_thousands(amount)} บาท'),
          // เงินมาจาก**เจ้าของทรัพย์สิน** (คนจ่าย) ส่วน 'ทรัพย์สิน' คือชื่อสิ่งที่เสียหาย
          // — ในเคสแบบ "บุคคล" สองช่องนี้เป็นคนละคนได้ (เช่น ลูกจ้างทำ นายจ้างจ่าย)
          SlipField('รับเงินจาก', o('owner_name')),
          SlipField('ที่อยู่', o('owner_address')),
          SlipField('โทรศัพท์', o('owner_phone')),
          // ⚠️ ใบจริงพิมพ์ "ทรัพย์สิน:" ติดกัน ไม่เว้นวรรคหน้าโคลอนเหมือนบรรทัดอื่น
          // (ความไม่สม่ำเสมอของระบบเก่าเอง) — คงไว้ให้ใบหน้าตาเหมือนที่คนเคยเซ็น
          SlipField.plain('ทรัพย์สิน: ${o('item')}'),
          const SlipField.blank(),
          // คู่กรณีใช้ "ขับรถโดยประมาทได้ชนรถ" — ฝั่งนี้ไม่ได้ขับรถมาชน
          const SlipField.plain('ทำความเสียหายให้รถ'),
          SlipField('ทะเบียนรถประกัน', _s('license_plate')),
          SlipField('ยี่ห้อ/รุ่น', insuredModel),
          SlipField('ของ', _s('assured_name')),
          SlipField('เหตุเกิดวันที่', accWhen),
          SlipField('เหตุเกิดที่', _s('acc_place')),
        ]);
      case SlipSubject.opponentCar:
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('เลขกรมธรรม์', o('policy_no')),
          SlipField('ประเภทกรมธรรม์', o('policy_type')),
          SlipField('รถคู่กรณีทะเบียน', o('plate')),
          SlipField('จังหวัด', o('province')),
          SlipField('ยี่ห้อ/รุ่น', '${o('car_brand')}/${o('car_model')}'),
          SlipField('สีรถ', o('car_color')),
        ]);
      case SlipSubject.insuredCar:
        fields.addAll([
          printedLine,
          SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
          SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
          SlipField('เลขกรมธรรม์', _s('policy_no')),
          SlipField('ประเภทกรมธรรม์', _s('policy_type')),
          SlipField('ทะเบียนรถ', _s('license_plate')),
          SlipField('จังหวัด', _s('car_province')),
          SlipField('ยี่ห้อ/รุ่น', insuredModel),
          SlipField('สีรถ', _s('car_color')),
          SlipField('ฝ่ายใดเป็นฝ่ายถูก/ผิด', _s('acc_fault')),
          SlipField('ซ่อมที่', _s('repair_shop')),
        ]);
    }

    // ค่าเสียหายส่วนแรก: แสดงเฉพาะเคลมที่มีจริง ไม่มีข้อมูล = ซ่อนทั้งบล็อก
    // (กติกา user — มีได้ทั้งไอโออิและไทยไพบูลย์ ขึ้นกับเคลมนั้น ไม่ใช่ขึ้นกับบริษัท)
    final ded = _money(report['deductible']);
    final showDed = type.showDeductible && ded != null && ded > 0;

    return DamageNoticeData(
      title: type.title,
      subtitle: type.subtitle,
      fields: fields,
      damages: type.showDamages
          ? _damages(isOpponent ? item['damage'] : report['insured_damage'])
          : const [],
      note: type.note,
      showNote: type.showNote,
      extraTitle: showDed ? 'ความเสียหายส่วนแรก' : null,
      extraFields: showDed
          ? [
              SlipField('ตามเงื่อนไข', 'EX${_thousands(ded)}'),
              SlipField('จำนวนเงิน', '${_thousands(ded)} บาท'),
            ]
          : const [],
      docsTitle: type.docsTitle,
      docs: type.docs,
      docsFootnote: type.docsFootnote,
      certifyText: type.certifyText,
      // ใบบันทึกรับเงินมีบรรทัด "ตัวแทนบริษัท" คั่นระหว่างคำรับรองกับช่องเซ็น
      // (คนที่รับเงินแทนบริษัทคือผู้สำรวจคนเดียวกับที่ออกใบ)
      preSignLines: type.subject == SlipSubject.payment ||
              type.subject == SlipSubject.paymentProperty
          ? ['ตัวแทนบริษัท : $operatorName']
          : const [],
      signers: type.signers,
      operatorLine: operatorName,
      operatorPhone: operatorPhone,
      footer: f,
    );
  }

  /// รายการความเสียหาย — โครงเดียวกันทั้งรถประกันและคู่กรณี: `{part, pos, level}`
  static List<SlipDamage> _damages(dynamic raw) {
    if (raw is! List) return const [];
    final out = <SlipDamage>[];
    for (final e in raw) {
      if (e is! Map) continue;
      final part = (e['part'] ?? '').toString().trim();
      if (part.isEmpty) continue;
      out.add(SlipDamage(part + _posSuffix('${e['pos'] ?? ''}'), _levelLabel('${e['level'] ?? ''}')));
    }
    return out;
  }

  /// ระดับความเสียหาย = **ไทย + รหัสในวงเล็บ** เช่น `ต่ำ (L)`
  ///
  /// ไทยเพราะใบนี้คนนอกเซ็นรับรอง ต้องอ่านออกว่าตัวเองเซ็นอะไร ·
  /// รหัสเพราะผู้ตรวจต้องเทียบกับหน้าระบบประกันซึ่งใช้ L/M/H/X
  static String _levelLabel(String code) {
    const th = {'L': 'ต่ำ', 'M': 'กลาง', 'H': 'สูง', 'X': 'สูงมาก'};
    final name = th[code];
    return name == null ? '' : '$name ($code)';
  }

  static String _posSuffix(String pos) =>
      const {'L': ' (ซ้าย)', 'R': ' (ขวา)'}[pos] ?? '';

  static double? _money(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString().replaceAll(',', '').trim());
  }

  /// 2000 → "2,000" · 2500.5 → "2,500.50" (ใบจริงเขียนเลขกลมแบบมีคอมม่า)
  static String _thousands(double v) {
    final hasSatang = v % 1 != 0;
    final s = hasSatang ? v.toStringAsFixed(2) : v.toStringAsFixed(0);
    final parts = s.split('.');
    final digits = parts[0].replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
    return parts.length > 1 ? '$digits.${parts[1]}' : digits;
  }

  static const _thMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  /// วันเกิดเหตุที่แอปเก็บเป็น `08/05/2569` + `19:00` → `8 พ.ค. 2569 เวลา 19:00`
  ///
  /// ⛔ อย่าแปลงเป็น DateTime แล้ว format — ปีที่เก็บเป็น **พ.ศ. อยู่แล้ว** แปลงกลับไปมา
  /// มีแต่จะบวก 543 ซ้ำ · ถ้ารูปแบบไม่ตรงที่คาด คืนของเดิมต่อกันดีกว่าคืนค่าว่าง
  static String _thaiDateTime(String date, String time) {
    final t = time.trim();
    final m = RegExp(r'^(\d{1,2})/(\d{1,2})/(\d{4})$').firstMatch(date.trim());
    if (m == null) {
      final raw = [date.trim(), if (t.isNotEmpty) 'เวลา $t'].join(' ').trim();
      return raw;
    }
    final d = int.parse(m.group(1)!);
    final mo = int.parse(m.group(2)!);
    if (mo < 1 || mo > 12) return [date.trim(), if (t.isNotEmpty) 'เวลา $t'].join(' ');
    final head = '$d ${_thMonths[mo - 1]} ${m.group(3)}';
    return t.isEmpty ? head : '$head เวลา $t';
  }

  /// "11 ส.ค. 2569 เวลา 14:37" — พ.ศ. ตามใบจริง
  static String _thaiStamp(DateTime t) {
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '${t.day} ${_thMonths[t.month - 1]} ${t.year + 543} เวลา $hh:$mm';
  }
}
