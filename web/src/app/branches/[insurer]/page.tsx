import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INSURER_BRANCH_PAGES, getInsurerBranchInfo } from '../insurers';

/**
 * หน้าปลายทางของ QR บนใบแจ้งความเสียหาย — /branches/<รหัสบริษัทประกัน>
 *
 * ⚠️ ต้องเปิดสาธารณะ ไม่ล็อกอิน: คนสแกนคือคู่กรณี/ลูกค้าที่ไม่มีบัญชีในระบบ
 *    ตอนนี้ปลอดภัยเพราะ guard ของเว็บอยู่ใน layout ของ /admin /callcenter /inspector เท่านั้น
 *    และทั้งแอปไม่มี middleware.ts — ถ้าวันหน้าเพิ่ม middleware บังคับ login ต้องยกเว้น /branches ด้วย
 *
 * ตั้งใจให้เป็น server component ล้วน (ไม่มี 'use client') เพราะคนสแกนอยู่หน้างานอุบัติเหตุ
 * เน็ตมือถือช้า — หน้าต้องอ่านได้ทันทีจาก HTML โดยไม่รอ JS
 */

type PageProps = { params: { insurer: string } };

// prerender เฉพาะรหัสที่รู้จัก ส่วนรหัสอื่นยัง render สดแล้วตกไป notFound()
export function generateStaticParams() {
  return Object.keys(INSURER_BRANCH_PAGES).map((insurer) => ({ insurer }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const insurer = getInsurerBranchInfo(params.insurer);
  if (!insurer) return { title: 'ไม่พบข้อมูลบริษัทประกัน' };
  return {
    title: `${insurer.name} — รายชื่อสาขา / ศูนย์-อู่ในสัญญา`,
    description: 'ตรวจสอบรายชื่อสาขาและศูนย์/อู่ในสัญญาของบริษัทประกัน',
  };
}

export default function InsurerBranchesPage({ params }: PageProps) {
  const insurer = getInsurerBranchInfo(params.insurer);
  if (!insurer) notFound();

  return (
    <main className="min-h-screen bg-gray-50 flex justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <span className="flex-none w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center overflow-hidden">
              {insurer.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={insurer.logo} alt="" className="w-16 h-16 object-contain" />
              ) : (
                <span className="text-blue-700 text-sm font-semibold">{insurer.code}</span>
              )}
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 leading-snug">{insurer.name}</h1>
              {insurer.sub && <p className="text-sm text-gray-500 mt-0.5">{insurer.sub}</p>}
            </div>
          </div>

          <p className="mt-6 text-base text-gray-600 leading-relaxed">
            แตะรายการด้านล่างเพื่อเปิดเว็บไซต์ของบริษัทประกัน
          </p>

          {/* ปุ่มใหญ่เต็มความกว้าง สูงอย่างน้อย 68px — คนสแกนใช้มือถือ 100% และมักยืนอยู่หน้างาน */}
          <div className="mt-4 space-y-4">
            {insurer.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-h-[68px] px-5 py-4 rounded-xl bg-blue-600 text-white shadow-sm active:bg-blue-800 hover:bg-blue-700 transition-colors"
              >
                <span className="flex-1 text-lg font-medium leading-snug">{link.label}</span>
                <svg className="flex-none w-5 h-5 opacity-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M11 3a1 1 0 100 2h2.59l-6.3 6.29a1 1 0 101.42 1.42L15 6.41V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
              </a>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 leading-relaxed">
          ข้อมูลสาขาและศูนย์/อู่ในสัญญาเป็นของบริษัทประกันโดยตรง
        </p>
      </div>
    </main>
  );
}
