import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Medication {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
  startDate: string;
  status: 'Active' | 'Discontinued' | 'On Hold';
  prescriber: string;
}

interface MedicationsSectionProps {
  medications: Medication[];
  onRowClick: (medication: Medication) => void;
}

export function MedicationsSection({ medications, onRowClick }: MedicationsSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Current Medications</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F7F9FB] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Medication</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Dose</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Route</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Frequency</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Start Date</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Status</th>
                <th className="text-left px-4 py-2 text-[12px] font-semibold text-[#6B7280]">Prescriber</th>
              </tr>
            </thead>
            <tbody>
              {medications.map((med) => (
                <tr
                  key={med.id}
                  onClick={() => onRowClick(med)}
                  className="border-b border-[#E5E7EB] hover:bg-[#F7F9FB] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-[14px] text-[#1F2937] font-medium">{med.name}</td>
                  <td className="px-4 py-3 text-[14px] text-[#1F2937]">{med.dose}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{med.route}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{med.frequency}</td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{med.startDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-[12px] font-medium ${
                        med.status === 'Active'
                          ? 'bg-[#16A34A] text-white'
                          : med.status === 'On Hold'
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#6B7280] text-white'
                      }`}
                    >
                      {med.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[14px] text-[#6B7280]">{med.prescriber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
