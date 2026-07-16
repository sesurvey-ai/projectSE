import api from './api';

// ดาวน์โหลด INSERT_SURV_REPORT_XML ของเคส — เอาไป import เข้าพอร์ทัลประกัน (EMCS)
// backend: GET /api/cases/:id/export-xml (อนุญาต surveyor/checker/admin/callcenter)
// throw เมื่อสร้างไม่สำเร็จ (เช่นเคสยังไม่มีข้อมูลรายงาน) — ผู้เรียกแสดงข้อความเอง
export async function downloadCaseXml(caseId: number, claimNo?: string | null): Promise<void> {
  const res = await api.get(`/api/cases/${caseId}/export-xml`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `survey_${claimNo || caseId}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
