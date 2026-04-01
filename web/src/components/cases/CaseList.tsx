'use client';

import { useRouter } from 'next/navigation';

interface Case {
  id: number;
  customer_name: string;
  status: string;
  claim_no?: string;
  survey_job_no?: string;
  claim_ref_no?: string;
  surveyor_first_name?: string;
  surveyor_last_name?: string;
  visit_count?: number;
  created_at: string;
}
interface CaseListProps { cases: Case[]; basePath?: string; }

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    assigned: 'bg-orange-100 text-orange-700',
    surveyed: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = { pending: 'รอมอบหมาย', assigned: 'มอบหมายแล้ว', surveyed: 'สำรวจแล้ว', reviewed: 'ตรวจสอบแล้ว' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

export default function CaseList({ cases, basePath = '/inspector' }: CaseListProps) {
  const router = useRouter();
  if (cases.length === 0) return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">ไม่มีรายการงานในขณะนี้</div>;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขเคลม</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขเซอร์เวย์</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">เลขรับแจ้ง</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ช่างสำรวจ</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ครั้งที่</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cases.map((c) => (
            <tr key={c.id} onClick={() => router.push(`${basePath}/cases/${c.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-5 py-4">{getStatusBadge(c.status)}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.claim_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.survey_job_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">{c.claim_ref_no || '-'}</td>
              <td className="px-5 py-4 text-sm text-gray-700">
                {c.surveyor_first_name ? `${c.surveyor_first_name} ${c.surveyor_last_name || ''}` : '-'}
              </td>
              <td className="px-5 py-4 text-sm text-gray-500">{c.visit_count || 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
