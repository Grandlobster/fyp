import React, { useEffect, useState } from 'react';
import {
  FileText, Image, Video, Layers, Download, RefreshCw,
  Loader2, FolderOpen, Calendar, Hospital, ChevronRight, Eye
} from 'lucide-react';
import { PDFViewer } from './viewers/PDFViewer';
import { VideoPlayer } from './viewers/VideoPlayer';
import { ImageViewer } from './viewers/ImageViewer';
import { DICOMViewer } from './viewers/DICOMViewer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

interface CareContext {
  referenceNumber: string;
  display: string;
  hiType?: string;
  studyUID?: string;
  seriesUID?: string;
  modality?: string;
  hospitalId?: string;
  hospitalName?: string;
  pacsEndpoint?: string;
  kmeEndpoint?: string;
  qkdNodeId?: string;
  sha256Hash?: string;
}

interface PatientData {
  name?: string;
  careContexts?: CareContext[];
  hospital_id?: string;    // added: needed for gRPC request
  pacs_endpoint?: string;  // added: optional, forwarded as-is
  kme_endpoint?: string;   // added: optional, forwarded as-is
  qkd_node_id?: string;    // added: optional, forwarded as-is
  [key: string]: unknown;
}

interface MedicalFile {
  id: string;
  name: string;
  type: 'dicom' | 'pdf' | 'image' | 'video';
  size: string;
  date: string;
  referenceNumber: string;
  // url is now either:
  //   '' — not yet fetched (View button disabled)
  //   a /api/files/stream/:transferId URL — ready to open in viewer
  url: string;
  description?: string;
  // transfer state per-file
  transferStatus?: 'idle' | 'requesting' | 'ready' | 'error';
  transferError?: string;
  studyUID?: string;
  hospitalId?: string;
  pacsEndpoint?: string;
  kmeEndpoint?: string;
  qkdNodeId?: string;
}

type ViewerState =
  | { type: 'pdf'; file: MedicalFile }
  | { type: 'video'; file: MedicalFile }
  | { type: 'image'; file: MedicalFile }
  | { type: 'dicom'; file: MedicalFile }
  | null;

interface PatientFilesProps {
  abhaAddress: string;
  patientData: PatientData;
}

const FILE_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  dicom: Layers,
  pdf: FileText,
  image: Image,
  video: Video,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  dicom: 'DICOM Study',
  pdf: 'PDF Report',
  image: 'Medical Image',
  video: 'Operative Video',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  dicom: '#2563EB',
  pdf: '#DC2626',
  image: '#16A34A',
  video: '#7C3AED',
};

const FILE_TYPE_BG: Record<string, string> = {
  dicom: '#EFF6FF',
  pdf: '#FEF2F2',
  image: '#F0FDF4',
  video: '#F5F3FF',
};

function sanitizeFilenamePart(value: string) {
  return value.trim().replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '') || 'Medical_Record';
}

function mapCareContextToType(ctx: CareContext): MedicalFile['type'] {
  const modality = ctx.modality?.toUpperCase();
  const hiType = ctx.hiType?.toLowerCase();
  const display = ctx.display.toLowerCase();

  if (display.includes('video') || display.includes('recording')) return 'video';
  if (display.includes('pdf') || display.includes('summary') || hiType === 'documentreference') return 'pdf';
  if (display.includes('xray') || display.includes('x-ray') || display.includes('image')) return 'image';
  if (modality === 'CT' || modality === 'MR' || modality === 'DX' || modality === 'CR' || modality === 'US') return 'dicom';

  return 'dicom';
}

function extensionForType(type: MedicalFile['type']) {
  if (type === 'pdf') return 'pdf';
  if (type === 'video') return 'mp4';
  if (type === 'image') return 'jpg';
  return 'dcm';
}

function buildFilesFromCareContexts(careContexts: CareContext[] = []): MedicalFile[] {
  return careContexts.map((ctx, index) => {
    const type = mapCareContextToType(ctx);
    const name = `${sanitizeFilenamePart(ctx.display || ctx.referenceNumber)}.${extensionForType(type)}`;

    return {
      id: ctx.referenceNumber || String(index),
      name,
      type,
      size: '-',
      date: '-',
      referenceNumber: ctx.referenceNumber,
      url: '',
      description: ctx.hospitalName ? `${ctx.display} - ${ctx.hospitalName}` : ctx.display,
      transferStatus: 'idle' as const,
      studyUID: ctx.studyUID,
      hospitalId: ctx.hospitalId,
      pacsEndpoint: ctx.pacsEndpoint,
      kmeEndpoint: ctx.kmeEndpoint,
      qkdNodeId: ctx.qkdNodeId,
    };
  });
}

