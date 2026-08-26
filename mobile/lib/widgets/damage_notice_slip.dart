import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'signature_pad.dart';

/// ใบเอกสารหน้างาน — พิมพ์ให้ผู้ขับขี่/เจ้าของทรัพย์สินเซ็นรับรอง แล้วให้เขาถือกลับ
///
/// **ประกอบจากบล็อก ไม่ hardcode ต่อแบบ** — มีทั้งหมด 10 แบบ (ดู `damage_notice_catalog.dart`)
/// ซึ่งต่างกันแค่ "มีบล็อกไหนบ้าง" การเพิ่มแบบใหม่จึงเป็นแค่การประกอบ [DamageNoticeData]
/// ชุดใหม่ ไม่ต้องแตะ widget นี้
///
/// วาดที่ความกว้าง [slipDots] = 384 จุด ตรงกับกระดาษ 58 มม. ที่ 203 dpi พอดี
/// จับภาพด้วย pixelRatio 1.0 แล้วได้ PNG ที่ส่งเข้าเครื่องพิมพ์ได้ตรงจุด ไม่ต้องย่อ
class DamageNoticeSlip extends StatelessWidget {
  const DamageNoticeSlip({
    super.key,
    required this.data,
    required this.signatures,
    this.interactive = true,
  });

  final DamageNoticeData data;

  /// ปากกา 1 ตัวต่อ 1 ช่องเซ็น — ต้องยาวเท่า [DamageNoticeData.signers]
  /// (ใบบันทึกรับเงินมี 3 ช่อง: ผู้รับเงิน · ผู้ชำระเงิน · ผู้ขับขี่รถประกัน/พยาน)
  final List<SignatureController> signatures;

  /// false = โหมดจับภาพ/ดูอย่างเดียว — ซ่อนคำใบ้ "เซ็นชื่อในกรอบนี้" ไม่ให้ติดไปบนกระดาษ
  final bool interactive;

  static const double slipDots = 384;

  static const _body = TextStyle(fontSize: 13, color: Colors.black, height: 1.35);
  static const _small = TextStyle(fontSize: 10.5, color: Colors.black, height: 1.3);
  static const _bold = TextStyle(
      fontSize: 13, color: Colors.black, height: 1.35, fontWeight: FontWeight.w700);

