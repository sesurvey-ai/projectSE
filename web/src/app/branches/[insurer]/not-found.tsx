/**
 * รหัสบริษัทประกันที่ไม่รู้จัก — ต้องได้ข้อความสุภาพเป็นภาษาไทย ไม่ใช่หน้า 404 ขาว ๆ ของ Next
 * (คนที่มาถึงตรงนี้คือคู่กรณีที่สแกน QR จากใบแล้วไม่ได้ผล ไม่ใช่คนของบริษัท)
 */
export default function InsurerNotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <span className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10A8 8 0 112 10a8 8 0 0116 0zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
        </span>

        <h1 className="mt-4 text-xl font-bold text-gray-900">ไม่พบข้อมูลบริษัทประกัน</h1>
        <p className="mt-3 text-base text-gray-600 leading-relaxed">
          ลิงก์นี้อาจไม่ครบถ้วน หรือ QR Code บนใบเสียหายจนสแกนได้ไม่ครบ
        </p>
        <p className="mt-2 text-base text-gray-600 leading-relaxed">
          กรุณาตรวจสอบใบแจ้งความเสียหายอีกครั้ง หรือติดต่อเจ้าหน้าที่สำรวจตามเบอร์ที่ระบุไว้บนใบ
        </p>
      </div>
    </main>
  );
}
