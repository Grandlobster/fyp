import React, { useEffect, useState } from 'react';
import { Loader2, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function ImageViewer({ url, filename, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const loadImage = async () => {
      setLoading(true);
      setError('');
      setBlobUrl(null);
      setScale(1);
      setRotation(0);

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load image');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadImage();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1E1E1E] flex flex-col"
        style={{ width: '85vw', height: '85vh', maxWidth: '1100px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2D2D2D] border-b border-[#404040]">
          <span className="text-white text-[14px] font-medium truncate max-w-xs">{filename}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.2, s - 0.2))} className="p-1.5 hover:bg-[#404040] rounded text-[#D1D5DB] transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[13px] text-[#9CA3AF] w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(5, s + 0.2))} className="p-1.5 hover:bg-[#404040] rounded text-[#D1D5DB] transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-[#404040] rounded text-[#D1D5DB] transition-colors">
              <RotateCw className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-[#404040] mx-1" />
            <button onClick={onClose} className="p-1.5 hover:bg-[#404040] rounded text-[#D1D5DB] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#111] p-4">
          {loading && (
            <div className="text-[#D1D5DB] text-[13px] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading image...
            </div>
          )}
          {error && (
            <div className="text-center">
              <div className="text-[#F87171] text-[14px] font-medium mb-2">Failed to load image</div>
              <div className="text-[#9CA3AF] text-[12px]">{error}</div>
            </div>
          )}
          {blobUrl && !error && (
            <img
              src={blobUrl}
              alt={filename}
              style={{ transform: `scale(${scale}) rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
              className="max-w-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