  @override
  Widget build(BuildContext context) {
    final f = data.footer;
    return Container(
      width: slipDots,
      color: Colors.white,
      // ขอบแคบไว้ — กระดาษ 58 มม. พิมพ์ได้จริงแค่ ~48 มม. (384 จุด) เสียไปกับขอบเท่าไหร่
      // คือเนื้อหาที่หายไปเท่านั้น เว้นซ้ายน้อยกว่าขวานิดเพราะเครื่องพิมพ์เยื้องขวาเล็กน้อย
      padding: const EdgeInsets.fromLTRB(4, 8, 10, 10),
      child: DefaultTextStyle(
        style: _body,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // หัวกระดาษ = โลโก้อย่างเดียว ไม่มีที่อยู่บริษัท (กติกา user 2026-08-11)
          Center(child: Image.asset('assets/se-mark.png', width: 92, fit: BoxFit.contain)),
          const SizedBox(height: 8),
          const Divider(color: Colors.black, thickness: 1, height: 1),
          const SizedBox(height: 12),

          // ใบบันทึกรับเงินมีหัวเรื่องบรรทัดเดียว (subtitle ว่าง) — ต่อ \n ลอย ๆ
          // จะได้บรรทัดว่างคั่นกลางใบ
          Center(
            child: Text(
                data.subtitle.isEmpty ? data.title : '${data.title}\n${data.subtitle}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w700, color: Colors.black, height: 1.3)),
          ),
          const SizedBox(height: 12),

          ...data.fields.map(_line),

          // ใบติดต่อไม่มีตารางความเสียหาย → ส่ง damages ว่างมา แล้วบล็อกนี้หายทั้งก้อน
          if (data.damages.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text('รายการความเสียหาย'),
            const SizedBox(height: 4),
            Row(children: const [
              Expanded(flex: 6, child: Text('ชิ้นส่วน')),
              Expanded(flex: 4, child: Text('ระดับ')),
            ]),
            const SizedBox(height: 2),
            ...data.damages.map((d) => Padding(
                  padding: const EdgeInsets.only(bottom: 1),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(flex: 6, child: Text(d.part, style: _small)),
                    Expanded(flex: 4, child: Text(d.level, style: _small)),
                  ]),
                )),
            const SizedBox(height: 8),
            Text('รวมจำนวนความเสียหายทั้งสิ้น : ${data.damages.length} รายการ'),
          ],

          // ใบรถมีบรรทัด "*หมายเหตุ" เสมอ (เว้นไว้ให้เขียนมือถ้าไม่มีข้อความ) แต่ใบ
          // ทรัพย์สิน/ผู้บาดเจ็บ/รับเงิน ไม่มีบรรทัดนี้เลย → ต้องปิดได้
          if (data.showNote) Text('*${data.note ?? 'หมายเหตุ'}'),

          // "ความเสียหายส่วนแรก" — มีเฉพาะเคลมที่มีค่าเสียหายส่วนแรกจริง
          // ไม่มีข้อมูล = ซ่อนทั้งบล็อก (ทั้งไอโออิและไทยไพบูลย์ กติกา user 2026-08-11)
          if (data.extraTitle != null) ...[
            const SizedBox(height: 10),
            Text(data.extraTitle!),
            ...data.extraFields.map(_line),
          ],

          // "เอกสารที่ใช้ในการติดต่อ" — มีเฉพาะใบติดต่อ
          if (data.docs.isNotEmpty) ...[
            const SizedBox(height: 10),
            if (data.docsTitle != null) Text(data.docsTitle!),
            ...data.docs.asMap().entries.map((e) => Text('${e.key + 1}. ${e.value}')),
            if (data.docsFootnote != null) Text('**${data.docsFootnote!}**', style: _small),
          ],

          if (data.certifyText != null) ...[
            const SizedBox(height: 12),
            Text(data.certifyText!, style: _small),
          ],

          // บรรทัดที่ต้องอยู่ "หลังคำรับรอง แต่ก่อนช่องเซ็น" — ใบบันทึกรับเงินมี
          // "ตัวแทนบริษัท : …" ตรงนี้ ใบอื่นไม่มี
          if (data.preSignLines.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...data.preSignLines.map((t) => Text(t, style: _small)),
          ],
          const SizedBox(height: 8),

          // กรอบเซ็นชื่อ — ผู้ขับขี่เซ็นบนจอตรงนี้ เส้นที่เซ็นติดไปกับรูปที่พิมพ์เลย
          // ใบบันทึกรับเงินมี 3 ช่อง (ผู้รับเงิน/ผู้ชำระเงิน/พยาน) ใบอื่นมีช่องเดียว
          for (var i = 0; i < data.signers.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(border: Border.all(color: Colors.black, width: 1)),
              // key ผูกแผ่นเซ็นกับลำดับช่องให้ชัด — ใบมีจำนวนช่องไม่เท่ากัน ถ้าไม่ผูก
              // Flutter จะจับคู่ State เดิมกับช่องที่ถือ controller คนละตัวตอนสลับแบบใบ
              child: SignaturePad(
                key: ValueKey('sign-$i'),
                controller: signatures[i],
                // หลายช่องในใบเดียวต้องเตี้ยลง ไม่งั้นใบยาวจนเปลืองกระดาษ
                height: data.signers.length > 1 ? 76 : 96,
                hint: interactive ? 'เซ็นชื่อในกรอบนี้' : '',
              ),
            ),
            const SizedBox(height: 4),
            Center(child: Text(data.signers[i])),
          ],
          const SizedBox(height: 10),

          Text('ผู้ปฏิบัติงาน : ${data.operatorLine}', style: _small),
          Text('เบอร์โทร : ${data.operatorPhone}', style: _small),
          const SizedBox(height: 10),
          const Divider(color: Colors.black, thickness: 1, height: 1),
          const SizedBox(height: 10),

          ...f.lines.map((t) => Text(t, style: _bold)),
          const SizedBox(height: 10),
          Text(f.caption, style: _small),

          // ไอโออิ = QR · ไทยไพบูลย์ = พิมพ์ลิงก์เป็นข้อความ (กติกา user 2026-08-11)
          if (f.qrUrl != null) ...[
            const SizedBox(height: 8),
            Center(
              child: QrImageView(
                data: f.qrUrl!,
                size: 116,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                // M = กันเลอะได้ ~15% พอสำหรับกระดาษความร้อนที่อาจซีด
                errorCorrectionLevel: QrErrorCorrectLevel.M,
              ),
            ),
          ] else if (f.linkText != null)
            Text(f.linkText!, style: _small),
        ]),
      ),
    );
  }

  Widget _line(SlipField f) =>
      Text(f.value == null ? f.label : '${f.label} : ${f.value}');
}

