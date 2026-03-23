'use client';

import { useState } from 'react';
import { getPhotoUrl } from '@/lib/api';

interface Photo { id: number; file_path?: string; filename?: string; }

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const [zoom, setZoom] = useState(1);

  if (!photos || photos.length === 0) return <div className="text-gray-500 text-center py-8">ไม่มีรูปภาพ</div>;

  const getSrc = (p: Photo) => getPhotoUrl(p.file_path || p.filename || '');

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {photos.map((p) => (
          <div key={p.id} className="cursor-pointer rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow shrink-0 w-[calc(20%-13px)]" onClick={() => setSelected(p)}>
            <img src={getSrc(p)} alt={`รูปภาพ ${p.id}`} className="w-full h-48 object-cover" />
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
            <span className="text-white text-sm min-w-[50px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold">+</button>
            {zoom !== 1 && <button onClick={() => setZoom(1)} className="text-white bg-black bg-opacity-50 hover:bg-opacity-70 rounded px-2 py-1 text-xs ml-1">รีเซ็ต</button>}
          </div>
          {/* Main image area */}
          <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-auto">
            {hasPrev && (
              <button onClick={(e) => { e.stopPropagation(); setSelected(photos[idx - 1]); setZoom(1); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-5xl font-bold hover:text-gray-300 z-10 bg-black bg-opacity-40 rounded-full w-12 h-12 flex items-center justify-center">&lsaquo;</button>
            )}
            <div className="relative max-w-4xl w-full px-16" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setSelected(null); setZoom(1); }} className="absolute -top-10 right-16 text-white text-3xl font-bold hover:text-gray-300">&times;</button>
              <img src={getSrc(selected)} alt={`รูปภาพ ${selected.id}`} className="w-full h-auto max-h-[65vh] object-contain rounded-lg transition-transform duration-200" style={{ transform: `scale(${zoom})` }} />
              <div className="text-center text-white text-sm mt-2">{idx + 1} / {photos.length}</div>
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
