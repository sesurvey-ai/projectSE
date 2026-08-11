import 'dart:convert' show latin1;
import 'dart:ui' as ui;

import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:image/image.dart' as img;
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart'
    show PrintBluetoothThermal;

/// เครื่องพิมพ์พกพา — TSC Alpha-3R / RE310B ต่อผ่าน **Bluetooth Classic (SPP)**
///
/// สเปกบอกว่า TSC รองรับ ESC/POS emulation ด้วย แต่ **ทดสอบกับเครื่องจริงแล้วไม่ใช่** —
/// ส่ง ESC/POS เข้าไปเครื่องรับ byte ครบแต่ไม่พิมพ์อะไรเลย ต้องใช้ **TSPL** ซึ่งเป็นภาษาแม่
/// (ดู [PrintLang]) อย่าเชื่อสเปกอย่างเดียว ให้ยิงแถบทดสอบทั้ง 2 ภาษาเมื่อเจอเครื่องรุ่นใหม่
///
/// **ส่งเป็นรูปอย่างเดียว ไม่ส่งเป็นข้อความ** — เครื่องพิมพ์ความร้อนพิมพ์ภาษาไทย
/// ผ่านคำสั่งข้อความมักเพี้ยน (ขึ้นกับ codepage ในตัวเครื่อง) การ render ใบเป็นรูป
/// แล้วส่ง raster ได้ฟอนต์เดียวกับที่เห็นบนจอเป๊ะ และได้ไฟล์เดียวกับที่เก็บเข้าสำนวนด้วย
class ThermalPrinter {
  /// กระดาษ 58 มม. ที่ 203 dpi = 384 จุด — ออกแบบใบที่ความกว้างนี้ตั้งแต่แรก
  /// รูปที่กว้างกว่านี้จะถูกย่อลง (เสียความคม) รูปที่แคบกว่าจะไม่ถูกขยาย
  static const int dots = 384;

  /// ต่อ/ส่งข้อมูลผ่านโค้ด Kotlin ของเราเอง (PrinterBridge) ไม่ใช่ผ่าน plugin
  ///
  /// เหตุผล: เครื่องพิมพ์ที่ใช้จริงตอบ SDP ไม่ได้ (`SDP_CFG_FAILED`) plugin ที่มีอยู่
  /// ต่อผ่าน SDP ทางเดียวจึงต่อไม่ติด ฝั่ง Kotlin ของเรามีทางสำรองยิงเข้า RFCOMM channel ตรง
  static const _ch = MethodChannel('com.sesurvey.se_survey/printer');

  static Future<bool> get bluetoothOn => PrintBluetoothThermal.bluetoothEnabled;

  static Future<bool> get connected async =>
      await _ch.invokeMethod<bool>('connected') ?? false;

  /// เฉพาะเครื่องที่ **จับคู่ไว้แล้ว** — ไม่สแกนหาเครื่องใหม่
  /// (การจับคู่ทำครั้งเดียวในหน้าตั้งค่า Bluetooth ของเครื่อง ไม่ต้องทำในแอป)
  static Future<List<PrinterDevice>> paired() async {
    final raw = await _ch.invokeListMethod<Map<Object?, Object?>>('paired') ?? [];
    return raw
        .map((m) => PrinterDevice('${m['name']}', '${m['mac']}'))
        .toList(growable: false);
  }

  /// คืน `OK:<วิธีที่ต่อติด>` หรือ `FAIL:<เหตุผล>` — เก็บวิธีไว้ด้วยเพื่อไล่ปัญหาหน้างานได้
  static Future<String> connect(String mac) async =>
      await _ch.invokeMethod<String>('connect', {'mac': mac}) ?? 'FAIL:ไม่มีคำตอบ';

  static Future<void> get disconnect async => _ch.invokeMethod('disconnect');

  /// เตรียมรูปให้พร้อมพิมพ์ — กว้าง ≤ 384 จุด และเป็นขาว-ดำล้วน
  ///
  /// หัวพิมพ์ความร้อนไม่มีเทา ถ้าไม่แปลงเองจะโดน dither อัตโนมัติ
  /// แล้วตัวหนังสือไทยเล็ก ๆ จะพร่าอ่านไม่ออก
  static img.Image prepare(Uint8List png) {
    final decoded = img.decodeImage(png);
    if (decoded == null) throw StateError('อ่านรูปที่จะพิมพ์ไม่ได้');
    var sheet = decoded.width > dots
        ? img.copyResize(decoded, width: dots, interpolation: img.Interpolation.average)
        : decoded;
    sheet = img.grayscale(sheet);
    return img.luminanceThreshold(sheet, threshold: 0.6);
  }

