import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:se_survey/widgets/damage_notice_slip.dart';
import 'package:se_survey/widgets/signature_pad.dart';
import 'package:se_survey/data/damage_notice_catalog.dart';
import 'package:se_survey/data/damage_notice_demo.dart';
import 'package:se_survey/services/damage_notice_builder.dart';

/// ใบเอกสารหน้างาน — **คนนอกเซ็นรับรองใบนี้แล้วถือกลับ** และไฟล์เดียวกันเข้าสำนวนประกัน
/// พิมพ์ผิดบรรทัดเดียวคือเอกสารที่ลูกค้าเซ็นไม่ตรงกับที่ยื่นบริษัท → ต้องมีการ์ดคุม
///
/// เทียบทีละบรรทัดกับ**ใบจริง**ที่ user ส่งมา 26/08/69 (ทรัพย์สิน/ผู้บาดเจ็บ/รับเงิน)
void main() {
  // เคสตัวอย่าง — คีย์ตรงกับ payload จริงของฟอร์มสำรวจ (`_collectFormData()`)
  const report = <String, dynamic>{
    'insurance_company': 'ไอโออิกรุงเทพประกันภัย',
    'claim_no': '2026013135962',
    'claim_ref_no': '2026078253',
    'survey_job_no': 'SEABI-310260501742',
    'policy_no': '525013113559',
    'policy_type': 'ชั้น 1',
    'license_plate': '4ขภ3362',
    'car_province': 'อุบลราชธานี',
    'car_brand': 'TOYOTA',
    'car_model': '',
    'car_color': 'ขาว',
    'assured_name': 'นายสมชาย ใจดี',
    'acc_date': '08/05/2569',
    'acc_time': '19:00',
    'acc_place': 'หน้า รร.บ้านบางประม้า',
    'acc_fault': 'คู่กรณีผิด',
    'repair_shop': 'อู่ในสัญญา',
    'acc_claim_amount': '200',
    'opposing_parties': [
      {
        'plate': 'กท8881',
        'first_name': 'สมหญิง',
        'last_name': 'รักดี',
        'address': '99 หมู่ 1',
        'phone': '0812345678',
        'car_brand': 'HONDA',
        'car_model': 'CITY',
        'policy_no': 'P-1',
        'policy_type': 'ชั้น 3',
        'province': 'ระยอง',
        'car_color': 'ดำ',
      },
    ],
    'injured_persons': [
      {
        'name': 'นายพงษ์ดนัย อินคุ้ม',
        'person_type': 'ผู้โดยสาร - รถคู่กรณี',
        'car_reg': '1กก1',
        'symptom': 'บาดเจ็บบริเวณขา',
      },
    ],
    'damaged_property': [
      {
        'item': 'โทรศัพท์มือถือ iphone รุ่น SE 2020',
        'owner_address': '366 หมู่ที่ 18',
        'detail': 'บอดี้หลังแตก เปิดเครื่องไม่ติด',
      },
    ],
  };

  DamageNoticeBuilder builder() => const DamageNoticeBuilder(
        report: report,
        operatorName: 'SE79 นายธนภัทร ชัยสงคราม',
        operatorPhone: '062-2067273',
      );

  SlipType typeOf(String id) => kSlipTypes.firstWhere((t) => t.id == id);

  /// ค่าที่แอปเก็บจริงในเคสตัวอย่าง (มีขีดคั่นตามป้าย master ของระบบประกัน)
  final kPersonTypesSample =
      (report['injured_persons'] as List).first['person_type'] as String;

  /// ค่าของบรรทัด `label` บนใบ — null = ไม่มีบรรทัดนั้น
  String? lineOf(String id, String label, {int index = 0}) {
    final fields = builder().build(typeOf(id), index: index).fields;
    for (final f in fields) {
      if (f.label == label) return f.value;
    }
    return null;
  }

  group('ทะเบียนแบบใบ', () {
    test('ทุกแบบมีช่องเซ็นอย่างน้อย 1 ช่อง', () {
      for (final t in kSlipTypes) {
        expect(t.signers, isNotEmpty, reason: t.id);
      }
    });

    /// ⛔ **ทุกแบบในทะเบียนต้องมีใบจริงรองรับ ห้ามเติมให้ครบตาราง**
    ///
    /// เคยพลาด: ตอนวางทะเบียนครั้งแรกจัดเป็น "5 หมวด × 2 แบบ" แล้วเติม
    /// `pay_receipt_prop` (ใบบันทึกรับเงินฝั่งทรัพย์สิน) เข้าไปให้ครบช่อง ทั้งที่
    /// ไม่เคยเห็นใบจริง — user ทักเอง 27/08/69 จึงถอดออก
    /// เอกสารที่คนนอกต้องเซ็นรับรอง เดาจากรูปแบบไม่ได้
    test('ไม่มีแบบใบที่ไม่มีใบจริงรองรับ', () {
      expect(kSlipTypes.map((t) => t.id), isNot(contains('pay_receipt_prop')));
      expect(kSlipTypes.every((t) => t.ready), isTrue,
          reason: 'แบบที่ยังไม่เห็นใบจริงให้ถอดออก ไม่ใช่ปล่อยค้างเป็น ready:false');
    });

    test('แบบที่ได้ใบจริงแล้วเปิดใช้ครบ 9 แบบ', () {
      for (final id in ['ins_damage', 'ins_contact', 'opp_damage', 'opp_contact',
                        'inj_evidence', 'inj_contact', 'prop_evidence', 'prop_contact',
                        'pay_receipt_car']) {
        expect(typeOf(id).ready, isTrue, reason: id);
      }
      expect(kSlipTypes.length, 9);
    });

    /// ⛔ ใบรถมีบรรทัด "*หมายเหตุ" เว้นไว้ให้เขียนมือ — ใบ 3 หมวดใหม่ไม่มีบรรทัดนี้
    test('ใบทรัพย์สิน/ผู้บาดเจ็บ/รับเงิน ไม่มีบรรทัดหมายเหตุ', () {
      for (final id in ['inj_contact', 'prop_evidence', 'prop_contact', 'pay_receipt_car']) {
        expect(typeOf(id).showNote, isFalse, reason: id);
      }
      expect(typeOf('ins_damage').showNote, isTrue);
    });

    /// ⛔ ใบติดต่อของ**รถ**เท่านั้นที่มีรายการเอกสาร — ใบติดต่อผู้บาดเจ็บ/ทรัพย์สินไม่มี
    test('ใบติดต่อผู้บาดเจ็บ/ทรัพย์สิน ไม่มีรายการเอกสาร', () {
      expect(typeOf('inj_contact').docs, isEmpty);
      expect(typeOf('prop_contact').docs, isEmpty);
      expect(typeOf('ins_contact').docs, isNotEmpty);
    });
  });

  group('ใบทรัพย์สิน', () {
    test('บรรทัดตรงกับใบจริง', () {
      expect(lineOf('prop_evidence', 'เลขที่อุบัติเหตุ'), '2026013135962');
      expect(lineOf('prop_evidence', 'เลขเรื่อง Survey'), 'SEABI-310260501742');
      expect(lineOf('prop_evidence', 'เลขที่รับแจ้ง'), '2026078253');
      expect(lineOf('prop_evidence', 'ชื่อทรัพย์สิน'), 'โทรศัพท์มือถือ iphone รุ่น SE 2020');
      expect(lineOf('prop_evidence', 'ที่อยู่ทรัพย์สิน'), '366 หมู่ที่ 18');
      expect(lineOf('prop_evidence', 'รายละเอียดความเสียหาย'), 'บอดี้หลังแตก เปิดเครื่องไม่ติด');
    });

    /// ใบจริงมีบรรทัดนี้เสมอแม้ไม่มีข้อมูล (แอปยังไม่มีช่องเก็บ) — ต้องพิมพ์หัวข้อไว้
    /// ให้เขียนมือได้ ไม่ใช่หายไปทั้งบรรทัด
    test('เขต/อำเภอ + จังหวัด มีหัวข้อไว้เสมอ แม้ยังไม่มีข้อมูลในแอป', () {
      expect(lineOf('prop_evidence', 'เขต/อำเภอ'), '');
      expect(lineOf('prop_evidence', 'จังหวัด'), '');
    });

    /// ใบหลักฐานกับใบติดต่อของทรัพย์สิน **ต่างกันแค่หัวเรื่อง** (เทียบใบจริง 2 ใบ)
    test('ใบติดต่อ = ใบหลักฐาน ต่างแค่หัวเรื่อง', () {
      final a = builder().build(typeOf('prop_evidence'));
      final b = builder().build(typeOf('prop_contact'));
      expect(a.title, 'ใบหลักฐาน');
      expect(b.title, 'ใบติดต่อ');
      expect(b.subtitle, a.subtitle);
      expect(b.fields.map((f) => '${f.label}=${f.value}'),
          a.fields.map((f) => '${f.label}=${f.value}'));
      expect(b.certifyText, a.certifyText);
    });
  });

  group('ใบผู้บาดเจ็บ', () {
    test('บรรทัดตรงกับใบจริง', () {
      expect(lineOf('inj_contact', 'ชื่อผู้บาดเจ็บ'), 'นายพงษ์ดนัย อินคุ้ม');
      expect(lineOf('inj_contact', 'รายละเอียดการบาดเจ็บ'), 'บาดเจ็บบริเวณขา');
      // ใบนี้เรียกทะเบียนรถประกันว่า "ทะเบียนรถประกัน" แยกจาก "ทะเบียนรถ" ของผู้บาดเจ็บ
      expect(lineOf('inj_contact', 'ทะเบียนรถประกัน'), '4ขภ3362');
      expect(lineOf('inj_contact', 'ทะเบียนรถ'), '1กก1');
    });

    /// หัวเรื่องคือชื่อเอกสาร ต้องตรงกับใบเดิมที่คนเคยเซ็น ไม่ใช่ชื่อที่เราตั้งเอง
    test('หัวเรื่องตรงกับใบจริง', () {
      final e = builder().build(typeOf('inj_evidence'));
      expect('${e.title} ${e.subtitle}', 'ใบหลักฐาน ผู้บาดเจ็บ');
      final c = builder().build(typeOf('inj_contact'));
      expect('${c.title} ${c.subtitle}', 'ใบติดต่อ ผู้บาดเจ็บ');
    });

    test('ป้ายใต้ช่องเซ็นตรงกับใบจริง', () {
      expect(builder().build(typeOf('inj_contact')).signers, ['ผู้รับหลักฐาน ผู้บาดเจ็บ']);
      expect(builder().build(typeOf('inj_evidence')).signers, ['ผู้รับหลักฐาน ผู้บาดเจ็บ']);
    });

    /// ⛔ ใบหลักฐานกับใบติดต่อของผู้บาดเจ็บต่างกัน **บรรทัดเดียว** — ใส่ผิดฝั่งแล้ว
    /// เอกสารที่ลูกค้าเซ็นจะไม่ตรงกับของเดิมที่เคยใช้ (เทียบใบจริงอย่างละ 2 ใบ)
    test('ตำแหน่งขณะเกิดเหตุ มีเฉพาะใบหลักฐาน ไม่มีในใบติดต่อ', () {
      expect(lineOf('inj_evidence', 'ตำแหน่งขณะเกิดเหตุ'), 'ผู้โดยสารรถคู่กรณี');
      expect(lineOf('inj_contact', 'ตำแหน่งขณะเกิดเหตุ'), isNull);
    });

    /// ใบจริงเขียนติดกัน "ผู้โดยสารรถคู่กรณี" แต่แอปเก็บตามป้าย master ของระบบประกัน
    /// "ผู้โดยสาร - รถคู่กรณี" — ตัดขีดเฉพาะตอนพิมพ์ ค่าที่เก็บต้องไม่เปลี่ยน
    test('ตัดขีดออกตอนพิมพ์ ไม่แตะค่าที่เก็บ', () {
      expect(kPersonTypesSample, contains(' - '));
      expect(lineOf('inj_evidence', 'ตำแหน่งขณะเกิดเหตุ'), isNot(contains(' - ')));
    });
  });

  group('ใบบันทึกรับเงิน', () {
    /// ⭐ ใบเดียวที่มีหลายช่องเซ็น — พลาดตรงนี้คือใบขาดลายเซ็นคนสำคัญไปเลย
    test('มี 3 ช่องเซ็น', () {
      expect(builder().build(typeOf('pay_receipt_car')).signers,
          ['ผู้รับเงิน', 'ผู้ชำระเงิน', 'ผู้ขับขี่รถประกัน/พยาน']);
    });

    test('หัวเรื่องบรรทัดเดียว', () {
      expect(builder().build(typeOf('pay_receipt_car')).subtitle, '');
    });

    test('บรรทัดตรงกับใบจริง', () {
      expect(lineOf('pay_receipt_car', 'รับเงินจำนวน'), '200 บาท');
      expect(lineOf('pay_receipt_car', 'รับเงินจาก'), 'สมหญิง รักดี');
      expect(lineOf('pay_receipt_car', 'โทรศัพท์'), '0812345678');
      expect(lineOf('pay_receipt_car', 'เจ้าของ/ผู้ขับรถ ทะเบียน'), 'กท8881');
      expect(lineOf('pay_receipt_car', 'ทะเบียนรถประกัน'), '4ขภ3362');
      expect(lineOf('pay_receipt_car', 'ของ'), 'นายสมชาย ใจดี');
      expect(lineOf('pay_receipt_car', 'เหตุเกิดที่'), 'หน้า รร.บ้านบางประม้า');
    });

    /// ประโยคลอย "ขับรถโดยประมาทได้ชนรถ" คั่นข้อมูล 2 ฝ่าย — ห้ามมี " : " ต่อท้าย
    test('ประโยคคั่นพิมพ์เป็นข้อความล้วน', () {
      final f = builder()
          .build(typeOf('pay_receipt_car'))
          .fields
          .firstWhere((f) => f.label == 'ขับรถโดยประมาทได้ชนรถ');
      expect(f.value, isNull);
    });

    /// "ตัวแทนบริษัท" อยู่ระหว่างคำรับรองกับช่องเซ็น ไม่ใช่ในกลุ่มข้อมูลด้านบน
    test('มีบรรทัดตัวแทนบริษัทก่อนช่องเซ็น', () {
      expect(builder().build(typeOf('pay_receipt_car')).preSignLines,
          ['ตัวแทนบริษัท : SE79 นายธนภัทร ชัยสงคราม']);
      expect(builder().build(typeOf('prop_evidence')).preSignLines, isEmpty);
    });
  });

  group('วันที่', () {
    /// ⛔ ปีที่แอปเก็บเป็น **พ.ศ. อยู่แล้ว** — เผลอ +543 ซ้ำจะได้ปี 3112 บนใบที่ลูกค้าเซ็น
    test('วันเกิดเหตุแปลงเป็นรูปแบบใบจริง ไม่บวกปีซ้ำ', () {
      expect(lineOf('prop_evidence', 'วันที่เกิดเหตุ'), '8 พ.ค. 2569 เวลา 19:00');
    });

    test('รูปแบบวันที่แปลก ๆ ไม่ทำให้ข้อมูลหาย', () {
      final odd = Map<String, dynamic>.from(report)
        ..['acc_date'] = 'เมื่อวาน'
        ..['acc_time'] = '';
      final data = DamageNoticeBuilder(
              report: odd, operatorName: 'SE1', operatorPhone: '0')
          .build(typeOf('prop_evidence'));
      expect(data.fields.firstWhere((f) => f.label == 'วันที่เกิดเหตุ').value, 'เมื่อวาน');
    });
  });

  group('ตัวเลือกผู้รับใบ', () {
    test('ใบผูกกับรายการไหน ดึงรายการนั้นมาให้เลือก', () {
      final b = builder();
      expect(b.subjectsOf(typeOf('inj_contact')).length, 1);
      expect(b.subjectsOf(typeOf('prop_evidence')).length, 1);
      // ใบรับเงินผูกกับคู่กรณี (เงินรับมาจากคู่กรณีคันนั้น)
      expect(b.subjectsOf(typeOf('pay_receipt_car')).length, 1);
      expect(b.subjectsOf(typeOf('ins_damage')), isEmpty);
    });

    test('ป้ายตัวเลือกชี้ตัวได้', () {
      expect(DamageNoticeBuilder.subjectLabel(SlipSubject.injured,
          {'name': 'นายพงษ์ดนัย อินคุ้ม'}, 0), contains('นายพงษ์ดนัย'));
      expect(DamageNoticeBuilder.subjectLabel(SlipSubject.opponentCar, {'plate': 'กท8881'}, 1),
          'คันที่ 2 · กท8881');
    });
  });

  /// วาดใบจริงทุกแบบที่เปิดใช้ — จับ layout พังตอน build (เช่น ปากกาไม่พอช่องเซ็น)
  /// ที่การเทียบข้อมูลเพียว ๆ มองไม่เห็น
  testWidgets('วาดใบได้ทุกแบบที่เปิดใช้', (tester) async {
    for (final t in kSlipTypes.where((t) => t.ready)) {
      final signs = List.generate(t.signers.length, (_) => SignatureController());
      await tester.pumpWidget(MaterialApp(
        home: SingleChildScrollView(
          child: DamageNoticeSlip(
            data: builder().build(t),
            signatures: signs,
            interactive: false,
          ),
        ),
      ));
      expect(tester.takeException(), isNull, reason: t.id);
      // ป้ายใต้ช่องเซ็นต้องขึ้นครบทุกช่อง
      for (final label in t.signers) {
        expect(find.text(label), findsOneWidget, reason: '${t.id} / $label');
      }
      for (final c in signs) {
        c.dispose();
      }
    }
  });

  /// ⛔ **ข้อมูลตัวอย่างของหน้าทดสอบเครื่องพิมพ์ต้องครบทุกช่อง**
  ///
  /// เจอจริง 26/08/69: พิมพ์ใบบันทึกรับเงินออกกระดาษแล้ว "เลขที่รับแจ้ง / รับเงินจำนวน /
  /// รับเงินจาก" ว่างหมด เพราะตัวอย่างไม่มีข้อมูล — ทำให้แยกไม่ออกว่าโค้ดพังหรือข้อมูลขาด
  /// เทสพิมพ์ที่แยกสองอย่างนี้ไม่ได้ = เทสที่เชื่อผลไม่ได้
  test('ข้อมูลตัวอย่างเติมได้ครบทุกช่องของทุกใบที่เปิดใช้', () {
    const b = DamageNoticeBuilder(
        report: kDemoReport,
        operatorName: kDemoOperator,
        operatorPhone: kDemoOperatorPhone);
    for (final t in kSlipTypes.where((t) => t.ready)) {
      final blank = b
          .build(t)
          .fields
          .where((f) => f.value != null && f.value!.trim().isEmpty)
          .map((f) => f.label)
          // "เขต/อำเภอ" + "จังหวัด" ของทรัพย์สินยังไม่มีช่องเก็บในแอป — ตั้งใจให้ว่าง
          .where((l) => l != 'เขต/อำเภอ' && l != 'จังหวัด')
          .toList();
      expect(blank, isEmpty, reason: '${t.id} มีช่องว่าง: $blank');
    }
  });

  /// ⛔ **บั๊กที่เจอตอนทดสอบพิมพ์จริง 26/08/69 — ช่องเซ็นที่ 3 "เซ็นไม่ติด"**
  ///
  /// อาการหลอกมาก: เส้นถูกเก็บลง controller ครบ (`strokes` เพิ่มจริง) แต่จอไม่วาดใหม่
  /// เพราะ `_SignaturePadState` ไม่มี `didUpdateWidget` — พอ Flutter เอา State เดิมไปใช้
  /// กับแผ่นที่ถือ controller คนละตัว (เกิดตอนสลับแบบใบ เพราะจำนวนแผ่นไม่เท่ากัน)
  /// listener ยังผูกกับ controller ตัวเก่าอยู่ · คนเซ็นจะเห็นว่าเซ็นแล้วไม่ขึ้นเส้น
  /// แล้วเซ็นซ้ำ ๆ จนยอมแพ้ ทั้งที่ข้อมูลเข้าไปแล้ว
  testWidgets('สลับ controller แล้วแผ่นเซ็นยังวาดตามตัวใหม่', (tester) async {
    final first = SignatureController();
    final second = SignatureController();
    Widget wrap(SignatureController c) =>
        MaterialApp(home: Scaffold(body: SignaturePad(controller: c)));

    await tester.pumpWidget(wrap(first));
    await tester.pumpWidget(wrap(second));   // State เดิม แต่ controller คนละตัว

    final g = await tester.startGesture(tester.getCenter(find.byType(SignaturePad)));
    await g.moveBy(const Offset(20, 6));
    await g.moveBy(const Offset(20, -6));
    await g.up();
    await tester.pump();

    expect(second.isNotEmpty, isTrue, reason: 'เส้นต้องเข้า controller ตัวใหม่');
    expect(first.isEmpty, isTrue, reason: 'ตัวเก่าต้องไม่ได้เส้น');
    // ⭐ ข้อที่จับบั๊กจริง — ถ้า listener ยังค้างที่ตัวเก่า จอจะไม่วาดใหม่ คำใบ้จะยังอยู่
    expect(find.text('เซ็นชื่อในกรอบนี้'), findsNothing,
        reason: 'เซ็นแล้วคำใบ้ต้องหาย = จอวาดใหม่จริง');

    first.dispose();
    second.dispose();
  });

  /// ⛔ **กำหนดวันติดต่อเป็นข้อความที่ลูกค้าถือกลับบ้าน — ผิดบริษัทคือให้ข้อมูลผิดคน**
  ///
  /// ไอโออิถอดบรรทัด "*** กรุณาติดต่อบริษัทฯภายใน 7 วัน" ออกแล้ว (user ยืนยัน 27/08/69
  /// จากใบจริงที่พิมพ์วันนั้น 4 ใบ ไม่มีสักใบ) แต่ **ไทยไพบูลย์ยังมี 15 วันอยู่**
  test('ท้ายใบ: ไอโออิไม่มีกำหนดวัน · ไทยไพบูลย์ยังมี 15 วัน', () {
    final aioi = kInsurerFooters['1059']!.lines;
    expect(aioi.any((l) => l.contains('ภายใน')), isFalse,
        reason: 'ไอโออิถอดบรรทัดกำหนดวันออกแล้ว');
    expect(aioi.first, startsWith('บริษัทไอโออิ'));

    final tpb = kInsurerFooters['2429']!.lines;
    expect(tpb.any((l) => l.contains('ภายใน 15 วัน')), isTrue,
        reason: 'ไทยไพบูลย์ยังต้องมี — อย่าลบตามไอโออิ');
  });

  /// ใบจริงเขียน "สีรถ" ไม่ใช่ "สี" — ป้ายบนเอกสารที่คนเซ็นต้องตรงกับของเดิม
  test('ป้ายสีรถตรงกับใบจริง', () {
    expect(lineOf('ins_damage', 'สีรถ'), 'ขาว');
    expect(lineOf('ins_damage', 'สี'), isNull);
    expect(lineOf('opp_damage', 'สีรถ'), 'ดำ');
  });

  /// ⛔ ท้ายใบ (เบอร์ติดต่อ/กำหนดวัน) ต่างกันรายบริษัท — เดาไม่ได้ ต้องหยุด
  test('ไม่รู้จักบริษัทประกัน = ไม่ยอมออกใบ', () {
    const b = DamageNoticeBuilder(
        report: {'insurance_company': 'บริษัทที่ไม่รู้จัก'},
        operatorName: 'SE1',
        operatorPhone: '0');
    expect(b.footer, isNull);
    expect(() => b.build(kSlipTypes.first), throwsStateError);
  });
}
