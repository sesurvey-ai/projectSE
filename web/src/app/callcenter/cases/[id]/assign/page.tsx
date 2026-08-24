'use client';

import { useParams } from 'next/navigation';
import AssignSurveyor from '@/components/cases/AssignSurveyor';

export default function AssignPage() {
  const params = useParams();
  const caseId = params.id as string;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">มอบหมายช่างสำรวจ</h1>
        <p className="text-gray-500 mt-1">เลือกช่างสำรวจสำหรับเคส #{caseId}</p>
      </div>

      <div className="flex items-center mb-8">
        <div className="flex items-center"><div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">&#10003;</div><span className="ml-2 text-sm font-medium text-green-600">ข้อมูลเคส</span></div>
        <div className="flex-1 mx-4 h-px bg-blue-600"></div>
        <div className="flex items-center"><div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div><span className="ml-2 text-sm font-medium text-blue-600">มอบหมายช่างสำรวจ</span></div>
      </div>

      <AssignSurveyor caseId={caseId} />
    </div>
  );
}
