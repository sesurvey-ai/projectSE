'use client';

import { useRef, useState } from 'react';
import api, { getPhotoUrl } from '@/lib/api';

interface Photo { id: number; file_path?: string; filename?: string; category?: string | null; }

/** หมวดรูป — ต้องตรงกับ CATS ฝั่ง backend (case.controller.addPhotos) และหมวดที่บอทรู้จัก */
const UPLOAD_CATS = [
  'รูปรถประกัน', 'รูปรถคู่กรณี', 'รูปผู้บาดเจ็บ', 'รูปทรัพย์สิน',
  'รูปแผนที่เกิดเหตุ', 'รูปประกอบ',
];

/**
 * แถบเพิ่มรูปของผู้ตรวจสอบ
 *
 * จำเป็นเพราะรูปมาไม่ครบตั้งแต่ต้นทางบ่อย: งานที่ดึงจากระบบเก่าตอนยัง "รอตรวจข้อมูล"
 * มักมีรูป 1-5 ใบ (ช่างทยอยอัปทีหลัง) และบางรูปหัวหน้าได้มาทาง LINE/อีเมล
 * ซึ่งไม่มีวันไปโผล่ที่ระบบต้นทางให้ดึงได้เลย
 */
function PhotoUploader({ caseId, onUploaded }: { caseId: number; onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState(UPLOAD_CATS[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!files.length) return;
    setBusy(true); setMsg('');
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('photos', f));
      fd.append('category', cat);
      const res = await api.post(`/api/cases/${caseId}/photos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000,
      });
      setMsg(`เพิ่มแล้ว ${res.data?.data?.added ?? files.length} รูป`);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded?.();
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      // 423 = อนุมัติไปแล้ว (ชุดรูปถูกรับรองแล้ว) — บอกให้ชัดว่าต้องให้แอดมินปลดล็อกก่อน
      setMsg(err.response?.status === 423
        ? 'เคสนี้อนุมัติแล้ว — เพิ่มรูปไม่ได้จนกว่าแอดมินจะปลดล็อก'
        : (err.response?.data?.message || 'อัปโหลดไม่สำเร็จ'));
    } finally { setBusy(false); }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-sm font-medium text-gray-700">เพิ่มรูป :</span>
      <select value={cat} onChange={(e) => setCat(e.target.value)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800">
        {UPLOAD_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple
        onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); setMsg(''); }}
        className="text-sm text-gray-700" />
      <button type="button" onClick={submit} disabled={busy || !files.length}
        className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300">
        {busy ? 'กำลังอัปโหลด...' : `อัปโหลด${files.length ? ` ${files.length} รูป` : ''}`}
      </button>
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
    </div>
  );
}

export default function PhotoGallery(
  { photos, caseId, onUploaded }: { photos: Photo[]; caseId?: number; onUploaded?: () => void },
) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [zoom, setZoom] = useState(1);

  // แถบเพิ่มรูปต้องอยู่**นอก** early-return ของ "ไม่มีรูปภาพ" — เคสที่ต้นทางยังไม่ส่งรูปมาเลย
  // คือเคสที่ต้องเพิ่มรูปมากที่สุด แต่เดิมจะไม่เห็นปุ่มเพราะจอว่าง
  if (!photos || photos.length === 0) {
    return (
      <div>
        {caseId ? <PhotoUploader caseId={caseId} onUploaded={onUploaded} /> : null}
        <div className="text-gray-500 text-center py-8">ไม่มีรูปภาพ</div>
      </div>
    );
  }

  const getSrc = (p: Photo) => getPhotoUrl(p.file_path || p.filename || '');
  const catLabel = (c?: string | null) => (c && c.trim()) ? c.trim() : 'ไม่ระบุหมวด';

  // จัดกลุ่มตามหมวด (ภาษาไทย) เรียงตามลำดับที่พบ — checker ดูรูปเป็นหมวดๆ ได้
  const groups: { category: string; items: Photo[] }[] = [];
  for (const p of photos) {
    const c = catLabel(p.category);
    const g = groups.find((x) => x.category === c);
    if (g) g.items.push(p); else groups.push({ category: c, items: [p] });
  }

  return (
    <>
      {caseId ? <PhotoUploader caseId={caseId} onUploaded={onUploaded} /> : null}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.category}>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              {g.category} <span className="text-gray-400 font-normal">({g.items.length})</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3">
              {g.items.map((p) => (
                <div key={p.id} className="cursor-pointer rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow shrink-0 w-[calc(20%-13px)]" onClick={() => setSelected(p)}>
                  <img src={getSrc(p)} alt={catLabel(p.category)} className="w-full h-48 object-cover" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selected && (() => {
        const idx = photos.findIndex(p => p.id === selected.id);
        const hasPrev = idx > 0;
        const hasNext = idx < photos.length - 1;
        return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col" onClick={() => { setSelected(null); setZoom(1); }}>
          {/* Zoom controls */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold">−</button>
            <div className="flex flex-col items-center">
              <span className="text-white text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
              {zoom !== 1 && <button onClick={() => setZoom(1)} className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded px-2 py-0.5 text-xs mt-1">รีเซ็ต</button>}
            </div>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold">+</button>
          </div>
          {/* Main image area */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-auto">
            {hasPrev && (
              <button onClick={(e) => { e.stopPropagation(); setSelected(photos[idx - 1]); setZoom(1); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-5xl font-bold hover:text-gray-300 z-10 bg-black bg-opacity-40 rounded-full w-12 h-12 flex items-center justify-center">&lsaquo;</button>
            )}
            <div className="relative max-w-4xl w-full px-16" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setSelected(null); setZoom(1); }} className="absolute -top-10 right-16 text-white text-3xl font-bold hover:text-gray-300">&times;</button>
              <img src={getSrc(selected)} alt={`รูปภาพ ${selected.id}`} className="w-full h-auto max-h-[65vh] object-contain rounded-lg transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
              <div className="text-center text-white text-sm mt-2">
                <span className="font-semibold">{catLabel(selected.category)}</span> · {idx + 1} / {photos.length}
              </div>
            </div>
            {hasNext && (
              <button onClick={(e) => { e.stopPropagation(); setSelected(photos[idx + 1]); setZoom(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-5xl font-bold hover:text-gray-300 z-10 bg-black bg-opacity-40 rounded-full w-12 h-12 flex items-center justify-center">&rsaquo;</button>
            )}
          </div>
          {/* Thumbnail strip */}
          <div className="shrink-0 py-3 px-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
              {photos.map((p, i) => (
                <div key={p.id} onClick={() => setSelected(p)} className={`shrink-0 w-20 h-16 rounded cursor-pointer overflow-hidden border-2 transition-all ${i === idx ? 'border-white opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                  <img src={getSrc(p)} alt={`thumb ${p.id}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
