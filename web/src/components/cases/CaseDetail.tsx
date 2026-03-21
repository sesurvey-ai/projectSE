'use client';

import PhotoGallery from './PhotoGallery';
import ReviewForm from '@/components/review/ReviewForm';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CaseDetailProps {
  caseData: any;
  report: any;
  photos: any[];
  review: any;
  onReviewSubmitted: () => void;
}

function formatDate(d: string) { if (!d) return '-'; return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatCurrency(v: number | null | undefined) { if (v == null) return '-'; return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(v); }

const CLAIM_TYPE_LABELS: Record<string, string> = { F: 'เคลมสด', D: 'เคลมแห้ง', A: 'งานนัดหมาย', C: 'งานติดตาม' };
const DAMAGE_LEVEL_COLORS: Record<string, string> = { 'หนัก': 'bg-red-100 text-red-800', 'เบา': 'bg-green-100 text-green-800' };

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <p className="font-medium text-gray-800">{value || '-'}</p>
    </div>
  );
}

export default function CaseDetail({ caseData, report, photos, review, onReviewSubmitted }: CaseDetailProps) {
  return (
    <div className="space-y-6">
      {report && (
        <>
          {/* รายละเอียดรถยนต์ — header + ข้อมูลบริษัท/เคลม (แบบตาราง) */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar */}
            <div className="bg-blue-700 text-white px-4 py-2 flex flex-wrap items-center gap-x-6 gap-y-1">
              <span className="font-bold">:: รายละเอียดรถยนต์</span>
              <div className="flex items-center gap-4 ml-auto">
                <span>ประเภทเคลม :</span>
                {['F','D','A','C'].map(v => (
                  <span key={v} className={`${report.claim_type === v ? 'font-bold text-yellow-300' : 'text-blue-200'}`}>
                    {report.claim_type === v ? '● ' : '○ '}{CLAIM_TYPE_LABELS[v]}
                  </span>
                ))}
                <span className="ml-4">รถเสียหาย :</span>
                <span className={report.damage_level === 'หนัก' ? 'font-bold text-yellow-300' : 'text-blue-200'}>{report.damage_level === 'หนัก' ? '● ' : '○ '}หนัก</span>
                <span className={report.damage_level === 'เบา' ? 'font-bold text-yellow-300' : 'text-blue-200'}>{report.damage_level === 'เบา' ? '● ' : '○ '}เบา</span>
                {report.car_lost && <span className="text-red-300 font-bold ml-2">☑ รถหาย</span>}
              </div>
            </div>
            {/* Table rows */}
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 w-[160px]">บริษัทผู้จัดเรื่อง :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.survey_company || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 w-[160px]">วันที่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_date || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ที่อยู่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.survey_company_address || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">เบอร์โทรศัพท์/เบอร์ Fax</td>
                  <td className="px-4 py-2 text-gray-800">{report.survey_company_phone || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">บริษัทประกัน :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.insurance_company || '-'} {report.insurance_branch && <span className="text-gray-500 ml-2">{report.insurance_branch}</span>}</td>
                  <td className="px-4 py-2 text-gray-500">เลขเรื่องเซอร์เวย์ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.survey_job_no || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">เลขที่รับแจ้ง :</td>
                  <td className="px-4 py-2 text-gray-800">{report.claim_ref_no || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">เลขที่เคลม :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.claim_no || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* กรมธรรม์ — แบบตาราง */}
          {(
            <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 w-[160px]">กรมธรรม์(พรบ.) :</td>
                    <td className="px-4 py-2 text-gray-800">{report.prb_number || '-'}</td>
                    <td className="px-4 py-2 text-gray-500 w-[160px]">กรมธรรม์เลขที่ :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{report.policy_no || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อผู้ขับขี่ตามกรมธรรม์ :</td>
                    <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.driver_by_policy || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">วันที่เริ่มต้น :</td>
                    <td className="px-4 py-2 text-gray-800">{report.policy_start || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">วันที่สิ้นสุด :</td>
                    <td className="px-4 py-2 text-gray-800">{report.policy_end || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ผู้เอาประกันภัย :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{report.assured_name || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">ประกันประเภท :</td>
                    <td className="px-4 py-2 text-gray-800">{report.policy_type || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">อีเมลผู้เอาประกัน :</td>
                    <td className="px-4 py-2 text-gray-800">{report.assured_email || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">รหัสภัยยานยนต์ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.risk_code || '-'}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ค่าเสียหายส่วนแรก :</td>
                    <td className="px-4 py-2 text-gray-800">{report.deductible != null ? formatCurrency(report.deductible) : '-'}</td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* รายละเอียดรถยนต์ — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 w-[160px]">หมายเลขทะเบียน :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.license_plate || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 w-[160px]">จังหวัด :</td>
                  <td className="px-4 py-2 text-gray-800">{report.car_province || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ประเภทรถ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.car_type || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ยี่ห้อ :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.car_brand || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">รุ่น :</td>
                  <td className="px-4 py-2 text-gray-800">{report.car_model || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">สีรถ :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.car_color || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ปีจดทะเบียนรถ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.car_reg_year || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ประเภทรถยนต์ไฟฟ้า :</td>
                  <td className="px-4 py-2 text-gray-800">{report.ev_type || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">หมายเลขตัวถัง :</td>
                  <td className="px-4 py-2 text-gray-800">{report.chassis_no || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">หมายเลข Model :</td>
                  <td className="px-4 py-2 text-gray-800">{report.model_no || '-'}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">หมายเลขเครื่อง :</td>
                  <td className="px-4 py-2 text-gray-800">{report.engine_no || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">หมายเลข กม. :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.mileage != null ? `${Number(report.mileage).toLocaleString()}` : '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ข้อมูลผู้ขับขี่ — แบบตาราง */}
          {(
            <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 w-[160px] whitespace-nowrap">ผู้ขับขี่รถประกันภัย :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {report.driver_gender && <span className="text-gray-500 mr-2">{report.driver_gender === 'M' ? '● ชาย' : report.driver_gender === 'F' ? '● หญิง' : ''}</span>}
                      {report.driver_name || '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 w-[160px] whitespace-nowrap">ความสัมพันธ์กับเจ้าของรถ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_relation || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">อายุ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_age != null ? report.driver_age : '-'}</td>
                    <td className="px-4 py-2 text-gray-500">วันเกิด :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_birthdate || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">ที่อยู่ปัจจุบัน :</td>
                    <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.driver_address || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">โทรศัพท์ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_phone || '-'}</td>
                    <td className="px-4 py-2 text-gray-500" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">บัตรประชาชนเลขที่ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_id_card || '-'}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ใบอนุญาตขับขี่เลขที่ :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{report.driver_license_no || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ประเภท :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_license_type || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">ออกให้ที่ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_license_place || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">ออกให้วันที่ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_license_start || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">หมดอายุวันที่ :</td>
                    <td className="px-4 py-2 text-gray-800">{report.driver_license_end || '-'}</td>
                  </tr>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ใบสั่ง :</td>
                    <td className="px-4 py-2 text-gray-800">-</td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเสียหายรถประกันภัย :</td>
                    <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.damage_description || '-'}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-gray-500">ความเสียหายประมาณ :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{report.estimated_cost != null ? `${Number(report.estimated_cost).toLocaleString()} บาท` : '-'}</td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ===== กลุ่ม: รายละเอียดอุบัติเหตุ ===== */}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-1.5 h-8 bg-orange-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-orange-800">รายละเอียดอุบัติเหตุ</h2>
            <div className="flex-1 h-px bg-orange-200"></div>
          </div>

          {/* รายละเอียดอุบัติเหตุ */}
          {(
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">รายละเอียดอุบัติเหตุ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoItem label="วันที่เกิดเหตุ" value={report.acc_date} />
                <InfoItem label="เวลา" value={report.acc_time} />
                <InfoItem label="สถานที่เกิดเหตุ" value={report.acc_place} />
                <InfoItem label="จังหวัด" value={report.acc_province} />
                <InfoItem label="เขต/อำเภอ" value={report.acc_district} />
                <InfoItem label="ลักษณะการเกิดเหตุ" value={report.acc_cause} />
                <InfoItem label="ลักษณะความเสียหาย" value={report.acc_damage_type} />
                <InfoItem label="ฝ่ายประมาท" value={report.acc_fault} />
              </div>
              {report.acc_detail && (
                <div className="mt-4">
                  <span className="text-sm text-gray-500">รายละเอียดการเกิดเหตุ</span>
                  <p className="font-medium text-gray-800 whitespace-pre-wrap mt-1 bg-gray-50 p-3 rounded">{report.acc_detail}</p>
                </div>
              )}
            </div>
          )}

          {/* ข้อมูลการสำรวจ */}
          {(
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">ข้อมูลการสำรวจ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoItem label="ผู้แจ้ง" value={report.acc_reporter} />
                <InfoItem label="ผู้สำรวจภัย" value={report.acc_surveyor} />
                <InfoItem label="สาขา" value={report.acc_surveyor_branch} />
                <InfoItem label="โทรศัพท์สำรวจ" value={report.acc_surveyor_phone} />
                <InfoItem label="วันที่ลูกค้าแจ้ง บ.ประกัน" value={report.acc_customer_report_date} />
                <InfoItem label="วันที่ บ.ประกันแจ้งสำรวจภัย" value={report.acc_insurance_notify_date} />
                <InfoItem label="วันที่ถึงที่เกิดเหตุ" value={report.acc_survey_arrive_date} />
                <InfoItem label="วันที่สำรวจเสร็จ" value={report.acc_survey_complete_date} />
              </div>
            </div>
          )}

          {/* คู่กรณี & ตำรวจ */}
          {(
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">คู่กรณี & ตำรวจ</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoItem label="การเรียกร้องค่าเสียหายจากคู่กรณี" value={report.acc_claim_opponent} />
                <InfoItem label="รับเงินจำนวน" value={report.acc_claim_amount != null ? formatCurrency(report.acc_claim_amount) : null} />
                <InfoItem label="จากจำนวนเรียกร้องทั้งหมด" value={report.acc_claim_total_amount != null ? formatCurrency(report.acc_claim_total_amount) : null} />
                <InfoItem label="ชื่อพนักงานสอบสวน" value={report.acc_police_name} />
                <InfoItem label="สถานีตำรวจ" value={report.acc_police_station} />
                <InfoItem label="วันที่ (ตำรวจ)" value={report.acc_police_date} />
                <InfoItem label="ประจำวันข้อที่" value={report.acc_police_book_no} />
                <InfoItem label="ผลการตรวจแอลกอฮอล์" value={report.acc_alcohol_test} />
              </div>
              {report.acc_police_comment && (
                <div className="mt-4"><span className="text-sm text-gray-500">ความเห็นพนักงานสอบสวน</span><p className="font-medium text-gray-800 mt-1">{report.acc_police_comment}</p></div>
              )}
            </div>
          )}

          {/* การติดตามงาน */}
          {(
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">การติดตามงาน</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoItem label="สถานะ" value={report.acc_followup} />
                <InfoItem label="ครั้งที่นัดหมาย" value={report.acc_followup_count} />
                <InfoItem label="วันที่นัดหมาย" value={report.acc_followup_date} />
                <InfoItem label="รายละเอียดการนัดหมาย" value={report.acc_followup_detail} />
              </div>
            </div>
          )}

          {/* หมายเหตุ */}
          {(
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">หมายเหตุ</h3>
              <p className="font-medium text-gray-800 whitespace-pre-wrap">{report.notes}</p>
            </div>
          )}
        </>
      )}

      {/* รูปภาพ */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">รูปภาพ</h3>
        <PhotoGallery photos={photos} />
      </div>

      {/* การตรวจสอบ */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">การตรวจสอบ</h3>
        {review ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">ตรวจสอบแล้ว</span>
            {review.comment && <div className="mt-3"><span className="text-sm text-gray-500">ความคิดเห็น</span><p className="text-gray-800 mt-1">{review.comment}</p></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div><span className="text-sm text-gray-500">เสนอค่าบริการ</span><p className="font-medium text-gray-800">{formatCurrency(review.proposed_fee)}</p></div>
              <div><span className="text-sm text-gray-500">อนุมัติค่าบริการ</span><p className="font-medium text-gray-800">{formatCurrency(review.approved_fee)}</p></div>
            </div>
            {review.reviewed_at && <div className="mt-3 text-sm text-gray-400">ตรวจสอบเมื่อ {formatDate(review.reviewed_at)}</div>}
          </div>
        ) : (
          <ReviewForm caseId={caseData.id} onReviewSubmitted={onReviewSubmitted} />
        )}
      </div>
    </div>
  );
}
