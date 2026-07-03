import React, { useState, useEffect, useRef } from 'react';
import { Mail, ShieldCheck, Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface PatientData {
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface OTPVerificationProps {
  abhaAddress: string;
  patientData: PatientData;
  onVerified: () => void;
}

export function OTPVerification({ abhaAddress, patientData, onVerified }: OTPVerificationProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const patientEmail = patientData?.email || '';
  const patientName = patientData?.name || abhaAddress;

  const sendOtp = async () => {
    if (!patientEmail) {
      setError('No email address found for this patient in the ABDM registry.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('http://localhost:3001/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }
      setSent(true);
      setCountdown(60);
      if (data.dev_otp) {
        setDevOtp(data.dev_otp);
      }
    } catch {
      setError('Cannot reach backend. Ensure server is running on port 3001.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    sendOtp();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleDigit = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:3001/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, otp: otpStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }
      onVerified();
    } catch {
      setError('Cannot reach backend. Ensure server is running on port 3001.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md">
        {/* Patient Info Banner */}
        <div className="bg-white border border-[#E5E7EB] px-5 py-4 mb-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
          </div>
          <div>
            <div className="text-[13px] text-[#6B7280]">Patient Identity Confirmation</div>
            <div className="text-[15px] font-semibold text-[#1F2937]">{patientName}</div>
            <div className="text-[12px] text-[#6B7280]">{abhaAddress}</div>
          </div>
        </div>

        {/* OTP Card */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm">
          <div className="px-8 py-6 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-5 h-5 text-[#2563EB]" />
              <h2 className="text-[17px] font-semibold text-[#1F2937]">OTP Verification</h2>
            </div>
            <p className="text-[13px] text-[#6B7280]">
              {patientEmail
                ? `A 6-digit code has been sent to ${patientEmail}`
                : 'No email on file — using dev mode'}
            </p>
          </div>

          <div className="px-8 py-6 space-y-6">
            {error && (
              <div className="flex items-start gap-2 bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-3 text-[13px] text-[#DC2626]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {devOtp && (
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FCD34D] px-4 py-3 text-[13px] text-[#92400E]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Dev Mode — Gmail not configured. OTP: <strong>{devOtp}</strong></span>
              </div>
            )}

            {/* OTP Digits */}
            <div>
              <label className="block text-[13px] font-medium text-[#374151] mb-3">Enter 6-digit OTP</label>
              <div className="flex gap-2" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className="w-12 h-12 text-center border border-[#D1D5DB] text-[18px] font-semibold text-[#1F2937] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-2.5 bg-[#2563EB] text-white text-[14px] font-medium hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Verify & Unlock Dashboard</>
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              {countdown > 0 ? (
                <span className="text-[13px] text-[#9CA3AF]">Resend in {countdown}s</span>
              ) : (
                <button
                  onClick={() => { setSent(false); sendOtp(); }}
                  disabled={sending}
                  className="text-[13px] text-[#2563EB] hover:underline flex items-center gap-1 mx-auto disabled:opacity-60"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[12px] text-[#9CA3AF]">
          OTP valid for 5 minutes · Quantum-Secured Delivery
        </div>
      </div>
    </div>
  );
}
