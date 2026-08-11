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

  /// รายการคู่กรณี (ใช้ตอนเลือกว่าจะพิมพ์ใบของคันไหน)
  /// คีย์ใน payload คือ `opposing_parties` ไม่ใช่ `opponents`
  List<Map<String, dynamic>> get opponents {
    final raw = report['opposing_parties'];
    if (raw is! List) return const [];
    return raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  /// สร้างใบ 1 ใบ — [opponentIndex] จำเป็นเฉพาะใบของรถคู่กรณี
  DamageNoticeData build(SlipType type, {int opponentIndex = 0}) {
    final f = footer;
    if (f == null) {
      throw StateError('ไม่รู้จักบริษัทประกัน "${_s('insurance_company')}" — '
          'ท้ายใบ (เบอร์ติดต่อ/กำหนดวัน) ต่างกันรายบริษัท เติมเองไม่ได้');
    }

    final isOpponent = type.subject == SlipSubject.opponentCar;
    final opp = isOpponent && opponentIndex < opponents.length
        ? opponents[opponentIndex]
        : const <String, dynamic>{};

    String o(String key) => (opp[key] ?? '').toString().trim();

    final fields = <SlipField>[
      SlipField('พิมพ์วันที่', _thaiStamp(printedAt ?? DateTime.now())),
      SlipField('เลขที่อุบัติเหตุ', _s('claim_no')),
      SlipField('เลขเรื่อง Survey', _s('survey_job_no')),
    ];

    if (isOpponent) {
      fields.addAll([
        SlipField('เลขกรมธรรม์', o('policy_no')),
        SlipField('ประเภทกรมธรรม์', o('policy_type')),
        SlipField('รถคู่กรณีทะเบียน', o('plate')),
        SlipField('จังหวัด', o('province')),
        SlipField('ยี่ห้อ/รุ่น', '${o('car_brand')}/${o('car_model')}'),
        SlipField('สี', o('car_color')),
      ]);
    } else {
      fields.addAll([
        SlipField('เลขกรมธรรม์', _s('policy_no')),
        SlipField('ประเภทกรมธรรม์', _s('policy_type')),
        SlipField('ทะเบียนรถ', _s('license_plate')),
        SlipField('จังหวัด', _s('car_province')),
        SlipField('ยี่ห้อ/รุ่น', '${_s('car_brand')}/${_s('car_model')}'),
        SlipField('สี', _s('car_color')),
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
          ? _damages(isOpponent ? opp['damage'] : report['insured_damage'])
          : const [],
      note: type.note,
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
      signerLabel: type.signerLabel,
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

  /// "11 ส.ค. 2569 เวลา 14:37" — พ.ศ. ตามใบจริง
  static String _thaiStamp(DateTime t) {
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    return '${t.day} ${_thMonths[t.month - 1]} ${t.year + 543} เวลา $hh:$mm';
  }
}
