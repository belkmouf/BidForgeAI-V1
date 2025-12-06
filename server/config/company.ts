export interface CompanyConfig {
  name: string;
  tagline: string;
  logoUrl: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  licenseNumber: string;
  federalTaxId?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultRep: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
  defaultTerms: string[];
  certifications: string[];
  insurance: {
    generalLiability: string;
    workersComp: string;
    bondingCapacity: string;
  };
}

export const companyConfig: CompanyConfig = {
  name: "Premier Construction Group",
  tagline: "Building Excellence Since 1998",
  logoUrl: "/images/company-logo.png",
  address: "1234 Industrial Parkway, Suite 500",
  city: "Springfield",
  state: "IL",
  zip: "62701",
  phone: "(555) 123-4567",
  email: "bids@premierconstructiongroup.com",
  website: "www.premierconstructiongroup.com",
  licenseNumber: "GC-123456",
  federalTaxId: "12-3456789",
  primaryColor: "#0d7377",
  secondaryColor: "#14b8a6",
  accentColor: "#b8995a",
  defaultRep: {
    name: "Michael Johnson",
    title: "Director of Business Development",
    email: "mjohnson@premierconstructiongroup.com",
    phone: "(555) 123-4567 ext. 101",
  },
  defaultTerms: [
    "This proposal is valid for 90 days from the date of submission.",
    "Payment terms: 10% deposit upon contract signing, progress payments billed monthly based on percentage of completion, 5% retention released upon final completion and approval.",
    "All work will be performed in accordance with applicable local, state, and federal building codes and regulations.",
    "Change orders require written approval from the client and will be billed at actual cost plus 15% for overhead and profit.",
    "Weather delays beyond 5 consecutive working days will extend the project completion date by the number of days lost.",
    "Final payment is due within 30 days of substantial completion and issuance of certificate of occupancy.",
    "All materials and workmanship are guaranteed against defects for a period of one year from the date of substantial completion.",
  ],
  certifications: [
    "Licensed General Contractor",
    "OSHA 30-Hour Certified",
    "ISO 9001:2015 Certified",
    "LEED Accredited Professional",
    "EPA Lead-Safe Certified",
  ],
  insurance: {
    generalLiability: "$5,000,000 aggregate / $2,000,000 per occurrence",
    workersComp: "Statutory limits for all employees",
    bondingCapacity: "$50,000,000 through XYZ Surety Company",
  },
};

export const defaultValuePropositions = [
  "Over 25 years of experience in commercial and industrial construction",
  "Perfect safety record with zero lost-time incidents in the past 5 years",
  "On-time completion rate of 98% across 500+ projects",
  "Local presence with intimate knowledge of area regulations and permitting",
  "In-house team of 150+ skilled professionals",
  "State-of-the-art project management software provides real-time progress tracking",
  "Financially stable with bonding capacity up to $50 million",
  "Strong relationships with local suppliers ensure competitive material pricing",
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function generateProposalNumber(sequentialNumber: number): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const seq = String(sequentialNumber).padStart(3, '0');
  return `${year}${month}${day}-${seq}`;
}

export function calculateValidityDate(daysValid: number = 90): Date {
  const today = new Date();
  today.setDate(today.getDate() + daysValid);
  return today;
}
