import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface DICOMViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function DICOMViewer({ url, filename, onClose }: DICOMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<unknown>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const initDwv = async () => {
      try {
        setStatus('loading');
        setErrorMsg('');

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);

        const dwvModule = await import('dwv');
        const dwv = dwvModule.default || dwvModule;

        if (!containerRef.current || cancelled) return;

        const app = new (dwv as { App: new () => unknown }).App();
        appRef.current = app;

        (app as { init: (config: unknown) => void }).init({
          dataViewConfigs: { '*': [{ divId: 'dwv-container' }] },
        });

        (app as { addEventListener: (event: string, fn: () => void) => void }).addEventListener('load', () => {
          if (!cancelled) setStatus('loaded');
        });

        (app as { loadURLs: (urls: string[]) => void }).loadURLs([objectUrl]);
      } catch (e) {
        if (!cancelled && !controller.signal.aborted) {
          setErrorMsg(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      }
    };

    initDwv();

    return () => {
      cancelled = true;
      controller.abort();
      if (appRef.current) {
        try {
          (appRef.current as { abort?: () => void }).abort?.();
        } catch {
          // ignore
        }
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#0D0D0D] flex flex-col"
        style={{ width: '90vw', height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border-b border-[#2D2D2D]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#2563EB] rounded-full" />
            <span className="text-white text-[14px] font-medium">DICOM Viewer</span>
            <span className="text-[#6B7280] text-[13px] truncate max-w-xs">— {filename}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onClose} className="p-1.5 hover:bg-[#333] rounded text-[#9CA3AF] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DWV Container */}
        <div className="flex-1 relative overflow-hidden">
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D] z-10">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <div className="text-[#6B7280] text-[13px]">Loading DICOM file...</div>
              </div>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0D0D0D] z-10">
              <div className="text-center max-w-sm px-6">
                <div className="text-[#DC2626] text-[14px] font-medium mb-2">Failed to load DICOM</div>
                <div className="text-[#6B7280] text-[12px]">{errorMsg || 'Could not parse the DICOM file.'}</div>
              </div>
            </div>
          )}
          <div id="dwv-container" ref={containerRef} className="w-full h-full" />
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 bg-[#1A1A1A] border-t border-[#2D2D2D] flex items-center gap-4 text-[12px] text-[#6B7280]">
          <span>DWV DICOM Web Viewer</span>
          <span>·</span>
          <span className={status === 'loaded' ? 'text-[#16A34A]' : status === 'error' ? 'text-[#DC2626]' : 'text-[#6B7280]'}>
            {status === 'loading' ? 'Loading...' : status === 'loaded' ? 'Loaded' : 'Error'}
          </span>
        </div>
      </div>
    </div>
  );
}
