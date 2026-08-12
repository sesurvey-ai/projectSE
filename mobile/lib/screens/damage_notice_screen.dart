import 'dart:io';

import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/damage_notice_catalog.dart';
import '../services/damage_notice_builder.dart';
import '../services/thermal_printer.dart';
import '../widgets/damage_notice_slip.dart';
import '../widgets/signature_pad.dart';

/// หน้าออกใบเอกสารหน้างานจาก **เคสจริง** — เลือกแบบใบ → ให้เขาเซ็นบนจอ → พิมพ์ + เก็บเข้าสำนวน
///
/// คืนค่า path ของรูปใบที่บันทึก (หรือ null ถ้าไม่ได้บันทึก) ให้ฟอร์มสำรวจเอาไปใส่
/// รายการรูปในหมวด "ใบแจ้งความเสียหาย" — **ไฟล์ที่พิมพ์ให้คู่กรณีกับที่เข้าสำนวนคือไฟล์เดียวกัน**
class DamageNoticeScreen extends StatefulWidget {
  const DamageNoticeScreen({
    super.key,
    required this.report,
    required this.operatorName,
    required this.operatorPhone,
    required this.caseFolder,
  });

  /// payload ของฟอร์มสำรวจ ณ ตอนนี้ (ยังไม่ต้องส่งงานก็ออกใบได้ — ใบออกหน้างาน)
  final Map<String, dynamic> report;
  final String operatorName;
  final String operatorPhone;

  /// โฟลเดอร์รูปของเคสนี้ — เก็บใบไว้ที่เดียวกับรูปอื่น จะได้อัปขึ้นเซิร์ฟเวอร์พร้อมกัน
  final String caseFolder;

  @override
  State<DamageNoticeScreen> createState() => _DamageNoticeScreenState();
}

class _DamageNoticeScreenState extends State<DamageNoticeScreen> {
  static const _kPrefPrinterMac = 'slip_printer_mac';

  final _slipKey = GlobalKey();
  final _sign = SignatureController();

