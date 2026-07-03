import React from 'react';
import {
  User,
  AlertTriangle,
  Pill,
  Activity,
  Syringe,
  Stethoscope,
  FileText,
  ClipboardList,
  Phone,
  FolderOpen,
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: 'demographics', label: 'Demographics', icon: User },
  { id: 'allergies', label: 'Allergies', icon: AlertTriangle },
  { id: 'medications', label: 'Medications', icon: Pill },
  { id: 'problems', label: 'Problems', icon: Activity },
  { id: 'procedures', label: 'Procedures', icon: Stethoscope },
  { id: 'immunizations', label: 'Immunizations', icon: Syringe },
  { id: 'vitals', label: 'Vitals', icon: Activity },
  { id: 'labs', label: 'Lab Results', icon: FileText },
  { id: 'careplan', label: 'Care Plan', icon: ClipboardList },
  { id: 'emergency', label: 'Emergency Info', icon: Phone },
  { id: 'records', label: 'Patient Files', icon: FolderOpen },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <div className="w-56 bg-white border-r border-[#E5E7EB] h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-[#E5E7EB]">
        <div className="text-[16px] font-semibold text-[#1F2937]">Patient Summary</div>
        <div className="text-[12px] text-[#6B7280] mt-1">ISO 27269 Compliant</div>
      </div>
      <nav className="py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors ${
                activeSection === item.id
                  ? 'bg-[#EFF6FF] text-[#2563EB] border-r-2 border-[#2563EB]'
                  : 'text-[#1F2937] hover:bg-[#F7F9FB]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