// Mock placeholder files.
// study_uid / pacs_endpoint / kme_endpoint / qkd_node_id come from the
// real ABDM CareContext payload in production. These match the gRPC proto
// field names exactly so handleFetchRecords can forward them without remapping.
const MOCK_FILES: MedicalFile[] = [
  {
    id: '1',
    name: 'CT_Chest_Axial_2024.dcm',
    type: 'dicom',
    size: '48.2 MB',
    date: '2024-11-15',
    referenceNumber: 'REF-2024-CT-001',
    url: '',
    description: 'Chest CT — Axial Series',
    transferStatus: 'idle',
  },
  {
    id: '2',
    name: 'Discharge_Summary_Nov2024.pdf',
    type: 'pdf',
    size: '1.4 MB',
    date: '2024-11-20',
    referenceNumber: 'REF-2024-DS-007',
    url: '',
    description: 'Discharge summary with clinical notes',
    transferStatus: 'idle',
  },
  {
    id: '3',
    name: 'Chest_Xray_PA_2024.jpg',
    type: 'image',
    size: '3.8 MB',
    date: '2024-10-30',
    referenceNumber: 'REF-2024-XR-012',
    url: '',
    description: 'PA chest X-ray — normal study',
    transferStatus: 'idle',
  },
  {
    id: '4',
    name: 'Laparoscopy_Recording_2024.mp4',
    type: 'video',
    size: '312 MB',
    date: '2024-09-14',
    referenceNumber: 'REF-2024-OR-003',
    url: '',
    description: 'Diagnostic laparoscopy — operative video',
    transferStatus: 'idle',
  },
];

