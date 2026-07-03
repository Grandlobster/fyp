import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LabResult {
  id: string;
  test: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'High' | 'Low' | 'Critical';
  date: string;
}

interface LabResultsSectionProps {
  results: LabResult[];
  onRowClick: (result: LabResult) => void;
}

export function LabResultsSection({ results, onRowClick }: LabResultsSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Laboratory Results</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Test</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Value</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Unit</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Reference Range</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Status</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Date</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.id}
                  onClick={() => onRowClick(result)}
                  className={`border-b border-[#E5E7EB] cursor-pointer transition-colors ${
                    result.status === 'Critical' ? 'bg-[#FEF2F2]' : ''
                  } hover:bg-[#F7F9FB]`}
                >
                  <td className="px-4 py-3 text-[14px] text-[#1F2937] font-medium">{result.test}</td>
                  <td className="px-4 py-3 text-[14px] text-[#1F2937] font-semibold">{result.value}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{result.unit}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{result.referenceRange}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-[12px] font-medium ${
                        result.status === 'Critical'
                          ? 'bg-[#DC2626] text-white'
                          : result.status === 'High' || result.status === 'Low'
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#16A34A] text-white'
                      }`}
                    >
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{result.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