  /// ESC/POS raster — ภาษาของเครื่องพิมพ์ใบเสร็จทั่วไป
  ///
  /// [feedLines] เดินกระดาษท้ายงานให้พ้นหัวพิมพ์ก่อนฉีก — เครื่องพกพาไม่มีที่ตัด
  static Future<List<int>> buildEscPos(img.Image sheet, {int feedLines = 4}) async {
    final profile = await CapabilityProfile.load();
    final gen = Generator(PaperSize.mm58, profile);
    return [
      ...gen.reset(),
      // ชิดซ้ายเสมอ: Alpha-3R/RE310B เป็นเครื่อง 3 นิ้ว ถ้าใส่กระดาษ 58 มม.
      // แล้วสั่งจัดกึ่งกลาง เนื้อหาจะเยื้องออกนอกกระดาษครึ่งหนึ่ง
      ...gen.imageRaster(sheet, align: PosAlign.left),
      ...gen.feed(feedLines),
    ];
  }

  /// TSPL `BITMAP` — ภาษาแม่ของ TSC (ใช้เมื่อ ESC/POS emulation ไม่ได้เปิดในตัวเครื่อง)
  ///
  /// [invert] สลับขั้วบิต: คู่มือ TSPL ระบุว่าบิต **0 = จุดดำ** แต่เฟิร์มแวร์บางรุ่นกลับกัน
  /// ถ้าพิมพ์ออกมาเป็นแผ่นดำทั้งแผ่น/ขาวทั้งแผ่น ให้สลับค่านี้
  /// [feedDots] ระยะเดินกระดาษท้ายงาน — ต้องมากพอให้บรรทัดสุดท้าย (QR) **พ้นฟันฉีก**
  /// ไม่งั้นฉีกแล้ว QR ขาดครึ่ง 200 จุด ≈ 25 มม. วัดจากเครื่องจริงแล้วพอดี
  static List<int> buildTspl(img.Image sheet, {bool invert = false, int feedDots = 200}) {
    final widthBytes = (sheet.width + 7) ~/ 8;
    final data = Uint8List(widthBytes * sheet.height);
    // ค่าตั้งต้น = "ไม่พิมพ์" ทั้งแผ่น แล้วค่อยเจาะจุดดำลงไป
    data.fillRange(0, data.length, invert ? 0x00 : 0xFF);

    for (var y = 0; y < sheet.height; y++) {
      for (var x = 0; x < sheet.width; x++) {
        if (sheet.getPixel(x, y).r >= 128) continue; // ขาว = ไม่ต้องแตะ
        final i = y * widthBytes + (x >> 3);
        final mask = 0x80 >> (x & 7);
        if (invert) {
          data[i] |= mask;
        } else {
          data[i] &= (~mask) & 0xFF;
        }
      }
    }

    // 203 dpi = 8 จุด/มม.
    //
    // ⚠️ เขียนหน่วยกำกับเสมอ (`0 mm` ไม่ใช่ `0`) — เขียนลอย ๆ เครื่องตีความตามหน่วย
    // ที่ตั้งค้างไว้ แล้วมองว่ากระดาษเป็นลาเบลที่ยังหาช่องว่างไม่เจอ → **เดินกระดาษเปล่า
    // ยาว 15-20 ซม. ทุกงาน** (เจอจริงตอนทดสอบ 2026-08-11)
    final heightMm = (sheet.height / 8).ceil();
    final head = 'SIZE 58 mm,$heightMm mm\r\n'
        'GAP 0 mm,0 mm\r\n' // กระดาษต่อเนื่อง ไม่มีช่องว่างให้หา
        'SET TEAR OFF\r\n' // ไม่ต้องดันกระดาษไปตำแหน่งฉีกหลังพิมพ์จบ
        'SET PEEL OFF\r\n'
        'SET COUNTER @0 1\r\n'
        'DIRECTION 0\r\n'
        'REFERENCE 0,0\r\n'
        'CLS\r\n'
        'BITMAP 0,0,$widthBytes,${sheet.height},0,';
    return [
      ...latin1.encode(head),
      ...data,
      ...latin1.encode('\r\nPRINT 1,1\r\n'),
      // เดินกระดาษให้พ้นหัวพิมพ์พอฉีกได้ ไม่ต้องมากกว่านี้
      ...latin1.encode('FEED $feedDots\r\n'),
    ];
  }