class SlipField {
  const SlipField(this.label, String this.value);

  /// บรรทัดข้อความล้วน ไม่มี " : " ต่อท้าย — ใบบันทึกรับเงินมีประโยคลอย
  /// "ขับรถโดยประมาทได้ชนรถ" คั่นกลางระหว่างข้อมูล 2 ฝ่าย
  const SlipField.plain(this.label) : value = null;

  /// บรรทัดว่างคั่น (ใบจริงเว้นบรรทัดก่อนประโยคลอย)
  const SlipField.blank()
      : label = '',
        value = null;

  final String label;

  /// null = พิมพ์แค่ [label] ไม่ต่อ " : "
  final String? value;
}

class SlipDamage {
  const SlipDamage(this.part, this.level);
  final String part;

  /// ป้ายไทยพร้อมรหัสในวงเล็บ เช่น `ต่ำ (L)` — ไทยเพื่อให้คนที่เซ็นรับรองอ่านออกว่าตัวเองเซ็นอะไร
  /// รหัสเพื่อให้ผู้ตรวจเทียบกับหน้าระบบประกันได้โดยไม่ต้องแปลในหัว
  final String level;
}

/// ท้ายใบ — **ต่างกันตามบริษัทประกัน ไม่ใช่แค่ QR**
/// ไอโออิ = ติดต่อภายใน 7 วัน + QR · ไทยไพบูลย์ = ภายใน 15 วัน + พิมพ์ลิงก์เป็นข้อความ
class InsurerFooter {
  const InsurerFooter({
    required this.lines,
    required this.caption,
    this.qrUrl,
    this.linkText,
  });

  final List<String> lines;
  final String caption;
  final String? qrUrl;
  final String? linkText;
}

/// ข้อมูลบนใบ 1 ใบ — "แบบ" ต่างกันที่บล็อกไหนมี/ไม่มี ไม่ใช่ที่ layout
class DamageNoticeData {
  const DamageNoticeData({
    required this.title,
    required this.subtitle,
    required this.fields,
    required this.signers,
    required this.operatorLine,
    required this.operatorPhone,
    required this.footer,
    this.damages = const [],
    this.note,
    this.showNote = true,
    this.extraTitle,
    this.extraFields = const [],
    this.docsTitle,
    this.docs = const [],
    this.docsFootnote,
    this.certifyText,
    this.preSignLines = const [],
  });

  final String title;
  final String subtitle;
  final List<SlipField> fields;
  final List<SlipDamage> damages;
  final String? note;
  final bool showNote;
  final String? extraTitle;
  final List<SlipField> extraFields;
  final String? docsTitle;
  final List<String> docs;
  final String? docsFootnote;
  final String? certifyText;
  final List<String> preSignLines;

  /// ป้ายใต้ช่องเซ็นแต่ละช่อง — 1 ช่องสำหรับใบทั่วไป, 3 ช่องสำหรับใบบันทึกรับเงิน
  final List<String> signers;
  final String operatorLine;
  final String operatorPhone;
  final InsurerFooter footer;
}
