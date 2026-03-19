'use client';

import { useState } from 'react';
import { getPhotoUrl } from '@/lib/api';

interface Photo { id: number; file_path?: string; filename?: string; }

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<Photo | null>(null);

  if (!photos || photos.length === 0) return <div className="text-gray-500 text-center py-8">ไม่มีรูปภาพ</div>;

  const getSrc = (p: Photo) => getPhotoUrl(p.file_path || p.filename || '');

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((p) => (
          <div key={p.id} className="cursor-pointer rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
            <img src={getSrc(p)} alt={`รูปภาพ ${p.id}`} className="w-full h-48 object-cover" />
          </div>
        ))}
      </div>
      {selected && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} className="absolute -top-10 right-0 text-white text-3xl font-bold hover:text-gray-300">&times;</button>
            <img src={getSrc(selected)} alt={`รูปภาพ ${selected.id}`} className="w-full h-auto max-h-[85vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}
