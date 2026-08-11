import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'signature_pad.dart';

/// ใบแจ้งความเสียหาย — ใบกระดาษที่พิมพ์ให้ผู้ขับขี่เซ็นรับรองหน้างาน
///
/// **ประกอบจากบล็อก ไม่ hardcode ต่อแบบ** — ใบมีหลายแบบ (รถประกัน · รถคู่กรณี · …)
/// ซึ่งต่างกันแค่ "มีบรรทัดไหนบ้าง" การเพิ่มแบบใหม่จึงเป็นแค่การประกอบ
/// [DamageNoticeData] ชุดใหม่ ไม่ต้องแตะ widget นี้
///
/// วาดที่ความกว้าง [slipDots] = 384 จุด ตรงกับกระดาษ 58 มม. ที่ 203 dpi พอดี
/// จับภาพด้วย pixelRatio 1.0 แล้วได้ PNG ที่ส่งเข้าเครื่องพิมพ์ได้ตรงจุด ไม่ต้องย่อ
class DamageNoticeSlip extends StatelessWidget {
  const DamageNoticeSlip({
    super.key,
    required this.data,
    required this.signature,
    this.interactive = true,
  });

  final DamageNoticeData data;
  final SignatureController signature;

  /// false = โหมดจับภาพ/ดูอย่างเดียว — ซ่อนคำใบ้ "เซ็นชื่อในกรอบนี้" ไม่ให้ติดไปบนกระดาษ
  final bool interactive;

  static const double slipDots = 384;

  static const _body = TextStyle(fontSize: 13, color: Colors.black, height: 1.35);
  static const _small = TextStyle(fontSize: 10.5, color: Colors.black, height: 1.3);
  static const _bold = TextStyle(
      fontSize: 13, color: Colors.black, height: 1.35, fontWeight: FontWeight.w700);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: slipDots,
      color: Colors.white,
      // ขอบแคบไว้ — กระดาษ 58 มม. พิมพ์ได้จริงแค่ ~48 มม. (384 จุด) เสียไปกับขอบเท่าไหร่
      // คือเนื้อหาที่หายไปเท่านั้น เว้นซ้ายน้อยกว่าขวานิดเพราะเครื่องพิมพ์เยื้องขวาเล็กน้อย
      padding: const EdgeInsets.fromLTRB(4, 8, 10, 10),
      child: DefaultTextStyle(
        style: _body,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Center(child: Image.asset('assets/se-mark.png', width: 92, fit: BoxFit.contain)),
          const SizedBox(height: 8),
          const Divider(color: Colors.black, thickness: 1, height: 1),
          const SizedBox(height: 12),

          // หัวใบ — บรรทัดที่ 2 บอกว่าเป็นใบของรถคันไหน (ประกัน/คู่กรณี)
          Center(
            child: Text('${data.title}\n${data.subtitle}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.w700, color: Colors.black, height: 1.3)),
          ),
          const SizedBox(height: 12),

          ...data.fields.map(_line),
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
          Text('*${data.note ?? 'หมายเหตุ'}'),

          // บล็อกเสริม (ใบรถประกันมี "ความเสียหายส่วนแรก" ใบคู่กรณีไม่มี)
          if (data.extraTitle != null) ...[
            const SizedBox(height: 10),
            Text(data.extraTitle!),
            ...data.extraFields.map(_line),
          ],

          const SizedBox(height: 12),
          Text(data.certifyText, style: _small),
          const SizedBox(height: 8),

          // กรอบเซ็นชื่อ — ผู้ขับขี่เซ็นบนจอตรงนี้ เส้นที่เซ็นติดไปกับรูปที่พิมพ์เลย
          Container(
            decoration: BoxDecoration(border: Border.all(color: Colors.black, width: 1)),
            child: SignaturePad(
              controller: signature,
              height: 96,
              hint: interactive ? 'เซ็นชื่อในกรอบนี้' : '',
            ),
          ),
          const SizedBox(height: 4),
          Center(child: Text(data.signerLabel)),
          const SizedBox(height: 10),

          Text('ผู้ปฏิบัติงาน : ${data.operatorLine}', style: _small),
          Text('เบอร์โทร : ${data.operatorPhone}', style: _small),
          const SizedBox(height: 10),
          const Divider(color: Colors.black, thickness: 1, height: 1),
          const SizedBox(height: 10),

          ...data.insurerLines.map((t) => Text(t, style: _bold)),
          const SizedBox(height: 10),
          Text(data.qrCaption, style: _small),
          const SizedBox(height: 8),
          Center(
            child: QrImageView(
              data: data.qrUrl,
              size: 116,
              padding: EdgeInsets.zero,
              backgroundColor: Colors.white,
              // M = กันเลอะได้ ~15% พอสำหรับกระดาษความร้อนที่อาจซีด
              errorCorrectionLevel: QrErrorCorrectLevel.M,
            ),
          ),
        ]),
      ),
    );
  }

  Widget _line(SlipField f) => Text('${f.label} : ${f.value}');
}

class SlipField {
  const SlipField(this.label, this.value);
  final String label;
  final String value;
}

class SlipDamage {
  const SlipDamage(this.part, this.level);
  final String part;

  /// ป้ายไทยเต็ม (ต่ำ/กลาง/สูง/สูงมาก) ตาม master ของ EMCS — ไม่ใช้ตัวย่อ L/M/H/X
  /// เพราะใบนี้ให้คนนอกบริษัทอ่านและเซ็นรับรอง
  final String level;
}

/// ข้อมูลบนใบ 1 ใบ — ตัวที่ทำให้ "แบบ" ต่างกันคือ [fields] / [extraFields] / [signerLabel]
class DamageNoticeData {
  const DamageNoticeData({
    this.title = 'ใบแจ้งความเสียหาย',
    required this.subtitle,
    required this.fields,
    required this.damages,
    required this.signerLabel,
    required this.operatorLine,
    required this.operatorPhone,
    required this.insurerLines,
    required this.qrUrl,
    this.note,
    this.extraTitle,
    this.extraFields = const [],
    this.certifyText =
        'ข้าพเจ้าได้ตรวจสอบรายการความเสียหายที่ระบุไว้ข้างต้น '
        'ขอรับรองว่า ครบถ้วนถูกต้องทุกประการ',
    this.qrCaption =
        'ท่านสามารถตรวจสอบรายชื่อสาขา/ศูนย์/อู่ในสัญญา ได้โดยการสแกน QR Code',
  });

  final String title;
  final String subtitle;
  final List<SlipField> fields;
  final List<SlipDamage> damages;
  final String? note;
  final String? extraTitle;
  final List<SlipField> extraFields;
  final String certifyText;
  final String signerLabel;
  final String operatorLine;
  final String operatorPhone;
  final List<String> insurerLines;
  final String qrCaption;
  final String qrUrl;
}
