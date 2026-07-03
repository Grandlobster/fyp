import React from 'react';
import { AlertCircle } from 'lucide-react';

interface PatientHeaderProps {
  patient: {
    mrn: string;
    name: string;
    dob: string;
    age: number;
    gender: string;
    bloodType: string;
  };
  criticalAllergyCount?: number;
}

export function PatientHeader({ patient, criticalAllergyCount = 0 }: PatientHeaderProps) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-[13px] text-[#6B7280]">MRN</div>
            <div className="text-[16px] text-[#1F2937] font-semibold">{patient.mrn}</div>
          </div>
          <div className="h-10 w-px bg-[#E5E7EB]"></div>
          <div>
            <div className="text-[13px] text-[#6B7280]">Patient Name</div>
            <div className="text-[16px] text-[#1F2937] font-semibold">{patient.name}</div>
          </div>
          <div className="h-10 w-px bg-[#E5E7EB]"></div>
          <div>
            <div className="text-[13px] text-[#6B7280]">DOB / Age</div>
            <div className="text-[14px] text-[#1F2937]">{patient.dob} ({patient.age}y)</div>
          </div>
          <div className="h-10 w-px bg-[#E5E7EB]"></div>
          <div>
            <div className="text-[13px] text-[#6B7280]">Gender</div>
            <div className="text-[14px] text-[#1F2937]">{patient.gender}</div>
          </div>
          <div className="h-10 w-px bg-[#E5E7EB]"></div>
          <div>
            <div className="text-[13px] text-[#6B7280]">Blood Type</div>
            <div className="text-[14px] text-[#1F2937]">{patient.bloodType}</div>
          </div>
        </div>
        {criticalAllergyCount > 0 && (
          <div className="flex items-center gap-2 text-[#DC2626] bg-[#FEF2F2] px-3 py-2 border border-[#FCA5A5]">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[13px] font-medium">{criticalAllergyCount} Critical Allergies</span>
          </div>
        )}
      </div>
    </div>
  );
}
