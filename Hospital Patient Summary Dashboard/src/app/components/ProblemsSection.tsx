import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Problem {
  id: string;
  condition: string;
  icd10: string;
  status: 'Active' | 'Resolved' | 'Chronic';
  onsetDate: string;
  diagnosedBy: string;
}

interface ProblemsSectionProps {
  problems: Problem[];
  onRowClick: (problem: Problem) => void;
}

export function ProblemsSection({ problems, onRowClick }: ProblemsSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Problems and Conditions</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Condition</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">ICD-10 Code</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Status</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Onset Date</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Diagnosed By</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr
                  key={problem.id}
                  onClick={() => onRowClick(problem)}
                  className="border-b border-[#E5E7EB] hover:bg-[#F7F9FB] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-[14px] text-[#1F2937] font-medium">{problem.condition}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{problem.icd10}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-[12px] font-medium ${
                        problem.status === 'Active' || problem.status === 'Chronic'
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#6B7280] text-white'
                      }`}
                    >
                      {problem.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{problem.onsetDate}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{problem.diagnosedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
