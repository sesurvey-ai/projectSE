// normalize เบอร์โทรไทยให้เทียบกันได้ (พอร์ตจาก se-callphone/api/src/lib/phone.js)
export function normalizePhone(raw?: string | null): string {
  if (raw == null) return '';
  const s = String(raw).trim();
  const hasPlus = s.startsWith('+');
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0066')) d = d.slice(4);
  if (hasPlus && d.startsWith('66')) d = d.slice(2);
  else if (!hasPlus && d.startsWith('66') && d.length === 11) d = d.slice(2);
  if ((d.length === 8 || d.length === 9) && !d.startsWith('0')) d = '0' + d;
  return d;
}
