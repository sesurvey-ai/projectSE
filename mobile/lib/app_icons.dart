// ไอคอนฟอนต์ MyFlutterApp (จาก FlutterIcon.com) — camera (Entypo) + money/medical (Font Awesome 5)
// ฟอนต์อยู่ที่ assets/fonts/MyFlutterApp.ttf (ประกาศใน pubspec.yaml family: MyFlutterApp)
// ignore_for_file: constant_identifier_names
import 'package:flutter/widgets.dart';

class MyFlutterApp {
  MyFlutterApp._();

  static const _kFontFam = 'MyFlutterApp';

  static const IconData camera = IconData(0xe800, fontFamily: _kFontFam);
  static const IconData dollar_sign = IconData(0xf155, fontFamily: _kFontFam);
  static const IconData procedures = IconData(0xf487, fontFamily: _kFontFam);
  static const IconData coins = IconData(0xf51e, fontFamily: _kFontFam);
  static const IconData comment_dollar = IconData(0xf651, fontFamily: _kFontFam);
  static const IconData comments_dollar = IconData(0xf653, fontFamily: _kFontFam);
}
