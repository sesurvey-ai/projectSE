import type { Metadata } from 'next';
import { Noto_Sans_Thai, IBM_Plex_Sans_Thai, Sarabun } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProvider';

/**
 * ── ฟอนต์ของทั้งเว็บ ── ให้ผู้ใช้สลับเองได้ 3 แบบ (user ขอ 02/09/69 เพื่อเลือก)
 *
 * ⛔ ของเดิมโหลดฟอนต์ Geist ไว้แต่ไม่มีใครใช้ (globals.css ทับด้วย Arial) และ Arial
 *    ไม่มีอักขระไทย → ไทยตกไปใช้ฟอนต์ของเครื่องผู้ใช้ (Windows=Leelawadee UI,
 *    Mac=Thonburi) หน้าเดียวกันจึงหน้าตาไม่เหมือนกันคนละเครื่อง
 *
 * เอาน้ำหนักเท่าที่ใช้จริงในซอร์ส: 400 (10 จุด) · 500 (205) · 600 (84) · 700 (52)
 * ⛔ อย่าโหลดครบ 100-900 — ฟอนต์ไทยไฟล์ใหญ่ ทุกน้ำหนักที่ไม่ได้ใช้คือถ่วงหน้าเปล่า ๆ
 *
 * ⛔ ประกาศ 3 ตัวไม่ได้แปลว่าโหลด 3 ตัว — เบราว์เซอร์ดาวน์โหลดเฉพาะฟอนต์ที่มี
 *    ข้อความใช้จริงเท่านั้น ที่เพิ่มมาคือกฎ @font-face ในไฟล์ CSS ไม่กี่บรรทัด
 * ⛔ ตัวแปรฟอนต์ต้องอยู่บน <html> ไม่ใช่ <body> — ตัวสลับเขียน
 *    `--font-thai: var(--font-xxx)` ที่ documentElement ถ้าตัวแปรปลายทางประกาศไว้ที่ body
 *    มันจะหาไม่เจอแล้วได้ค่าว่าง (ดู FontSwitcher.tsx)
 */
const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-noto-thai', display: 'swap',
});
/** ออกแบบไทยกับละตินคู่กันมาเพื่องานอินเทอร์เฟซ/ตาราง — เลขกับทะเบียนรถนั่งเข้ากับไทยดี */
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-plex-thai', display: 'swap',
});
/** ⭐ ค่าตั้งต้น (user เคาะ 02/09/69) — ฟอนต์มาตรฐานเอกสารราชการไทย คนไทยคุ้นตาที่สุด
 *  ตัวแคบกว่าอีก 2 ตัว บรรทัดหนึ่งจุได้มากกว่า ซึ่งมีผลจริงกับหน้าที่มีเกือบ 200 ช่อง */
const sarabun = Sarabun({
  subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-sarabun', display: 'swap',
});

export const metadata: Metadata = {
  title: 'SE Survey — ระบบจัดการงานสำรวจ',
  description: 'ระบบจัดการงานสำรวจสำหรับเจ้าหน้าที่',
};

/**
 * ตั้งฟอนต์+ขนาดที่จำไว้ **ก่อน** หน้าถูกวาด — ถ้าไปตั้งใน useEffect
 * ผู้ใช้จะเห็นค่าตั้งต้นแวบหนึ่งแล้วค่อยกระโดดเปลี่ยนทุกครั้งที่เปิดหน้า
 * ⛔ คีย์กับช่วงค่าต้องตรงกับ AppearanceControls.tsx (ui_font / ui_scale 100-140)
 */
const UI_BOOT = `try{var d=document.documentElement;
var f=localStorage.getItem('ui_font');
if(f&&/^[a-z-]+$/.test(f))d.style.setProperty('--font-thai','var(--font-'+f+')');
var s=+localStorage.getItem('ui_scale');
if(s>=100&&s<=140)d.style.fontSize=(16*s/100)+'px';}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${notoThai.variable} ${plexThai.variable} ${sarabun.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: UI_BOOT }} /></head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
