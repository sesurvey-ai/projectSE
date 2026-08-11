import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:image/image.dart' as img;
import 'package:permission_handler/permission_handler.dart';

import '../services/thermal_printer.dart';
import '../widgets/damage_notice_slip.dart';
import '../widgets/signature_pad.dart';

/// หน้าทดสอบเครื่องพิมพ์พกพา (Phase 0 ของใบแจ้งความเสียหาย)
///
/// พิสูจน์ 4 อย่างในใบเดียว ก่อนลงแรงต่อฟีเจอร์จริง:
///   1. TSC รับคำสั่ง ESC/POS raster จริงไหม
///   2. กระดาษ 58 มม. บนเครื่อง 3 นิ้ว — เนื้อหาชิดซ้ายพอดีหรือเยื้อง
///   3. ตัวหนังสือไทยเล็ก ๆ ที่ 384 จุด อ่านออกไหม
///   4. ลายเซ็นกับ QR พิมพ์ติดและสแกนได้ไหม
class PrinterTestScreen extends StatefulWidget {
  const PrinterTestScreen({super.key});

  @override
  State<PrinterTestScreen> createState() => _PrinterTestScreenState();
}

class _PrinterTestScreenState extends State<PrinterTestScreen> {
  final _slipKey = GlobalKey();
  final _sign = SignatureController();

