import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Demographics {
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  maritalStatus: string;
  language: string;
  race: string;
  ethnicity: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
}

interface DemographicsSectionProps {
  demographics: Demographics;
}

export function DemographicsSection({ demographics }: DemographicsSectionProps) {
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="border border-[#E5E7EB] bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F7F9FB] transition-colors"
      >
        <h2 className="text-[16px] font-semibold text-[#1F2937]">Patient Demographics</h2>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="p-4">
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Address</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.address}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">City</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.city}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">State / ZIP</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.state} {demographics.zip}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Phone</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.phone}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Email</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.email}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Marital Status</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.maritalStatus}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Language</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.language}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Race</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.race}</div>
            </div>
            <div>
              <div className="text-[12px] text-[#6B7280] mb-1">Ethnicity</div>
              <div className="text-[14px] text-[#1F2937]">{demographics.ethnicity}</div>
            </div>
          </div>
          <div className="border-t border-[#E5E7EB] mt-4 pt-4">
            <div className="text-[13px] font-semibold text-[#1F2937] mb-3">Emergency Contact</div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <div className="text-[12px] text-[#6B7280] mb-1">Name</div>
                <div className="text-[14px] text-[#1F2937]">{demographics.emergencyContact.name}</div>
              </div>
              <div>
                <div className="text-[12px] text-[#6B7280] mb-1">Relationship</div>
                <div className="text-[14px] text-[#1F2937]">{demographics.emergencyContact.relationship}</div>
              </div>
              <div>
                <div className="text-[12px] text-[#6B7280] mb-1">Phone</div>
                <div className="text-[14px] text-[#1F2937]">{demographics.emergencyContact.phone}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
