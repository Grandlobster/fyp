import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

interface VitalReading {
  timestamp: string;
  value: number;
}

interface Vital {
  name: string;
  current: string;
  unit: string;
  status: 'Normal' | 'High' | 'Low' | 'Critical';
  data: VitalReading[];
}

interface VitalsSectionProps {
  vitals: Vital[];
}

export function VitalsSection({ vitals }: VitalsSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Critical': return '#DC2626';
      case 'High': return '#D97706';
      case 'Low': return '#D97706';
      default: return '#16A34A';
    }
  };

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Vital Signs</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {vitals.map((vital, index) => (
              <div key={index} className="border border-[#E5E7EB] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[12px] text-[#6B7280]">{vital.name}</div>
                    <div className="text-[20px] font-semibold text-[#1F2937]">
                      {vital.current} <span className="text-[14px] font-normal text-[#6B7280]">{vital.unit}</span>
                    </div>
                  </div>
                  <span
                    className="text-[12px] font-medium px-2 py-1"
                    style={{ 
                      color: getStatusColor(vital.status),
                      backgroundColor: getStatusColor(vital.status) + '20'
                    }}
                  >
                    {vital.status}
                  </span>
                </div>
                <div className="h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vital.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={getStatusColor(vital.status)} 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