// ---------------------------------------------------------------------------
// Helper: call POST /api/files/request for one file.
// Returns the stream URL to assign to file.url, or throws on failure.
// ---------------------------------------------------------------------------
async function requestTransfer(
  abhaAddress: string,
  file: MedicalFile,
  patientData: PatientData,
): Promise<string> {
  const body = {
    abha_address:           abhaAddress,
    care_context_reference: file.referenceNumber,
    study_uid:              file.studyUID || file.referenceNumber,
    hospital_id:            file.hospitalId || patientData.hospital_id || 'UNKNOWN',
    pacs_endpoint:          file.pacsEndpoint || patientData.pacs_endpoint || '',
    kme_endpoint:           file.kmeEndpoint || patientData.kme_endpoint || '',
    qkd_node_id:            file.qkdNodeId || patientData.qkd_node_id || '',
  };

  const res = await fetch(`${SERVER_BASE}/api/files/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail ? `: ${err.detail}` : '';
    throw new Error(`${err.error ?? `Server returned ${res.status}`}${detail}`);
  }

  const { transfer_id } = await res.json();
  // Return the stream URL — the viewer will hit this and get decrypted bytes
  return `${SERVER_BASE}/api/files/stream/${transfer_id}?filename=${encodeURIComponent(file.name)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function PatientFiles({ abhaAddress, patientData }: PatientFilesProps) {
  const [files, setFiles] = useState<MedicalFile[]>(() => buildFilesFromCareContexts(patientData?.careContexts || []));
  const [fetching, setFetching] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [viewer, setViewer] = useState<ViewerState>(null);

  const patientName = patientData?.name || abhaAddress;
  const careContexts = patientData?.careContexts;

  useEffect(() => {
    setFiles(buildFilesFromCareContexts(careContexts || []));
    setFetchDone(false);
    setFetchError('');
    setViewer(null);
  }, [careContexts]);

  // -------------------------------------------------------------------------
  // "Fetch Records" — requests a secure transfer session for every file in
  // parallel, then sets each file's url to its /api/files/stream/... URL.
  // The actual file bytes are NOT downloaded here — that happens lazily when
  // the user clicks View, because the stream URL is handed straight to the
  // existing viewer components which fetch it themselves.
  // -------------------------------------------------------------------------
  const handleFetchRecords = async () => {
    setFetching(true);
    setFetchError('');

    if (files.length === 0) {
      setFetchError('No ABDM care contexts were returned for this patient.');
      setFetchDone(true);
      setFetching(false);
      return;
    }

    // Mark all files as "requesting"
    setFiles(prev => prev.map(f => ({ ...f, transferStatus: 'requesting' as const })));

    const results = await Promise.allSettled(
      files.map(file => requestTransfer(abhaAddress, file, patientData))
    );

    setFiles(prev =>
      prev.map((file, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          return { ...file, url: result.value, transferStatus: 'ready' as const, transferError: undefined };
        } else {
          return {
            ...file,
            transferStatus: 'error' as const,
            transferError: result.reason?.message ?? 'Transfer failed',
          };
        }
      })
    );

    const anyError = results.some(r => r.status === 'rejected');
    if (anyError) {
      const firstError = results.find(r => r.status === 'rejected');
      const message = firstError?.status === 'rejected'
        ? firstError.reason?.message || 'Transfer failed'
        : 'Transfer failed';
      setFetchError(`Transfer failed: ${message}`);
    }
    setFetchDone(true);
    setFetching(false);
  };

  // -------------------------------------------------------------------------
  // "View" — opens the viewer. The url is already a /api/files/stream/...
  // endpoint; the viewer component fetches it directly (same as before —
  // the viewer just needs a URL, doesn't care where it comes from).
  // -------------------------------------------------------------------------
  const openFile = (file: MedicalFile) => {
    if (!file.url) return;
    setViewer({ type: file.type, file } as ViewerState);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white border border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h2 className="text-[15px] font-semibold text-[#1F2937]">Patient Medical Records</h2>
              <p className="text-[12px] text-[#6B7280]">{abhaAddress}</p>
            </div>
          </div>
          <button
            onClick={handleFetchRecords}
            disabled={fetching}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white text-[14px] font-medium hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
          >
            {fetching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Fetching Records...</>
            ) : (
              <><Download className="w-4 h-4" /> Fetch Records</>
            )}
          </button>
        </div>

        {fetchError && (
          <div className="mt-3 text-[12px] text-[#D97706] bg-[#FFFBEB] border border-[#FCD34D] px-3 py-2">
            {fetchError}
          </div>
        )}
        {fetchDone && !fetchError && (
          <div className="mt-3 text-[12px] text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2">
            Records fetched. Click View on any file to open it.
          </div>
        )}
      </div>

      {/* Care Contexts */}
      {(careContexts?.length || 0) > 0 && (
        <div className="bg-white border border-[#E5E7EB]">
          <div className="px-6 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
            <Hospital className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[13px] font-semibold text-[#374151]">Care Contexts</span>
            <span className="ml-auto text-[12px] text-[#9CA3AF]">{careContexts?.length || 0} records</span>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {careContexts?.map((ctx, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <div className="w-2 h-2 bg-[#2563EB] rounded-full flex-shrink-0" />
                <div>
                  <div className="text-[13px] text-[#1F2937]">{ctx.display}</div>
                  <div className="text-[11px] text-[#9CA3AF] font-mono">{ctx.referenceNumber}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#D1D5DB] ml-auto" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Grid */}
      <div className="bg-white border border-[#E5E7EB]">
        <div className="px-6 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#374151]">Available Files</span>
          <span className="text-[12px] text-[#9CA3AF]">{files.length} files from ABDM care contexts</span>
        </div>

        <div className="divide-y divide-[#F3F4F6]">
          {files.map((file) => {
            const Icon = FILE_TYPE_ICONS[file.type] || FileText;
            const color = FILE_TYPE_COLORS[file.type];
            const bg = FILE_TYPE_BG[file.type];
            const hasUrl = !!file.url;

            return (
              <div key={file.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors group">
                {/* Icon */}
                <div
                  className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                  style={{ background: bg }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-[#1F2937] truncate">{file.name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span
                      className="text-[11px] font-medium px-1.5 py-0.5"
                      style={{ color, background: bg }}
                    >
                      {FILE_TYPE_LABELS[file.type]}
                    </span>
                    {file.description && (
                      <span className="text-[12px] text-[#9CA3AF] truncate">{file.description}</span>
                    )}
                    {/* Per-file transfer status indicator */}
                    {file.transferStatus === 'requesting' && (
                      <span className="text-[11px] text-[#2563EB] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Securing transfer...
                      </span>
                    )}
                    {file.transferStatus === 'error' && (
                      <span className="text-[11px] text-[#DC2626] truncate max-w-[360px]" title={file.transferError}>
                        {file.transferError || 'Transfer failed'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <div className="text-[12px] text-[#6B7280] flex items-center gap-1 justify-end">
                    <Calendar className="w-3 h-3" />
                    {file.date}
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] mt-0.5">{file.size}</div>
                </div>

                {/* Reference */}
                <div className="text-[11px] text-[#9CA3AF] font-mono hidden lg:block flex-shrink-0 w-40 text-right truncate">
                  {file.referenceNumber}
                </div>

                {/* Open button */}
                <button
                  onClick={() => openFile(file)}
                  disabled={!hasUrl}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] text-[12px] text-[#6B7280] hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors opacity-0 group-hover:opacity-100"
                  title={hasUrl ? 'Open file' : 'File not yet fetched'}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>
              </div>
            );
          })}
        </div>

        {files.length === 0 && (
          <div className="py-12 text-center">
            <FolderOpen className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
            <div className="text-[14px] text-[#6B7280]">No files available</div>
            <div className="text-[12px] text-[#9CA3AF] mt-1">Click "Fetch Records" to retrieve patient files</div>
          </div>
        )}
      </div>

      {/* Viewers — unchanged, they just need a URL */}
      {viewer?.type === 'pdf' && (
        <PDFViewer url={viewer.file.url} filename={viewer.file.name} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === 'video' && (
        <VideoPlayer url={viewer.file.url} filename={viewer.file.name} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === 'image' && (
        <ImageViewer url={viewer.file.url} filename={viewer.file.name} onClose={() => setViewer(null)} />
      )}
      {viewer?.type === 'dicom' && (
        <DICOMViewer url={viewer.file.url} filename={viewer.file.name} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
