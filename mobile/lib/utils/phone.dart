// normalize เบอร์โทรให้ตรงกับฝั่ง API (backend/src/utils/phone.ts)
//  - ตัดทุกอย่างที่ไม่ใช่ตัวเลข
//  - แปลง +66 / 0066 / 66 (เมื่อชัดว่าเป็นรหัสประเทศ) -> 0
String normalizePhone(String? raw) {
  if (raw == null) return '';
  final s = raw.trim();
  final hasPlus = s.startsWith('+');

  var digits = s.replaceAll(RegExp(r'\D'), ''); // เหลือเฉพาะตัวเลข

  if (digits.startsWith('0066')) {
    digits = digits.substring(4);
  }

  if (hasPlus && digits.startsWith('66')) {
    digits = digits.substring(2);
  } else if (!hasPlus && digits.startsWith('66') && digits.length == 11) {
    digits = digits.substring(2);
  }

  if ((digits.length == 8 || digits.length == 9) && !digits.startsWith('0')) {
    digits = '0$digits';
  }

  return digits;
}
