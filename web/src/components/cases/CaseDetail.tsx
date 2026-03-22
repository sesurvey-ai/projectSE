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

const ColGroup = () => (
  <colgroup>
    <col style={{ width: '16%' }} />
    <col style={{ width: '34%' }} />
    <col style={{ width: '16%' }} />
    <col style={{ width: '34%' }} />
  </colgroup>
);

export default function CaseDetail({ caseData, report, photos, review, onReviewSubmitted }: CaseDetailProps) {
  return (
    <div className="space-y-6">
      {report && (
        <>
          {/* รายละเอียดรถยนต์ — header + ข้อมูลบริษัท/เคลม (แบบตาราง) */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar with claim type & damage level */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-bold">::: รายละเอียดรถยนต์</span>
              <span className="ml-auto font-bold">ประเภทเคลม :</span>
              <span className="text-red-400">*</span>
              {['F','D','A','C'].map(v => (
                <label key={v} className="flex items-center gap-1 cursor-default">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 border-white inline-flex items-center justify-center ${report.claim_type === v ? 'bg-white' : ''}`}>
                    {report.claim_type === v && <span className="w-1.5 h-1.5 rounded-full bg-blue-700"></span>}
                  </span>
                  <span>{CLAIM_TYPE_LABELS[v]}</span>
                </label>
              ))}
              <span className="font-bold ml-4">รถเสียหาย :</span>
              {['หนัก','เบา'].map(v => (
                <label key={v} className="flex items-center gap-1 cursor-default">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 border-white inline-flex items-center justify-center ${report.damage_level === v ? 'bg-white' : ''}`}>
                    {report.damage_level === v && <span className="w-1.5 h-1.5 rounded-full bg-blue-700"></span>}
                  </span>
                  <span>{v}</span>
                </label>
              ))}
              <label className="flex items-center gap-1 ml-2 cursor-default">
                <span className={`w-3.5 h-3.5 rounded border border-white inline-flex items-center justify-center ${report.car_lost ? 'bg-white' : ''}`}>
                  {report.car_lost && <span className="text-blue-700 text-xs font-bold">✓</span>}
                </span>
                <span>รถหาย</span>
              </label>
            </div>
            {/* Table rows */}
            <table className="w-full text-sm table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">บริษัทผู้จัดเรื่อง :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.survey_company || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
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
                  <td className="px-4 py-2 overflow-hidden">
                    <div className="flex items-center gap-1">
                      <select disabled value={report.insurance_company || '0'} className="min-w-0 flex-1 border border-gray-300 rounded px-2 py-1 text-gray-800 bg-gray-100 text-sm">
                        <option value="0">-- ระบุ --</option>
                        <option value="ประกันภัยทดสอบ">ประกันภัยทดสอบ</option>
                        <option value="บริษัท เดอะ วัน ประกันภัย จำกัด (มหาชน)">บริษัท เดอะ วัน ประกันภัย จำกัด (มหาชน)</option>
                        <option value="ไอโออิกรุงเทพประกันภัย">ไอโออิกรุงเทพประกันภัย</option>
                        <option value="ฟอลคอนประกันภัย จำกัด (มหาชน)">ฟอลคอนประกันภัย จำกัด (มหาชน)</option>
                        <option value="บริษัท อลิอันซ์ อยุธยา ประกันภัย จำกัด (มหาชน)">บริษัท อลิอันซ์ อยุธยา ประกันภัย จำกัด (มหาชน)</option>
                        <option value="บริษัท เจมาร์ท ประกันภัย จํากัด (มหาชน)">บริษัท เจมาร์ท ประกันภัย จํากัด (มหาชน)</option>
                        <option value="บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)">บริษัท ไทยไพบูลย์ประกันภัย จำกัด (มหาชน)</option>
                      </select>
                      <select disabled value={report.insurance_branch || 'กรุงเทพ'} className="w-[90px] shrink-0 border border-gray-300 rounded px-2 py-1 text-gray-800 bg-gray-100 text-sm">
                        <option value="0">-- ระบุ --</option>
                        <option value="กรุงเทพ">กรุงเทพ</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">เลขเรื่องเซอร์เวย์ :</td>
                  <td className="px-4 py-2">
                    <input type="text" disabled value={report.survey_job_no || ''} placeholder="SEABI-110260301037" className="w-full border border-gray-300 rounded px-2 py-1 text-gray-800 bg-gray-100 text-sm" />
                  </td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">เลขที่รับแจ้ง :</td>
                  <td className="px-4 py-2 text-gray-800">{report.claim_ref_no || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">เลขที่เคลม :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.claim_no || '-'}</td>
                  <td className="px-4 py-2" colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* กรมธรรม์ — แบบตาราง */}
          {(
            <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
              <table className="w-full table-fixed">
                <ColGroup />
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500">กรมธรรม์(พรบ.) :</td>
                    <td className="px-4 py-2 text-gray-800">{report.prb_number || '-'}</td>
                    <td className="px-4 py-2 text-gray-500">กรมธรรม์เลขที่ :</td>
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
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">หมายเลขทะเบียน :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.license_plate || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">จังหวัด :</td>
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
              <table className="w-full table-fixed">
                <ColGroup />
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ผู้ขับขี่รถประกันภัย :</td>
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {report.driver_gender && <span className="text-gray-500 mr-2">{report.driver_gender === 'M' ? '● ชาย' : report.driver_gender === 'F' ? '● หญิง' : ''}</span>}
                      {report.driver_name || '-'}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความสัมพันธ์กับเจ้าของรถ :</td>
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

          {/* ===== รายละเอียดอุบัติเหตุ — แบบตาราง ===== */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            {/* Header bar */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 text-white px-4 py-2">
              <span className="font-bold">::: รายละเอียดอุบัติเหตุ</span>
            </div>
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่เกิดเหตุและเวลาประมาณ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_date || '-'} {report.acc_time && <span className="ml-2">{report.acc_time} น.</span>}</td>
                  <td className="px-4 py-2" colSpan={2}></td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">สถานที่เกิดเหตุ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_place || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">จังหวัด/เขต :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_province || '-'} {report.acc_district && report.acc_district}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ลักษณะการเกิดเหตุ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_cause || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ลักษณะความเสียหาย :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_damage_type || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 align-top">รายละเอียดการเกิดเหตุ :</td>
                  <td className="px-4 py-2 text-gray-800 whitespace-pre-wrap" colSpan={3}>{report.acc_detail || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">ฝ่ายประมาท :</td>
                  <td className="px-4 py-2 font-medium text-gray-800" colSpan={3}>{report.acc_fault || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">ผู้แจ้ง :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_reporter || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ผู้สำรวจภัย :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.acc_surveyor || '-'} {report.acc_surveyor_branch && <span className="text-gray-500 ml-1">{report.acc_surveyor_branch}</span>} {report.acc_surveyor_phone && <span className="text-gray-500 ml-1">โทร: {report.acc_surveyor_phone}</span>}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่ลูกค้าแจ้ง บ.ประกัน :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_customer_report_date || '-'}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่ บ.ประกันแจ้งสำรวจภัย :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_insurance_notify_date || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">วันที่สำรวจภัย(ถึงที่เกิดเหตุ) :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_survey_arrive_date || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">วันที่สำรวจภัยเสร็จ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_survey_complete_date || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* คู่กรณี + ตำรวจ + ติดตามงาน — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">การเรียกร้องค่าเสียหายจากคู่กรณี :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <label className="flex items-center gap-1"><input type="checkbox" disabled checked={report.acc_claim_opponent?.includes('คัดประจำวัน')} className="w-3.5 h-3.5" /> คัดประจำวัน</label>
                      <label className="flex items-center gap-1"><input type="checkbox" disabled checked={report.acc_claim_opponent?.includes('รับหลักฐานจากคู่')} className="w-3.5 h-3.5" /> รับหลักฐานจากคู่กรณีผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" disabled checked={report.acc_claim_opponent?.includes('บันทึกยอมรับ')} className="w-3.5 h-3.5" /> บันทึกยอมรับผิด</label>
                      <label className="flex items-center gap-1"><input type="checkbox" disabled checked={report.acc_claim_opponent?.includes('บัตรติดต่อ')} className="w-3.5 h-3.5" /> บัตรติดต่อ</label>
                      <label className="flex items-center gap-1"><input type="checkbox" disabled checked={report.acc_claim_opponent?.includes('รับเงิน')} className="w-3.5 h-3.5" /> รับเงินจำนวน</label>
                      <span className="ml-2 font-medium">{report.acc_claim_amount != null ? `${Number(report.acc_claim_amount).toLocaleString()} บาท` : '0.00 บาท'}</span>
                      <span className="ml-2 text-gray-500">จากจำนวนเงินเรียกร้องทั้งหมด :</span>
                      <span className="font-medium">{report.acc_claim_total_amount != null ? `${Number(report.acc_claim_total_amount).toLocaleString()} บาท` : '-'}</span>
                      <span className="ml-2 text-gray-500">การเก็บเป็น :</span>
                      <span>-</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* พนักงานสอบสวน + แอลกอฮอล์ — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ชื่อพนักงานสอบสวน :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_police_name || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">สถานีตำรวจ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_police_station || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ความเห็นพนักงานสอบสวน :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.acc_police_comment || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_police_date || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ประจำวันข้อที่ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_police_book_no || '-'}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">ผลการตรวจแอลกอฮอล์ :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_alcohol_test || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ระบุผล :</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{report.acc_alcohol_result || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* การติดตามงาน — แบบตาราง */}
          <div className="bg-white rounded-lg shadow overflow-hidden text-sm">
            <table className="w-full table-fixed">
              <ColGroup />
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">การติดตามงาน :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_followup || '-'}</td>
                  <td className="px-4 py-2 text-gray-500">ครั้งที่นัดหมาย :</td>
                  <td className="px-4 py-2 text-gray-800">{report.acc_followup_count || '-'}</td>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">รายละเอียดการนัดหมาย :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.acc_followup_detail || '-'}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-gray-500">วันที่ :</td>
                  <td className="px-4 py-2 text-gray-800" colSpan={3}>{report.acc_followup_date || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

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