  /// พิมพ์รูปออกเครื่อง — ต้อง [connect] ไว้ก่อน · คืน `OK` หรือ `FAIL:<เหตุผล>`
  static Future<String> printPng(Uint8List png,
      {PrintLang lang = PrintLang.tspl, int feedLines = 4}) async {
    final sheet = prepare(png);
    final bytes = switch (lang) {
      PrintLang.escPos => await buildEscPos(sheet, feedLines: feedLines),
      PrintLang.tspl => buildTspl(sheet),
      PrintLang.tsplInvert => buildTspl(sheet, invert: true),
    };
    return sendRaw(bytes);
  }

  static Future<String> sendRaw(List<int> bytes) async =>
      await _ch.invokeMethod<String>('write', {'bytes': Uint8List.fromList(bytes)}) ??
      'FAIL:ไม่มีคำตอบ';
}

/// ภาษาที่ส่งเข้าเครื่องพิมพ์
///
/// **ทดสอบกับเครื่องจริงแล้ว 2026-08-11 (PS-2472E9): TSPL เท่านั้นที่พิมพ์ออก**
/// ESC/POS ส่งเข้าไปแล้วเครื่องรับ byte ครบแต่ไม่พิมพ์อะไรเลย (emulation ไม่ได้เปิด)
/// เก็บ ESC/POS ไว้เผื่อทีมมีเครื่องยี่ห้ออื่น · tsplInvert ไว้เผื่อเฟิร์มแวร์กลับขั้วบิต
enum PrintLang {
  tspl('TSPL'),
  tsplInvert('TSPL สลับขั้ว'),
  escPos('ESC/POS');

  const PrintLang(this.label);
  final String label;
}

class PrinterDevice {
  const PrinterDevice(this.name, this.mac);
  final String name;
  final String mac;
}

/// จับภาพ widget ที่ครอบด้วย [RepaintBoundary] ออกมาเป็น PNG
///
/// วาง `RepaintBoundary(key: k, child: SizedBox(width: 384, child: ...))` แล้วเรียก
/// `captureSlipPng(k)` — ได้ PNG กว้าง 384 px พอดีจุดเครื่องพิมพ์ ไม่ขึ้นกับ
/// ความละเอียดจอ (ตัวย่อ/ขยายเพื่อโชว์บนจอต้องอยู่**นอก** RepaintBoundary)
Future<Uint8List> captureSlipPng(GlobalKey boundaryKey) async {
  final obj = boundaryKey.currentContext?.findRenderObject();
  if (obj is! RenderRepaintBoundary) {
    throw StateError('ยังไม่ได้วาดใบบนจอ จับภาพไม่ได้');
  }
  // ต้องรอให้เฟรมปัจจุบันวาดจบก่อน ไม่งั้น layer ยังไม่พร้อมให้แปลงเป็นรูป
  await WidgetsBinding.instance.endOfFrame;

  ui.Image image;
  try {
    image = await obj.toImage(pixelRatio: 1.0);
  } catch (e) {
    throw StateError('toImage ล้ม: $e');
  }

  try {
    // ขอ PNG ตรง ๆ ก่อน — ถ้า engine ตัวนี้ทำไม่ได้ ค่อยขอ rawRgba มาเข้ารหัสเอง
    // (มีเครื่อง/บิลด์ที่ toByteData(png) โยน LateInitializationError จากข้างใน dart:ui)
    final png = await image.toByteData(format: ui.ImageByteFormat.png);
    if (png != null) return png.buffer.asUint8List();
    throw StateError('toByteData(png) คืน null');
  } catch (e) {
    final raw = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (raw == null) throw StateError('แปลงใบเป็นรูปไม่สำเร็จ ($e)');
    final encoded = img.encodePng(img.Image.fromBytes(
      width: image.width,
      height: image.height,
      bytes: raw.buffer,
      numChannels: 4,
    ));
    return Uint8List.fromList(encoded);
  } finally {
    image.dispose();
  }
}
