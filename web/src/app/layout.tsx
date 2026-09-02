import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/AuthProvider';

/**
 * ฟอนต์ของทั้งเว็บ — Noto Sans Thai (user เคาะ 02/09/69 จาก handoff ของ Claude Design)
 *
 * ⛔ ของเดิมโหลดฟอนต์ Geist ไว้แต่ไม่มีใครใช้ (globals.css ทับด้วย Arial) และ Arial
 *    ไม่มีอักขระไทย → ไทยตกไปใช้ฟอนต์ของเครื่องผู้ใช้ (Windows=Leelawadee UI,
 *    Mac=Thonburi) หน้าเดียวกันจึงหน้าตาไม่เหมือนกันคนละเครื่อง
 *
 * เอาน้ำหนักเท่าที่ใช้จริงในซอร์ส: 400 (10 จุด) · 500 (205) · 600 (84) · 700 (52)
 * ⛔ อย่าโหลดครบ 100-900 — ฟอนต์ไทยไฟล์ใหญ่ ทุกน้ำหนักที่ไม่ได้ใช้คือถ่วงหน้าเปล่า ๆ
 */
const notoThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SE Survey — ระบบจัดการงานสำรวจ',
  description: 'ระบบจัดการงานสำรวจสำหรับเจ้าหน้าที่',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${notoThai.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
