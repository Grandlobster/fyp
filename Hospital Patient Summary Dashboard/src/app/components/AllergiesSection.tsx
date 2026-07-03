import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Allergy {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Critical' | 'High' | 'Moderate';
  onsetDate: string;
  verifiedBy: string;
}

interface AllergiesSectionProps {
  allergies: Allergy[];
  onRowClick: (allergy: Allergy) => void;
}

export function AllergiesSection({ allergies, onRowClick }: AllergiesSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Allergies and Adverse Reactions</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Substance</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Reaction</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Severity</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Onset Date</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Verified By</th>
              </tr>
            </thead>
            <tbody>
              {allergies.map((allergy) => (
                <tr
                  key={allergy.id}
                  onClick={() => onRowClick(allergy)}
                  className={`border-b border-[#E5E7EB] cursor-pointer transition-colors ${
                    allergy.severity === 'Critical' ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]' : 'hover:bg-[#F7F9FB]'
                  }`}
                >
                  <td className="px-4 py-3 text-[14px] text-[#1F2937] font-medium">{allergy.substance}</td>
                  <td className="px-4 py-3 text-[14px] text-[#1F2937]">{allergy.reaction}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-[12px] font-medium ${
                        allergy.severity === 'Critical'
                          ? 'bg-[#DC2626] text-white'
                          : allergy.severity === 'High'
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#6B7280] text-white'
                      }`}
                    >
                      {allergy.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{allergy.onsetDate}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{allergy.verifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
