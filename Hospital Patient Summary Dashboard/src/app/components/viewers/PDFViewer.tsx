import React, { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, X } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function PDFViewer({ url, filename, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const loadPdf = async () => {
      setLoading(true);
      setError('');
      setBlobUrl(null);
      setNumPages(0);
      setPageNumber(1);

      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Could not load PDF');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#1E1E1E] flex flex-col"
        style={{ width: '90vw', height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2D2D2D] border-b border-[#404040]">
          <span className="text-white text-[14px] font-medium truncate max-w-xs">{filename}</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[13px] text-[#D1D5DB]">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-1 hover:bg-[#404040] rounded transition-colors">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-1 hover:bg-[#404040] rounded transition-colors">
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
            <div className="w-px h-5 bg-[#404040]" />
            <div className="flex items-center gap-2 text-[13px] text-[#D1D5DB]">
              <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="p-1 hover:bg-[#404040] rounded disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{pageNumber} / {numPages || '?'}</span>
              <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="p-1 hover:bg-[#404040] rounded disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="w-px h-5 bg-[#404040]" />
            <button onClick={onClose} className="p-1 hover:bg-[#404040] rounded text-[#D1D5DB] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Canvas */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-6">
          {loading && (
            <div className="h-full flex items-center justify-center text-[#D1D5DB] text-[13px] gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading PDF...
            </div>
          )}
          {error && (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <div className="text-[#F87171] text-[14px] font-medium mb-2">Failed to load PDF</div>
                <div className="text-[#9CA3AF] text-[12px]">{error}</div>
              </div>
            </div>
          )}
          {blobUrl && !error && (
            <Document
              file={blobUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              onLoadError={(err) => setError(err.message)}
              className="shadow-xl"
            >
              <Page pageNumber={pageNumber} scale={scale} />
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}