  late final DamageNoticeBuilder _builder;
  late List<SlipType> _usable;
  SlipType? _type;
  int _oppIndex = 0;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _builder = DamageNoticeBuilder(
      report: widget.report,
      operatorName: widget.operatorName,
      operatorPhone: widget.operatorPhone,
    );
    // แบบที่ยังไม่มีเนื้อในใบจริง ไม่เอามาโชว์ในหน้าใช้งานจริง (ต่างจากหน้าทดสอบ)
    // และใบของคู่กรณีจะเลือกได้ก็ต่อเมื่อกรอกคู่กรณีไว้แล้ว
    _usable = kSlipTypes
        .where((t) =>
            t.ready &&
            (t.subject != SlipSubject.opponentCar || _builder.opponents.isNotEmpty))
        .toList();
    _type = _usable.isEmpty ? null : _usable.first;
    if (_builder.footer == null) {
      _error = 'ไม่รู้จักบริษัทประกัน "${widget.report['insurance_company'] ?? ''}"\n'
          'ท้ายใบ (เบอร์ติดต่อ/กำหนดวันติดต่อ) ต่างกันรายบริษัท เติมแทนไม่ได้ '
          '— แก้ชื่อบริษัทในหมวดกรมธรรม์ให้ถูกก่อน';
    }
  }

  @override
  void dispose() {
    _sign.dispose();
    super.dispose();
  }

  void _snack(String m) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  /// เตือนถ้ายังไม่เซ็น แต่ไม่ห้าม — บางกรณีพิมพ์เปล่าให้เซ็นด้วยปากกาก็มี
  Future<bool> _confirmUnsigned(String action) async {
    if (_sign.isNotEmpty) return true;
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('ยังไม่ได้เซ็นชื่อ'),
            content: Text('ใบนี้ยังไม่มีลายเซ็น ต้องการ$actionเลยไหม'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('กลับไปเซ็น')),
              TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(action)),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _print() async {
    if (!await _confirmUnsigned('พิมพ์')) return;
    setState(() => _busy = true);
    try {
      await [Permission.bluetoothConnect, Permission.bluetoothScan].request();
      if (!await ThermalPrinter.connected && !await _connect()) return;
      final png = await captureSlipPng(_slipKey);
      final r = await ThermalPrinter.printPng(png);
      _snack(r == 'OK' ? 'ส่งงานพิมพ์แล้ว' : 'พิมพ์ไม่สำเร็จ — $r');
    } catch (e) {
      _snack('พิมพ์ไม่สำเร็จ: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// ต่อเครื่องพิมพ์ที่จำไว้ก่อน ไม่มีค่อยถาม — หน้างานไม่ควรต้องเลือกเครื่องทุกครั้ง
  Future<bool> _connect() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kPrefPrinterMac);
    final devices = await ThermalPrinter.paired();
    if (devices.isEmpty) {
      _snack('ยังไม่ได้จับคู่เครื่องพิมพ์ — จับคู่ในหน้าตั้งค่า Bluetooth ของเครื่องก่อน');
      return false;
    }
    var mac = saved != null && devices.any((d) => d.mac == saved)
        ? saved
        : (devices.length == 1 ? devices.first.mac : null);
    if (mac == null && mounted) {
      mac = await showDialog<String>(
        context: context,
        builder: (ctx) => SimpleDialog(
          title: const Text('เลือกเครื่องพิมพ์'),
          children: devices
              .map((d) => SimpleDialogOption(
                    onPressed: () => Navigator.pop(ctx, d.mac),
                    child: Text('${d.name}  (${d.mac})'),
                  ))
              .toList(),
        ),
      );
    }
    if (mac == null) return false;
    final r = await ThermalPrinter.connect(mac);
    if (!r.startsWith('OK')) {
      // อาการนี้เกือบทุกครั้งคือเครื่องพิมพ์ปิด/หลับ ไม่ใช่จับคู่ไม่ติด — บอกให้ตรงจุด
      _snack('ต่อเครื่องพิมพ์ไม่ได้ — เครื่องเปิดอยู่หรือเปล่า?');
      return false;
    }
    await prefs.setString(_kPrefPrinterMac, mac);
    return true;
  }

  Future<void> _save() async {
    if (!await _confirmUnsigned('บันทึก')) return;
    setState(() => _busy = true);
    try {
      final png = await captureSlipPng(_slipKey);
      await Directory(widget.caseFolder).create(recursive: true);
      final path = '${widget.caseFolder}/damage_notice_'
          '${DateTime.now().millisecondsSinceEpoch}.png';
      await File(path).writeAsBytes(png);
      if (mounted) Navigator.pop(context, path);
    } catch (e) {
      _snack('บันทึกไม่สำเร็จ: $e');
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null || _type == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('ออกใบเอกสาร')),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Text(_error ?? 'ยังไม่มีแบบใบที่ออกได้สำหรับเคสนี้',
                textAlign: TextAlign.center, style: const TextStyle(fontSize: 15)),
          ),
        ),
      );
    }

    final needsOpponent = _type!.subject == SlipSubject.opponentCar;
    final opps = _builder.opponents;

    return Scaffold(
      appBar: AppBar(title: const Text('ออกใบเอกสาร')),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(12), children: [
          DropdownButtonFormField<SlipType>(
            initialValue: _type,
            isExpanded: true,
            decoration:
                const InputDecoration(labelText: 'แบบใบ', border: OutlineInputBorder()),
            items: _usable
                .map((t) => DropdownMenuItem(
                    value: t, child: Text(t.name, style: const TextStyle(fontSize: 14))))
                .toList(),
            // เปลี่ยนแบบใบ = คนละเอกสาร ลายเซ็นของใบเดิมใช้ต่อไม่ได้
            onChanged: (v) => setState(() {
              _type = v ?? _type;
              _sign.clear();
            }),
          ),
          if (needsOpponent && opps.length > 1) ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<int>(
              initialValue: _oppIndex,
              isExpanded: true,
              decoration: const InputDecoration(
                  labelText: 'คู่กรณีคันที่', border: OutlineInputBorder()),
              items: List.generate(opps.length, (i) {
                final plate = (opps[i]['plate'] ?? '').toString().trim();
                return DropdownMenuItem(
                    value: i,
                    child: Text('คันที่ ${i + 1}${plate.isEmpty ? '' : ' · $plate'}',
                        style: const TextStyle(fontSize: 14)));
              }),
              onChanged: (v) => setState(() {
                _oppIndex = v ?? 0;
                _sign.clear();
              }),
            ),
          ],
          const SizedBox(height: 10),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : () => setState(() => _sign.clear()),
                icon: const Icon(Icons.undo, size: 18),
                label: const Text('ล้างลายเซ็น'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : _print,
                icon: const Icon(Icons.print_outlined, size: 18),
                label: const Text('พิมพ์'),
              ),
            ),
          ]),
          const SizedBox(height: 8),
          SizedBox(
            height: 48,
            child: FilledButton.icon(
              onPressed: _busy ? null : _save,
              icon: const Icon(Icons.save_alt, size: 18),
              label: const Text('บันทึกเข้าสำนวน'),
            ),
          ),
          const SizedBox(height: 12),
          // ย่อให้พอดีจอ *นอก* RepaintBoundary → จับภาพได้ 384 จุดเป๊ะเสมอ
          Center(
            child: FittedBox(
              child: RepaintBoundary(
                key: _slipKey,
                child: DamageNoticeSlip(
                  data: _builder.build(_type!, opponentIndex: _oppIndex),
                  signature: _sign,
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ]),
      ),
    );
  }
}
