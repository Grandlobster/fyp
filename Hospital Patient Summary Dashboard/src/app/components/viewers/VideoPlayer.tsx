import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function VideoPlayer({ url, filename, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const loadVideo = async () => {
      setLoading(true);
      setError('');
      setBlobUrl(null);

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load video');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadVideo();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-black flex flex-col"
        style={{ width: '85vw', maxWidth: '960px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A]">
          <span className="text-white text-[14px] font-medium truncate max-w-xs">{filename}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-[#333] rounded text-[#D1D5DB] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="min-h-[320px] bg-black flex items-center justify-center">
          {loading && (
            <div className="text-[#D1D5DB] text-[13px] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading video...
            </div>
          )}
          {error && (
            <div className="text-center px-6">
              <div className="text-[#F87171] text-[14px] font-medium mb-2">Failed to load video</div>
              <div className="text-[#9CA3AF] text-[12px]">{error}</div>
            </div>
          )}
          {blobUrl && !error && (
            <video
              ref={videoRef}
              src={blobUrl}
              controls
              autoPlay
              className="w-full"
              style={{ maxHeight: '75vh' }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      </div>
    </div>
  );
}
