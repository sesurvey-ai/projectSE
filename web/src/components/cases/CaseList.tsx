'use client';

import { useRouter } from 'next/navigation';

interface Case { id: number; customer_name: string; incident_location?: string; location?: string; status: string; created_at: string; }
interface CaseListProps { cases: Case[]; basePath?: string; }

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-800',
    assigned: 'bg-blue-100 text-blue-800',
    surveyed: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-green-100 text-green-800',
  };
  const labels: Record<string, string> = { pending: 'รอดำเนินการ', assigned: 'มอบหมายแล้ว', surveyed: 'สำรวจแล้ว', reviewed: 'ตรวจสอบแล้ว' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CaseList({ cases, basePath = '/inspector' }: CaseListProps) {
  const router = useRouter();
  if (cases.length === 0) return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">ไม่มีรายการงานในขณะนี้</div>;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อลูกค้า</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานที่</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {cases.map((c) => (
            <tr key={c.id} onClick={() => router.push(`${basePath}/cases/${c.id}`)} className="hover:bg-gray-50 cursor-pointer transition-colors">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">#{c.id}</td>
              <td className="px-6 py-4 text-sm text-gray-700">{c.customer_name}</td>
              <td className="px-6 py-4 text-sm text-gray-700">{c.incident_location || c.location || '-'}</td>
              <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{formatDate(c.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
