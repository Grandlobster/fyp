import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Activity } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

interface LoginPageProps {
  onLogin: (doctor: { doctor_id: string; name: string; username: string; hospital_id: string }) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${SERVER_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      onLogin(data.doctor);
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Unknown network error';
      setError(`Cannot connect to server at ${SERVER_BASE}. Ensure the backend is running. (${detail})`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-10 h-10 bg-[#2563EB] flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-[20px] font-semibold text-[#1F2937]">QKD Medical Portal</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#6B7280]">
            <Shield className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>ISO 27269 Compliant · Quantum-Secured</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E7EB] shadow-sm">
          <div className="px-8 py-6 border-b border-[#E5E7EB]">
            <h1 className="text-[18px] font-semibold text-[#1F2937]">Doctor Sign In</h1>
            <p className="text-[13px] text-[#6B7280] mt-1">Enter your credentials to access the patient portal</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
            {error && (
              <div className="bg-[#FEF2F2] border border-[#FCA5A5] px-4 py-3 text-[13px] text-[#DC2626]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
                className="w-full px-3 py-2.5 border border-[#D1D5DB] bg-white text-[14px] text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#374151] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 border border-[#D1D5DB] bg-white text-[14px] text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#2563EB] text-white text-[14px] font-medium hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="px-8 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB]">
            <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
              <div className="w-1.5 h-1.5 bg-[#16A34A] rounded-full"></div>
              <span>Credentials verified against hospital directory</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-[12px] text-[#9CA3AF]">
          Authorized personnel only · All access is logged and monitored
        </div>
      </div>
    </div>
  );
}
