import React, { useState, useEffect, useRef } from 'react';
import { Search, QrCode, ArrowRight, AlertCircle, Loader2, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

interface PatientData {
  name?: string;
  abhaAddress?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  careContexts?: Array<{ referenceNumber: string; display: string }>;
  [key: string]: unknown;
}

interface PatientSearchProps {
  doctorName: string;
  onPatientFound: (abhaAddress: string, patientData: PatientData) => void;
}

type SearchMode = 'manual' | 'qr';

export function PatientSearch({ doctorName, onPatientFound }: PatientSearchProps) {
  const [mode, setMode] = useState<SearchMode>('manual');
  const [abhaAddress, setAbhaAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrScanning, setQrScanning] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<unknown>(null);

  const fetchPatient = async (abha: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_BASE}/api/patient/${encodeURIComponent(abha)}?hipId=my-hip`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Patient not found');
        return;
      }
      onPatientFound(abha, data);
    } catch {
      setError('Cannot reach the ABDM Wrapper. Ensure it is running on port 8082 and the backend on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (abhaAddress.trim()) fetchPatient(abhaAddress.trim());
  };

  const startQrScanner = async () => {
    setQrScanning(true);
    setError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (qrRef.current) {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            const abha = decodedText.trim();
            stopQrScanner();
            setAbhaAddress(abha);
            fetchPatient(abha);
          },
          undefined
        );
      }
    } catch {
      setError('Could not start camera. Please allow camera access or use manual entry.');
      setQrScanning(false);
    }
  };

  const stopQrScanner = () => {
    if (scannerRef.current) {
      (scannerRef.current as { stop: () => Promise<void> }).stop().catch(() => null);
      scannerRef.current = null;
    }
    setQrScanning(false);
  };

  useEffect(() => {
    if (mode === 'qr') {
      startQrScanner();
    } else {
      stopQrScanner();
    }
    return () => stopQrScanner();
  }, [mode]);

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[13px] text-[#6B7280] mb-1">Welcome, Dr. {doctorName}</div>
          <h1 className="text-[22px] font-semibold text-[#1F2937]">Search for Patient</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Enter the ABHA address manually or scan the patient's QR code</p>
        </div>

        {/* Mode Toggle */}
        <div className="bg-white border border-[#E5E7EB] flex mb-4">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[14px] font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-[#EFF6FF] text-[#2563EB] border-b-2 border-[#2563EB]'
                : 'text-[#6B7280] hover:bg-[#F7F9FB]'
            }`}
          >
            <Search className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            onClick={() => setMode('qr')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[14px] font-medium transition-colors ${
              mode === 'qr'
                ? 'bg-[#EFF6FF] text-[#2563EB] border-b-2 border-[#2563EB]'
                : 'text-[#6B7280] hover:bg-[#F7F9FB]'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Scan QR Code
          </button>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm">
          {error && (
            <div className="mx-6 mt-5 flex items-start gap-2 bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-3 text-[13px] text-[#DC2626]">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="p-6">
              <label className="block text-[13px] font-medium text-[#374151] mb-1.5">
                ABHA Address
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={abhaAddress}
                  onChange={(e) => setAbhaAddress(e.target.value)}
                  placeholder="e.g. patient@abdm"
                  required
                  className="flex-1 px-3 py-2.5 border border-[#D1D5DB] bg-white text-[14px] text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="mt-3 text-[12px] text-[#9CA3AF]">
                Format: &lt;username&gt;@abdm or &lt;number&gt;@sbx
              </div>
            </form>
          )}

          {mode === 'qr' && (
            <div className="p-6">
              <div className="text-[13px] text-[#6B7280] mb-4 text-center">
                {qrScanning ? 'Point camera at the patient\'s QR code' : 'Starting camera...'}
              </div>
              <div className="relative bg-[#F7F9FB] border border-[#E5E7EB] overflow-hidden" style={{ minHeight: '300px' }}>
                <div id="qr-reader" ref={qrRef} className="w-full" />
                {!qrScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
                  </div>
                )}
              </div>
              {qrScanning && (
                <button
                  onClick={() => setMode('manual')}
                  className="mt-4 w-full py-2.5 border border-[#D1D5DB] text-[14px] text-[#6B7280] hover:bg-[#F7F9FB] flex items-center justify-center gap-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel Scan
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="px-6 pb-5 flex items-center gap-3 text-[13px] text-[#6B7280]">
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
              Looking up patient in ABDM registry...
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-[12px] text-[#9CA3AF]">
          Patient data fetched from ABDM Wrapper · GET /v3/patient/&#123;abhaAddress&#125;
        </div>
      </div>
    </div>
  );
}