  List<PrinterDevice> _devices = [];
  String? _mac;
  bool _connected = false;
  bool _busy = false;
  PrintLang _lang = PrintLang.tspl;
  final List<String> _log = [];

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    _sign.dispose();
    super.dispose();
  }

  void _say(String m) {
    // ignore: avoid_print
    print('[printer] $m');
    if (mounted) setState(() => _log.insert(0, m));
  }

  Future<void> _refresh() async {
    setState(() => _busy = true);
    try {
      // Android 12+ ต้องขอ BLUETOOTH_CONNECT ตอนรัน ไม่งั้น pairedBluetooths คืนลิสต์ว่าง
      // แบบไม่ error — จะดูเหมือน "ไม่เคยจับคู่เครื่องพิมพ์" ทั้งที่จับคู่แล้ว
      final st = await [
        Permission.bluetoothConnect,
        Permission.bluetoothScan,
      ].request();
      _say('สิทธิ์ Bluetooth: ${st.values.map((s) => s.name).join(", ")}');

      _say('Bluetooth เปิดอยู่: ${await ThermalPrinter.bluetoothOn}');
      final list = await ThermalPrinter.paired();
      _say('เครื่องที่จับคู่ไว้: ${list.length} เครื่อง');
      setState(() {
        _devices = list;
        _mac ??= list.isNotEmpty ? list.first.mac : null;
      });
    } catch (e) {
      _say('อ่านรายชื่อเครื่องไม่ได้: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _connect() async {
    if (_mac == null) return;
    setState(() => _busy = true);
    try {
      // ฝั่ง Kotlin ไล่ลอง secure-SDP → insecure-SDP → ยิงเข้า channel ตรง
      // คำตอบบอกด้วยว่าติดด้วยวิธีไหน เก็บไว้ไล่ปัญหาเวลาเครื่องอื่นต่อไม่ติด
      final r = await ThermalPrinter.connect(_mac!);
      final ok = r.startsWith('OK');
      _say(ok ? 'เชื่อมต่อสำเร็จ ($r)' : 'เชื่อมต่อไม่สำเร็จ — $r');
      setState(() => _connected = ok);
    } catch (e) {
      _say('เชื่อมต่อพัง: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<Uint8List> _capture() => captureSlipPng(_slipKey);

  Future<void> _savePng() async {
    setState(() => _busy = true);
    try {
      final png = await _capture();
      _say('จับภาพใบได้ ${png.length ~/ 1024} KB');

      // path_provider โยน LateInitializationError บนเครื่องนี้ (ทั้ง external และ temp)
      // → ไม่พึ่งมันสำหรับหน้าทดสอบ เขียนลงโฟลเดอร์ของแอปเองตรง ๆ
      // (โฟลเดอร์นี้แอปเขียนได้โดยไม่ต้องขอสิทธิ์ และ adb ดึงออกมาดูได้)
      Directory? dir;
      try {
        dir = await getExternalStorageDirectory();
      } catch (e) {
        _say('path_provider ใช้ไม่ได้ ($e) — ใช้ path ตรงแทน');
      }
      dir ??= Directory(
        '/storage/emulated/0/Android/data/com.sesurvey.se_survey/files',
      );
      await dir.create(recursive: true);
      final f = File('${dir.path}/slip_test.png');
      await f.writeAsBytes(png);
      _say('บันทึกแล้ว → ${f.path}');
    } catch (e) {
      _say('บันทึกรูปไม่สำเร็จ: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// ยิงแถบทดสอบสั้น ๆ ทีละภาษา — **แถบบอกชื่อโหมดตัวเอง** ดังนั้นอันไหนโผล่บนกระดาษ
  /// คืออันที่เครื่องเข้าใจ ไม่ต้องเดา (ใช้กระดาษน้อยกว่าพิมพ์ใบเต็มทีละโหมด)
  Future<void> _probeLangs() async {
    setState(() => _busy = true);
    try {
      if (!await ThermalPrinter.connected) {
        _say('ยังไม่ได้เชื่อมต่อ — กดเชื่อมต่อก่อน');
        return;
      }
      for (final lang in PrintLang.values) {
        final strip = _testStrip(lang);
        final bytes = switch (lang) {
          PrintLang.escPos => await ThermalPrinter.buildEscPos(strip),
          PrintLang.tspl => ThermalPrinter.buildTspl(strip),
          PrintLang.tsplInvert => ThermalPrinter.buildTspl(strip, invert: true),
        };
        final r = await ThermalPrinter.sendRaw(bytes);
        _say('ส่งแถบทดสอบ ${lang.label} (${bytes.length} B) → $r');
        // ให้เครื่องพิมพ์แถบก่อนหน้าจบก่อน ไม่งั้นบัฟเฟอร์ปนกัน
        await Future<void>.delayed(const Duration(seconds: 2));
      }
      _say('ส่งครบ 3 โหมดแล้ว — ดูว่ากระดาษออกแถบไหน');
    } catch (e) {
      _say('ทดสอบโหมดพัง: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// แถบทดสอบ 384×110 จุด — ตัวหนังสือ ASCII (ฟอนต์ในตัวของ package image ไม่มีไทย)
  /// พอสำหรับดูว่าโหมดไหนติด + เช็คว่าเส้นบางกับกล่องทึบพิมพ์ออกครบไหม
  img.Image _testStrip(PrintLang lang) {
    final im = img.Image(width: 384, height: 110);
    img.fill(im, color: img.ColorRgb8(255, 255, 255));
    final black = img.ColorRgb8(0, 0, 0);
    img.drawString(
      im,
      'MODE: ${lang.name}',
      font: img.arial24,
      x: 6,
      y: 6,
      color: black,
    );
    img.drawString(
      im,
      'SE SURVEY 58mm 384dots',
      font: img.arial14,
      x: 6,
      y: 40,
      color: black,
    );
    // กล่องทึบ + เส้นบาง 1 จุด — ดูความเข้มและว่าเส้นบางขาดหายไหม
    img.fillRect(im, x1: 6, y1: 62, x2: 120, y2: 84, color: black);
    for (var x = 130; x < 378; x += 4) {
      img.drawLine(im, x1: x, y1: 62, x2: x, y2: 84, color: black);
    }
    img.drawRect(im, x1: 0, y1: 92, x2: 383, y2: 108, color: black);
    return im;
  }

  Future<void> _print() async {
    setState(() => _busy = true);
    try {
      if (!await ThermalPrinter.connected) {
        _say('ยังไม่ได้เชื่อมต่อ — กดเชื่อมต่อก่อน');
        return;
      }
      final png = await _capture();
      _say('จับภาพใบได้ ${png.length ~/ 1024} KB — ส่งด้วยโหมด ${_lang.label}');
      final r = await ThermalPrinter.printPng(png, lang: _lang);
      _say(r == 'OK' ? 'ส่งงานพิมพ์แล้ว' : 'ส่งงานพิมพ์ไม่สำเร็จ — $r');
    } catch (e) {
      _say('พิมพ์พัง: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ทดสอบเครื่องพิมพ์')),
      // ไม่มี SafeArea → บรรทัด log ท้ายหน้าถูกแถบปุ่มของ Android ทับจนอ่านไม่ออก
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _mac,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'เครื่องพิมพ์ที่จับคู่ไว้',
                      border: OutlineInputBorder(),
                    ),
                    items: _devices
                        .map(
                          (d) => DropdownMenuItem(
                            value: d.mac,
                            child: Text('${d.name} (${d.mac})'),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => setState(() => _mac = v),
                  ),
                ),
                IconButton(
                  onPressed: _busy ? null : _refresh,
                  icon: const Icon(Icons.refresh),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy || _mac == null ? null : _connect,
                    child: Text(_connected ? 'เชื่อมต่อแล้ว ✓' : 'เชื่อมต่อ'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _print,
                    child: const Text('พิมพ์'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : _savePng,
                    child: const Text('บันทึกเป็นรูป'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _sign.clear(),
                    child: const Text('ล้างลายเซ็น'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<PrintLang>(
                    initialValue: _lang,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'ภาษาเครื่องพิมพ์',
                      border: OutlineInputBorder(),
                    ),
                    items: PrintLang.values
                        .map(
                          (l) =>
                              DropdownMenuItem(value: l, child: Text(l.label)),
                        )
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _lang = v ?? PrintLang.tspl),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FilledButton.tonal(
                    onPressed: _busy ? null : _probeLangs,
                    child: const Text('ทดสอบ 3 โหมด'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // ── ตัวใบจริง ──
            // RepaintBoundary ครอบเฉพาะใบที่กว้าง 384 จุด ส่วนการย่อให้พอดีจอ
            // อยู่ *นอก* boundary → จับภาพได้ 384 px เป๊ะไม่ว่าจอเครื่องจะละเอียดแค่ไหน
            Center(
              child: FittedBox(
                child: RepaintBoundary(
                  key: _slipKey,
                  child: DamageNoticeSlip(data: _demoData(), signature: _sign),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Divider(),
            ..._log.map((l) => Text(l, style: const TextStyle(fontSize: 11))),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  /// ข้อมูลตัวอย่างจากใบจริง (ไอโออิ · แบบรถประกัน ซึ่งมีบล็อกครบกว่าแบบคู่กรณี)
  DamageNoticeData _demoData() => const DamageNoticeData(
    subtitle: 'รถประกัน',
    fields: [
      SlipField('พิมพ์วันที่', '1 ส.ค. 2569 เวลา 14:05'),
      SlipField('เลขที่อุบัติเหตุ', '2026013700512'),
      SlipField('เลขเรื่อง Survey', 'SEABI-210260B00041'),
      SlipField('เลขกรมธรรม์', '1230137300'),
      SlipField('ประเภทกรมธรรม์', 'ประกัน 1 ซ่อมห้าง'),
      SlipField('ทะเบียนรถ', 'ขง6693'),
      SlipField('จังหวัด', 'พิษณุโลก'),
      SlipField('ยี่ห้อ/รุ่น', 'TOYOTA/'),
      SlipField('สี', 'ขาว'),
      SlipField('ฝ่ายใดเป็นฝ่ายถูก/ผิด', 'รถประกันเป็นฝ่ายผิด'),
      SlipField('ซ่อมที่', 'บริษัท โตโยต้า เมืองสองแคว จำกัด'),
    ],
    damages: [
      SlipDamage('กันชนหน้า(กันชน)', 'ต่ำ'),
      SlipDamage('ฝากระโปรงหน้า', 'ต่ำ'),
      SlipDamage('คานหน้าแอ่งด้านซ้าย', 'สูงมาก'),
    ],
    extraTitle: 'ความเสียหายส่วนแรก',
    extraFields: [
      SlipField('ตามเงื่อนไข', 'EX2,000'),
      SlipField('จำนวนเงิน', '2,000 บาท'),
    ],
    signerLabel: 'ผู้ขับขี่รถประกัน',
    operatorLine: 'SE206 นายศิริเทพ ทรงวิชาญสกุล',
    operatorPhone: '096-1436568',
    insurerLines: [
      '*** กรุณาติดต่อบริษัทฯภายใน 7 วัน',
      'บริษัทไอโออิ กรุงเทพ ประกันภัย จำกัด (มหาชน)',
      'ฝ่ายสินไหม 02-7808000 กด 7',
      '(เวลา 08:30-16:30น.)',
    ],
    qrUrl: 'https://survey.sesurvey.cloud/branches/1059',
  );
}
