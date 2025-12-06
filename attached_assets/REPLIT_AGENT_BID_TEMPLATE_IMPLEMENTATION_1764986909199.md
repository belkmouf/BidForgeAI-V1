# 🤖 REPLIT AGENT: Bid Response Template Implementation Guide

**Complete step-by-step instructions to implement professional bid response templates with company branding**

**Target Project:** BidForgeAI  
**Estimated Time:** 2-3 hours  
**Complexity:** Intermediate

---

## 📋 OVERVIEW

This guide will help you implement a professional bid response template system that:
- ✅ Creates branded, professional bid proposals
- ✅ Integrates with existing AI generation
- ✅ Supports PDF export
- ✅ Is fully customizable
- ✅ Includes all required bid sections

---

## 🎯 EXECUTION ORDER

Execute these steps in exact order:

1. ✅ **STEP 1:** Create directory structure (5 min)
2. ✅ **STEP 2:** Create company configuration file (10 min)
3. ✅ **STEP 3:** Create HTML template file (30 min)
4. ✅ **STEP 4:** Create template generator module (30 min)
5. ✅ **STEP 5:** Integrate with existing routes (20 min)
6. ✅ **STEP 6:** Add PDF export capability (15 min)
7. ✅ **STEP 7:** Create frontend preview component (20 min)
8. ✅ **STEP 8:** Add template settings UI (optional - 30 min)
9. ✅ **STEP 9:** Testing and validation (20 min)

**Total Time:** ~2-3 hours

---

## 🔧 STEP 1: Create Directory Structure (5 MINUTES)

### Action Required

Create the following directories and placeholder files:

```bash
# Navigate to server directory
cd server

# Create directories
mkdir -p lib/templates
mkdir -p config

# Create placeholder files
touch lib/templates/bid-template-generator.ts
touch config/company.ts
touch templates/bid-response-template.html

# Navigate to client
cd ../client

# Create component directory
mkdir -p src/components/bid
touch src/components/bid/BidPreview.tsx
touch src/components/bid/PDFExport.tsx

# Return to project root
cd ..
```

### Validation

```bash
# Verify structure
ls -la server/lib/templates/
ls -la server/config/
ls -la server/templates/
ls -la client/src/components/bid/

# Expected: All directories and files exist
```

### Success Criteria
- ✅ All directories created
- ✅ All placeholder files created
- ✅ No errors in console

---

## 🔧 STEP 2: Create Company Configuration File (10 MINUTES)

### File to Create
`server/config/company.ts`

### Complete File Contents

```typescript
/**
 * Company Configuration for Bid Templates
 * 
 * INSTRUCTIONS:
 * 1. Update all fields with your company's information
 * 2. Replace placeholder values with real data
 * 3. Upload your logo to client/public/images/company-logo.png
 * 4. Customize colors to match your brand
 */

export interface CompanyConfig {
  // Basic Information
  name: string;
  tagline: string;
  logoUrl: string;
  
  // Contact Information
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  website: string;
  
  // Legal & Licensing
  licenseNumber: string;
  federalTaxId?: string;
  
  // Branding Colors (hex codes)
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  
  // Default Representative
  defaultRep: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
  
  // Default Terms & Conditions
  defaultTerms: string[];
  
  // Company Certifications
  certifications: string[];
  
  // Insurance Information
  insurance: {
    generalLiability: string;
    workersComp: string;
    bondingCapacity: string;
  };
}

/**
 * ⚠️ CUSTOMIZE THIS SECTION WITH YOUR COMPANY DETAILS
 */
export const companyConfig: CompanyConfig = {
  // ==================== BASIC INFORMATION ====================
  name: "Premier Construction Group",
  tagline: "Building Excellence Since 1998",
  logoUrl: "/images/company-logo.png",
  
  // ==================== CONTACT INFORMATION ====================
  address: "1234 Industrial Parkway, Suite 500",
  city: "Springfield",
  state: "IL",
  zip: "62701",
  phone: "(555) 123-4567",
  email: "bids@premierconstructiongroup.com",
  website: "www.premierconstructiongroup.com",
  
  // ==================== LEGAL & LICENSING ====================
  licenseNumber: "GC-123456",
  federalTaxId: "12-3456789",
  
  // ==================== BRANDING COLORS ====================
  primaryColor: "#1e3c72",     // Dark blue - main color
  secondaryColor: "#2a5298",   // Medium blue - accents
  accentColor: "#f39c12",      // Orange/gold - highlights
  
  // ==================== DEFAULT REPRESENTATIVE ====================
  defaultRep: {
    name: "Michael Johnson",
    title: "Director of Business Development",
    email: "mjohnson@premierconstructiongroup.com",
    phone: "(555) 123-4567 ext. 101",
  },
  
  // ==================== DEFAULT TERMS & CONDITIONS ====================
  defaultTerms: [
    "This proposal is valid for 90 days from the date of submission.",
    "Payment terms: 10% deposit upon contract signing, progress payments billed monthly based on percentage of completion, 5% retention released upon final completion and approval.",
    "All work will be performed in accordance with applicable local, state, and federal building codes and regulations.",
    "Change orders require written approval from the client and will be billed at actual cost plus 15% for overhead and profit.",
    "Weather delays beyond 5 consecutive working days will extend the project completion date by the number of days lost.",
    "The contractor is not responsible for delays caused by client-requested changes, unavailability of client representatives for approvals, or unforeseen site conditions.",
    "Final payment is due within 30 days of substantial completion and issuance of certificate of occupancy.",
    "Any dispute arising from this contract shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.",
    "This proposal supersedes all previous proposals and is subject to acceptance by the client within the validity period stated above.",
    "All materials and workmanship are guaranteed against defects for a period of one year from the date of substantial completion.",
  ],
  
  // ==================== COMPANY CERTIFICATIONS ====================
  certifications: [
    "Licensed General Contractor",
    "OSHA 30-Hour Certified",
    "ISO 9001:2015 Certified",
    "LEED Accredited Professional",
    "EPA Lead-Safe Certified",
    "DOT Approved Contractor",
    "Minority Business Enterprise (MBE)",
    "Small Business Administration (SBA) Certified",
  ],
  
  // ==================== INSURANCE INFORMATION ====================
  insurance: {
    generalLiability: "$5,000,000 aggregate / $2,000,000 per occurrence",
    workersComp: "Statutory limits for all employees",
    bondingCapacity: "$50,000,000 through XYZ Surety Company",
  },
};

/**
 * Default Value Propositions
 * Customize these to highlight your company's unique strengths
 */
export const defaultValuePropositions = [
  "Over 25 years of experience in commercial and industrial construction",
  "Perfect safety record with zero lost-time incidents in the past 5 years",
  "On-time completion rate of 98% across 500+ projects",
  "Local presence with intimate knowledge of area regulations and permitting",
  "In-house team of 150+ skilled professionals eliminates subcontractor coordination issues",
  "State-of-the-art project management software provides real-time progress tracking",
  "Financially stable with bonding capacity up to $50 million",
  "Strong relationships with local suppliers ensure competitive material pricing",
  "Award-winning quality - recipient of 15 industry excellence awards",
  "Comprehensive warranty program provides peace of mind for years after completion",
];

/**
 * Default Safety Commitment Statement
 */
export const defaultSafetyStatement = `
<p>Safety is our top priority on every project. ${companyConfig.name} maintains a comprehensive safety program that exceeds OSHA requirements and has resulted in an EMR (Experience Modification Rate) of 0.78, well below the industry average of 1.0.</p>

<p>Our safety protocols include:</p>
<ul>
  <li><strong>Daily Safety Briefings:</strong> Morning toolbox talks covering day's specific hazards and procedures</li>
  <li><strong>Weekly Site Inspections:</strong> Conducted by certified safety officers with documented corrective actions</li>
  <li><strong>Mandatory PPE:</strong> Personal Protective Equipment provided and enforced for all personnel and visitors</li>
  <li><strong>Drug and Alcohol Testing:</strong> Pre-employment, random, post-incident, and reasonable suspicion testing</li>
  <li><strong>Fall Protection:</strong> Complete training and equipment for all work above 6 feet</li>
  <li><strong>Confined Space Entry:</strong> Proper procedures, atmospheric testing, and rescue plans</li>
  <li><strong>Emergency Response:</strong> Site-specific emergency action plans and first aid/CPR trained personnel</li>
  <li><strong>Equipment Maintenance:</strong> Regular inspection and maintenance logs for all equipment and tools</li>
  <li><strong>Incident Reporting:</strong> 24-hour reporting system with root cause analysis for all incidents</li>
  <li><strong>Safety Incentive Program:</strong> Recognition and rewards for safe work practices and hazard identification</li>
</ul>

<p>We are fully compliant with all federal, state, and local safety regulations. All supervisory personnel maintain current OSHA 30-hour certifications, and our safety director holds a Certified Safety Professional (CSP) credential.</p>
`;

/**
 * Default Insurance & Bonding Statement
 */
export const defaultInsuranceStatement = `
<p>${companyConfig.name} maintains comprehensive insurance coverage to protect our clients and our work. All policies are current and in good standing with AM Best "A" rated carriers.</p>

<p><strong>Insurance Coverage:</strong></p>
<ul>
  <li><strong>General Liability Insurance:</strong> ${companyConfig.insurance.generalLiability}</li>
  <li><strong>Workers' Compensation:</strong> ${companyConfig.insurance.workersComp}</li>
  <li><strong>Automobile Liability:</strong> $2,000,000 per occurrence for all company vehicles</li>
  <li><strong>Umbrella Policy:</strong> $10,000,000 excess liability coverage</li>
  <li><strong>Professional Liability:</strong> $2,000,000 per claim for design-build services</li>
  <li><strong>Pollution Liability:</strong> $1,000,000 for environmental protection</li>
  <li><strong>Cyber Liability:</strong> $1,000,000 for data security and privacy protection</li>
  <li><strong>Builders Risk:</strong> Available upon request for project-specific needs</li>
</ul>

<p><strong>Bonding Capacity:</strong></p>
<p>${companyConfig.insurance.bondingCapacity}. We can provide performance and payment bonds for all projects at competitive rates. Our bonding company is ${companyConfig.name}'s surety partner of 15+ years.</p>

<p><strong>Additional Insured:</strong></p>
<p>Certificates of Insurance naming the client as additional insured are provided at project inception. We maintain $5 million in coverage throughout the project duration and for 3 years following substantial completion.</p>

<p><strong>Waiver of Subrogation:</strong></p>
<p>We provide waivers of subrogation in favor of project owners, as required by contract.</p>
`;

/**
 * Helper Functions
 */

/**
 * Format currency values
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date values
 */
export function formatDate(date: Date): string {
  return new Intl.DateFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Generate proposal number
 * Format: YYYYMMDD-XXX (date + sequential number)
 */
export function generateProposalNumber(sequentialNumber: number): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const seq = String(sequentialNumber).padStart(3, '0');
  
  return `${year}${month}${day}-${seq}`;
}

/**
 * Calculate validity date (90 days from now by default)
 */
export function calculateValidityDate(daysValid: number = 90): Date {
  const today = new Date();
  today.setDate(today.getDate() + daysValid);
  return today;
}

/**
 * Generate default references section
 */
export function generateDefaultReferences(): string {
  return `
<p>We are happy to provide detailed references from similar projects. Recent clients include:</p>

<div style="margin: 20px 0;">
  <h4 style="color: ${companyConfig.primaryColor}; margin-bottom: 5px;">Springfield Medical Center - Hospital Expansion</h4>
  <p style="margin: 5px 0;"><strong>Project Value:</strong> $15.2 million | <strong>Completed:</strong> March 2024</p>
  <p style="margin: 5px 0;"><strong>Contact:</strong> Dr. Sarah Williams, Facilities Director</p>
  <p style="margin: 5px 0;"><strong>Phone:</strong> (555) 234-5678 | <strong>Email:</strong> swilliams@springfieldmed.org</p>
  <p style="margin: 5px 0; font-style: italic;">"Premier Construction exceeded our expectations on every metric. Completed 3 weeks early with zero safety incidents."</p>
</div>

<div style="margin: 20px 0;">
  <h4 style="color: ${companyConfig.primaryColor}; margin-bottom: 5px;">Metro Industrial Park - 5-Building Warehouse Complex</h4>
  <p style="margin: 5px 0;"><strong>Project Value:</strong> $22.8 million | <strong>Completed:</strong> November 2023</p>
  <p style="margin: 5px 0;"><strong>Contact:</strong> Robert Chen, Development Manager</p>
  <p style="margin: 5px 0;"><strong>Phone:</strong> (555) 345-6789 | <strong>Email:</strong> rchen@metroindustrial.com</p>
  <p style="margin: 5px 0; font-style: italic;">"Outstanding project management and communication throughout. Will definitely use again for future projects."</p>
</div>

<div style="margin: 20px 0;">
  <h4 style="color: ${companyConfig.primaryColor}; margin-bottom: 5px;">City of Springfield - Bridge Rehabilitation Program</h4>
  <p style="margin: 5px 0;"><strong>Project Value:</strong> $8.5 million | <strong>Completed:</strong> August 2023</p>
  <p style="margin: 5px 0;"><strong>Contact:</strong> James Thompson, Public Works Director</p>
  <p style="margin: 5px 0;"><strong>Phone:</strong> (555) 456-7890 | <strong>Email:</strong> jthompson@springfield.gov</p>
  <p style="margin: 5px 0; font-style: italic;">"Excellent work quality and minimal disruption to traffic. Highly recommend for infrastructure projects."</p>
</div>

<p style="margin-top: 30px;">Additional references and detailed case studies available upon request.</p>
  `;
}
```

### Validation

```bash
# Verify file was created
ls -lh server/config/company.ts

# Check for syntax errors
npx tsc --noEmit server/config/company.ts

# Expected: No errors
```

### Success Criteria
- ✅ File created at correct path
- ✅ No TypeScript errors
- ✅ File size ~7-8KB

---

## 🔧 STEP 3: Create HTML Template File (30 MINUTES)

### File to Create
`server/templates/bid-response-template.html`

### Complete File Contents

**Note:** This is a large file. Create it exactly as shown:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bid Proposal - {{PROJECT_NAME}}</title>
    <style>
        @page {
            margin: 0.75in;
            size: letter;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            background: #ffffff;
        }

        .container {
            max-width: 8.5in;
            margin: 0 auto;
            background: white;
        }

        /* Header Section */
        .header {
            background: linear-gradient(135deg, {{PRIMARY_COLOR}} 0%, {{SECONDARY_COLOR}} 100%);
            color: white;
            padding: 30px 40px;
            border-bottom: 4px solid {{ACCENT_COLOR}};
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .company-logo {
            max-width: 200px;
            max-height: 80px;
            background: white;
            padding: 10px;
            border-radius: 4px;
        }

        .company-info {
            text-align: right;
            flex: 1;
            margin-left: 40px;
        }

        .company-name {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }

        .company-tagline {
            font-size: 14px;
            font-style: italic;
            opacity: 0.9;
            margin-bottom: 15px;
        }

        .company-details {
            font-size: 13px;
            line-height: 1.8;
            opacity: 0.95;
        }

        .company-details div {
            margin-bottom: 3px;
        }

        .company-details strong {
            display: inline-block;
            width: 70px;
            font-weight: 600;
        }

        /* Proposal Title */
        .proposal-title {
            background: #f8f9fa;
            padding: 30px 40px;
            border-left: 6px solid {{ACCENT_COLOR}};
            margin: 30px 0;
        }

        .proposal-title h1 {
            font-size: 32px;
            color: {{PRIMARY_COLOR}};
            margin-bottom: 10px;
            font-weight: 700;
        }

        .proposal-subtitle {
            font-size: 18px;
            color: #7f8c8d;
            margin-bottom: 20px;
        }

        .proposal-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .meta-item {
            background: white;
            padding: 12px 15px;
            border-radius: 4px;
            border-left: 3px solid #3498db;
        }

        .meta-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #7f8c8d;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }

        .meta-value {
            font-size: 15px;
            color: #2c3e50;
            font-weight: 600;
        }

        /* Content Sections */
        .content {
            padding: 0 40px 40px 40px;
        }

        .section {
            margin-bottom: 35px;
            page-break-inside: avoid;
        }

        .section-header {
            background: #ecf0f1;
            padding: 12px 20px;
            border-left: 4px solid {{SECONDARY_COLOR}};
            margin-bottom: 20px;
        }

        .section-header h2 {
            font-size: 20px;
            color: {{PRIMARY_COLOR}};
            font-weight: 700;
        }

        .section-content {
            padding: 0 20px;
            line-height: 1.8;
        }

        .section-content p {
            margin-bottom: 15px;
            text-align: justify;
        }

        .section-content ul,
        .section-content ol {
            margin: 15px 0 15px 25px;
        }

        .section-content li {
            margin-bottom: 10px;
            padding-left: 5px;
        }

        .section-content h3 {
            color: {{PRIMARY_COLOR}};
            font-size: 18px;
            margin: 20px 0 10px 0;
        }

        .section-content h4 {
            color: {{SECONDARY_COLOR}};
            font-size: 16px;
            margin: 15px 0 8px 0;
        }

        /* Executive Summary */
        .executive-summary {
            background: #fff9e6;
            border: 2px solid {{ACCENT_COLOR}};
            padding: 25px;
            border-radius: 6px;
            margin-bottom: 35px;
        }

        .executive-summary h3 {
            color: #e67e22;
            font-size: 18px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }

        .executive-summary h3:before {
            content: "★";
            margin-right: 10px;
            font-size: 22px;
        }

        /* Pricing Table */
        .price-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .price-table thead {
            background: {{SECONDARY_COLOR}};
            color: white;
        }

        .price-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .price-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #ecf0f1;
        }

        .price-table tbody tr:hover {
            background: #f8f9fa;
        }

        .price-table .item-description {
            font-weight: 500;
            color: #2c3e50;
        }

        .price-table .item-details {
            font-size: 13px;
            color: #7f8c8d;
            font-style: italic;
            margin-top: 3px;
        }

        .price-table .amount {
            text-align: right;
            font-weight: 600;
            color: #27ae60;
            font-size: 15px;
        }

        .price-total {
            background: {{PRIMARY_COLOR}} !important;
            color: white !important;
            font-size: 18px !important;
            font-weight: 700 !important;
        }

        .price-total td {
            padding: 18px 15px !important;
            border: none !important;
        }

        /* Timeline */
        .timeline {
            position: relative;
            padding-left: 30px;
            margin: 20px 0;
        }

        .timeline:before {
            content: '';
            position: absolute;
            left: 8px;
            top: 0;
            bottom: 0;
            width: 3px;
            background: #3498db;
        }

        .timeline-item {
            position: relative;
            margin-bottom: 25px;
            padding-left: 25px;
        }

        .timeline-item:before {
            content: '';
            position: absolute;
            left: -22px;
            top: 5px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3498db;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #3498db;
        }

        .timeline-date {
            font-weight: 700;
            color: {{SECONDARY_COLOR}};
            font-size: 15px;
            margin-bottom: 5px;
        }

        .timeline-description {
            color: #555;
            line-height: 1.6;
        }

        /* Team Grid */
        .team-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }

        .team-member {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            border-top: 3px solid {{SECONDARY_COLOR}};
        }

        .team-member-name {
            font-weight: 700;
            font-size: 16px;
            color: {{PRIMARY_COLOR}};
            margin-bottom: 5px;
        }

        .team-member-title {
            font-size: 13px;
            color: #7f8c8d;
            margin-bottom: 10px;
            font-style: italic;
        }

        .team-member-bio {
            font-size: 13px;
            line-height: 1.6;
            color: #555;
        }

        /* Certifications */
        .certifications {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
        }

        .certification-badge {
            background: white;
            border: 2px solid #27ae60;
            border-radius: 20px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            color: #27ae60;
            display: flex;
            align-items: center;
        }

        .certification-badge:before {
            content: "✓";
            margin-right: 6px;
            font-weight: 700;
        }

        /* Highlight Box */
        .highlight-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 8px;
            margin: 25px 0;
        }

        .highlight-box h3 {
            font-size: 20px;
            margin-bottom: 15px;
            color: white;
        }

        .highlight-box ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }

        .highlight-box li {
            padding-left: 25px;
            position: relative;
            margin-bottom: 12px;
        }

        .highlight-box li:before {
            content: "✓";
            position: absolute;
            left: 0;
            font-weight: 700;
            font-size: 16px;
        }

        /* Terms Section */
        .terms-section {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 6px;
            margin-top: 30px;
            font-size: 13px;
        }

        .terms-section h3 {
            font-size: 16px;
            color: {{PRIMARY_COLOR}};
            margin-bottom: 15px;
        }

        .terms-section ul {
            margin-left: 20px;
        }

        .terms-section li {
            margin-bottom: 8px;
        }

        /* Signature Section */
        .signature-section {
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #ecf0f1;
        }

        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 30px;
        }

        .signature-block {
            text-align: center;
        }

        .signature-line {
            border-bottom: 2px solid #2c3e50;
            height: 60px;
            margin-bottom: 10px;
        }

        .signature-label {
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .signature-info {
            font-size: 13px;
            color: #7f8c8d;
        }

        /* Footer */
        .footer {
            background: #2c3e50;
            color: white;
            padding: 25px 40px;
            margin-top: 40px;
            text-align: center;
            font-size: 13px;
        }

        .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }

        .footer-section {
            flex: 1;
            min-width: 200px;
        }

        .footer a {
            color: #3498db;
            text-decoration: none;
        }

        /* Page Break Control */
        .page-break {
            page-break-after: always;
        }

        .no-break {
            page-break-inside: avoid;
        }

        /* Print Styles */
        @media print {
            .no-print {
                display: none;
            }
            .page-break {
                page-break-after: always;
            }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
            }
            .company-info {
                text-align: left;
                margin-left: 0;
                margin-top: 20px;
            }
            .proposal-meta {
                grid-template-columns: 1fr;
            }
            .signature-grid {
                grid-template-columns: 1fr;
            }
            .team-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header with Company Branding -->
        <header class="header">
            <div class="header-content">
                <div class="logo-container">
                    <img src="{{COMPANY_LOGO_URL}}" alt="{{COMPANY_NAME}}" class="company-logo">
                </div>
                <div class="company-info">
                    <div class="company-name">{{COMPANY_NAME}}</div>
                    <div class="company-tagline">{{COMPANY_TAGLINE}}</div>
                    <div class="company-details">
                        <div><strong>Address:</strong> {{COMPANY_ADDRESS}}</div>
                        <div><strong>City:</strong> {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}</div>
                        <div><strong>Phone:</strong> {{COMPANY_PHONE}}</div>
                        <div><strong>Email:</strong> {{COMPANY_EMAIL}}</div>
                        <div><strong>Website:</strong> {{COMPANY_WEBSITE}}</div>
                        <div><strong>License:</strong> {{COMPANY_LICENSE_NUMBER}}</div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Proposal Title Section -->
        <section class="proposal-title">
            <h1>Bid Proposal</h1>
            <div class="proposal-subtitle">{{PROJECT_NAME}}</div>
            <div class="proposal-meta">
                <div class="meta-item">
                    <div class="meta-label">Proposal Number</div>
                    <div class="meta-value">{{PROPOSAL_NUMBER}}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Date Submitted</div>
                    <div class="meta-value">{{SUBMISSION_DATE}}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Valid Until</div>
                    <div class="meta-value">{{VALIDITY_DATE}}</div>
                </div>
                <div class="meta-item">
                    <div class="meta-label">Prepared For</div>
                    <div class="meta-value">{{CLIENT_NAME}}</div>
                </div>
            </div>
        </section>

        <!-- Main Content -->
        <div class="content">
            <!-- Executive Summary -->
            <div class="executive-summary no-break">
                <h3>Executive Summary</h3>
                {{EXECUTIVE_SUMMARY}}
            </div>

            <!-- Project Understanding -->
            <section class="section no-break">
                <div class="section-header">
                    <h2>1. Project Understanding</h2>
                </div>
                <div class="section-content">
                    {{PROJECT_UNDERSTANDING}}
                </div>
            </section>

            <!-- Scope of Work -->
            <section class="section">
                <div class="section-header">
                    <h2>2. Scope of Work</h2>
                </div>
                <div class="section-content">
                    {{SCOPE_OF_WORK}}
                </div>
            </section>

            <!-- Value Propositions -->
            <div class="highlight-box no-break">
                <h3>Why Choose {{COMPANY_NAME}}?</h3>
                <ul>
                    {{VALUE_PROPOSITIONS}}
                </ul>
            </div>

            <!-- Methodology -->
            <section class="section">
                <div class="section-header">
                    <h2>3. Our Approach & Methodology</h2>
                </div>
                <div class="section-content">
                    {{METHODOLOGY}}
                </div>
            </section>

            <!-- Timeline -->
            <section class="section no-break">
                <div class="section-header">
                    <h2>4. Project Timeline</h2>
                </div>
                <div class="section-content">
                    <div class="timeline">
                        {{TIMELINE_ITEMS}}
                    </div>
                </div>
            </section>

            <!-- Pricing -->
            <section class="section">
                <div class="section-header">
                    <h2>5. Pricing Breakdown</h2>
                </div>
                <div class="section-content">
                    <table class="price-table">
                        <thead>
                            <tr>
                                <th style="width: 10%;">Item</th>
                                <th style="width: 50%;">Description</th>
                                <th style="width: 15%;">Quantity</th>
                                <th style="width: 25%;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {{PRICING_ITEMS}}
                        </tbody>
                        <tfoot>
                            <tr class="price-total">
                                <td colspan="3" style="text-align: right;">TOTAL BID AMOUNT:</td>
                                <td class="amount">{{TOTAL_AMOUNT}}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </section>

            <!-- Team -->
            <section class="section">
                <div class="section-header">
                    <h2>6. Project Team</h2>
                </div>
                <div class="section-content">
                    <div class="team-grid">
                        {{TEAM_MEMBERS}}
                    </div>
                </div>
            </section>

            <!-- Qualifications -->
            <section class="section no-break">
                <div class="section-header">
                    <h2>7. Qualifications & Certifications</h2>
                </div>
                <div class="section-content">
                    <div class="certifications">
                        {{CERTIFICATIONS}}
                    </div>
                    {{QUALIFICATIONS_DESCRIPTION}}
                </div>
            </section>

            <!-- Safety -->
            <section class="section">
                <div class="section-header">
                    <h2>8. Safety & Compliance</h2>
                </div>
                <div class="section-content">
                    {{SAFETY_COMPLIANCE}}
                </div>
            </section>

            <!-- References -->
            <section class="section">
                <div class="section-header">
                    <h2>9. References</h2>
                </div>
                <div class="section-content">
                    {{REFERENCES}}
                </div>
            </section>

            <!-- Insurance -->
            <section class="section no-break">
                <div class="section-header">
                    <h2>10. Insurance & Bonding</h2>
                </div>
                <div class="section-content">
                    {{INSURANCE_BONDING}}
                </div>
            </section>

            <!-- Terms -->
            <div class="terms-section">
                <h3>Terms & Conditions</h3>
                {{TERMS_CONDITIONS}}
            </div>

            <!-- Signatures -->
            <div class="signature-section">
                <h3 style="text-align: center; margin-bottom: 30px;">Acceptance of Proposal</h3>
                <p style="text-align: center; margin-bottom: 30px;">
                    The above prices, specifications, and conditions are satisfactory and are hereby accepted. 
                    You are authorized to do the work as specified. Payment will be made as outlined above.
                </p>
                <div class="signature-grid">
                    <div class="signature-block">
                        <div class="signature-line"></div>
                        <div class="signature-label">{{COMPANY_NAME}} Representative</div>
                        <div class="signature-info">{{COMPANY_REP_NAME}}, {{COMPANY_REP_TITLE}}</div>
                        <div class="signature-info">Date: _______________</div>
                    </div>
                    <div class="signature-block">
                        <div class="signature-line"></div>
                        <div class="signature-label">Client Acceptance</div>
                        <div class="signature-info">{{CLIENT_NAME}}</div>
                        <div class="signature-info">Date: _______________</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-section">
                    <strong>{{COMPANY_NAME}}</strong><br>
                    {{COMPANY_ADDRESS}}, {{COMPANY_CITY}}, {{COMPANY_STATE}} {{COMPANY_ZIP}}
                </div>
                <div class="footer-section">
                    Phone: {{COMPANY_PHONE}}<br>
                    Email: <a href="mailto:{{COMPANY_EMAIL}}">{{COMPANY_EMAIL}}</a>
                </div>
                <div class="footer-section">
                    License: {{COMPANY_LICENSE_NUMBER}}<br>
                    <a href="https://{{COMPANY_WEBSITE}}">{{COMPANY_WEBSITE}}</a>
                </div>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                © {{CURRENT_YEAR}} {{COMPANY_NAME}}. All rights reserved.
            </div>
        </footer>
    </div>
</body>
</html>
```

### Validation

```bash
# Verify file created
ls -lh server/templates/bid-response-template.html

# Check file size (should be ~25-30KB)
du -h server/templates/bid-response-template.html

# Validate HTML (optional - requires html validator)
# npx html-validate server/templates/bid-response-template.html
```

### Success Criteria
- ✅ File created at correct path
- ✅ File size ~25-30KB
- ✅ Contains all placeholders ({{VARIABLE}})

---

## 🔧 STEP 4: Create Template Generator Module (30 MINUTES)

### File to Create
`server/lib/templates/bid-template-generator.ts`

### Complete File Contents

```typescript
/**
 * Bid Template Generator
 * Generates professional bid proposals with company branding
 */

import { 
  companyConfig, 
  defaultValuePropositions,
  defaultSafetyStatement,
  defaultInsuranceStatement,
  formatCurrency,
  formatDate,
  generateProposalNumber,
  calculateValidityDate,
  generateDefaultReferences
} from '../../config/company';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface BidProposalData {
  // Project Information
  projectName: string;
  clientName: string;
  clientContact?: string;
  
  // Content Sections (HTML or plain text)
  executiveSummary: string;
  projectUnderstanding: string;
  scopeOfWork: string;
  methodology: string;
  safetyCompliance?: string;
  qualificationsDescription?: string;
  references?: string;
  
  // Pricing
  pricingItems: PricingItem[];
  totalAmount: number;
  
  // Timeline
  timelineItems: TimelineItem[];
  
  // Team
  teamMembers: TeamMember[];
  
  // Optional overrides
  valuePropositions?: string[];
  certifications?: string[];
  termsConditions?: string[];
  
  // Metadata
  proposalNumber?: string;
  submissionDate?: Date;
  validityDate?: Date;
}

export interface PricingItem {
  itemNumber: number;
  description: string;
  details?: string;
  quantity: string;
  amount: number;
}

export interface TimelineItem {
  date: string;
  description: string;
}

export interface TeamMember {
  name: string;
  title: string;
  bio: string;
}

// Cache template
let templateCache: string | null = null;

/**
 * Load the HTML template from file
 */
function loadTemplate(): string {
  if (templateCache) {
    return templateCache;
  }
  
  const templatePath = join(__dirname, '../../templates/bid-response-template.html');
  templateCache = readFileSync(templatePath, 'utf-8');
  return templateCache;
}

/**
 * Generate a complete bid proposal HTML from data
 */
export function generateBidProposal(data: BidProposalData): string {
  const template = loadTemplate();
  
  // Prepare all replacements
  const replacements = {
    // Company Information
    COMPANY_NAME: companyConfig.name,
    COMPANY_TAGLINE: companyConfig.tagline,
    COMPANY_LOGO_URL: companyConfig.logoUrl,
    COMPANY_ADDRESS: companyConfig.address,
    COMPANY_CITY: companyConfig.city,
    COMPANY_STATE: companyConfig.state,
    COMPANY_ZIP: companyConfig.zip,
    COMPANY_PHONE: companyConfig.phone,
    COMPANY_EMAIL: companyConfig.email,
    COMPANY_WEBSITE: companyConfig.website,
    COMPANY_LICENSE_NUMBER: companyConfig.licenseNumber,
    COMPANY_REP_NAME: companyConfig.defaultRep.name,
    COMPANY_REP_TITLE: companyConfig.defaultRep.title,
    
    // Branding Colors
    PRIMARY_COLOR: companyConfig.primaryColor,
    SECONDARY_COLOR: companyConfig.secondaryColor,
    ACCENT_COLOR: companyConfig.accentColor,
    
    // Project Information
    PROJECT_NAME: data.projectName,
    CLIENT_NAME: data.clientName,
    
    // Metadata
    PROPOSAL_NUMBER: data.proposalNumber || generateProposalNumber(1),
    SUBMISSION_DATE: formatDate(data.submissionDate || new Date()),
    VALIDITY_DATE: formatDate(data.validityDate || calculateValidityDate()),
    CURRENT_YEAR: new Date().getFullYear().toString(),
    
    // Content Sections
    EXECUTIVE_SUMMARY: formatContent(data.executiveSummary),
    PROJECT_UNDERSTANDING: formatContent(data.projectUnderstanding),
    SCOPE_OF_WORK: formatContent(data.scopeOfWork),
    METHODOLOGY: formatContent(data.methodology),
    SAFETY_COMPLIANCE: formatContent(data.safetyCompliance || defaultSafetyStatement),
    INSURANCE_BONDING: formatContent(defaultInsuranceStatement),
    QUALIFICATIONS_DESCRIPTION: formatContent(data.qualificationsDescription || ''),
    REFERENCES: formatContent(data.references || generateDefaultReferences()),
    
    // Generated sections
    VALUE_PROPOSITIONS: generateValuePropositionsHTML(
      data.valuePropositions || defaultValuePropositions
    ),
    CERTIFICATIONS: generateCertificationsHTML(
      data.certifications || companyConfig.certifications
    ),
    PRICING_ITEMS: generatePricingItemsHTML(data.pricingItems),
    TOTAL_AMOUNT: formatCurrency(data.totalAmount),
    TIMELINE_ITEMS: generateTimelineHTML(data.timelineItems),
    TEAM_MEMBERS: generateTeamMembersHTML(data.teamMembers),
    TERMS_CONDITIONS: generateTermsHTML(
      data.termsConditions || companyConfig.defaultTerms
    ),
  };
  
  // Replace all placeholders
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value);
  }
  
  return html;
}

/**
 * Format content - wrap plain text in paragraphs if needed
 */
function formatContent(content: string): string {
  if (!content) return '';
  
  // If already contains HTML tags, return as-is
  if (/<[^>]+>/.test(content)) {
    return content;
  }
  
  // Otherwise, wrap in paragraph tags
  return `<p>${escapeHtml(content)}</p>`;
}

/**
 * Generate HTML for value propositions
 */
function generateValuePropositionsHTML(propositions: string[]): string {
  return propositions
    .map(prop => `<li>${escapeHtml(prop)}</li>`)
    .join('\n                    ');
}

/**
 * Generate HTML for certifications
 */
function generateCertificationsHTML(certifications: string[]): string {
  return certifications
    .map(cert => `<div class="certification-badge">${escapeHtml(cert)}</div>`)
    .join('\n                        ');
}

/**
 * Generate HTML for pricing items
 */
function generatePricingItemsHTML(items: PricingItem[]): string {
  return items.map(item => `
                            <tr>
                                <td>${item.itemNumber}</td>
                                <td>
                                    <div class="item-description">${escapeHtml(item.description)}</div>
                                    ${item.details ? `<div class="item-details">${escapeHtml(item.details)}</div>` : ''}
                                </td>
                                <td>${escapeHtml(item.quantity)}</td>
                                <td class="amount">${formatCurrency(item.amount)}</td>
                            </tr>`
  ).join('\n');
}

/**
 * Generate HTML for timeline items
 */
function generateTimelineHTML(items: TimelineItem[]): string {
  return items.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-date">${escapeHtml(item.date)}</div>
                            <div class="timeline-description">${escapeHtml(item.description)}</div>
                        </div>`
  ).join('\n');
}

/**
 * Generate HTML for team members
 */
function generateTeamMembersHTML(members: TeamMember[]): string {
  return members.map(member => `
                        <div class="team-member">
                            <div class="team-member-name">${escapeHtml(member.name)}</div>
                            <div class="team-member-title">${escapeHtml(member.title)}</div>
                            <div class="team-member-bio">${escapeHtml(member.bio)}</div>
                        </div>`
  ).join('\n');
}

/**
 * Generate HTML for terms and conditions
 */
function generateTermsHTML(terms: string[]): string {
  return `<ul>\n${terms.map(term => `                    <li>${escapeHtml(term)}</li>`).join('\n')}\n                </ul>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate bid from AI-generated content
 * Wraps AI content in professional template
 */
export function generateBidFromAI(
  aiGeneratedHtml: string,
  projectData: Partial<BidProposalData>
): string {
  // Extract sections from AI content if possible
  // For now, use AI content as project understanding
  
  const fullData: BidProposalData = {
    projectName: projectData.projectName || "Untitled Project",
    clientName: projectData.clientName || "Valued Client",
    executiveSummary: projectData.executiveSummary || extractExecutiveSummary(aiGeneratedHtml),
    projectUnderstanding: aiGeneratedHtml, // Use AI content here
    scopeOfWork: projectData.scopeOfWork || '',
    methodology: projectData.methodology || '',
    pricingItems: projectData.pricingItems || [],
    totalAmount: projectData.totalAmount || 0,
    timelineItems: projectData.timelineItems || [],
    teamMembers: projectData.teamMembers || [],
    ...projectData,
  };
  
  return generateBidProposal(fullData);
}

/**
 * Attempt to extract executive summary from AI content
 */
function extractExecutiveSummary(html: string): string {
  // Simple extraction - take first paragraph
  const match = html.match(/<p>(.*?)<\/p>/);
  if (match) {
    return `<p>${match[1]}</p>`;
  }
  
  // If no paragraphs, take first 300 characters
  const text = html.replace(/<[^>]+>/g, '').substring(0, 300);
  return `<p>${text}...</p>`;
}

/**
 * Example usage - creates a sample bid
 */
export function createExampleBidProposal(): string {
  const exampleData: BidProposalData = {
    projectName: "Downtown Bridge Renovation Project",
    clientName: "City of Springfield Public Works Department",
    
    executiveSummary: `
      <p>${companyConfig.name} is pleased to submit this comprehensive proposal for the Downtown Bridge Renovation Project. 
      With over 25 years of specialized experience in bridge rehabilitation and a proven track record of on-time, 
      on-budget project delivery, we are confident in our ability to exceed your expectations.</p>
      
      <p>Our team has successfully completed 47 similar bridge projects in the past decade, including the award-winning 
      Metro River Bridge restoration in 2023. We understand the critical importance of maintaining traffic flow while 
      ensuring worker and public safety, and our methodology reflects this priority.</p>
    `,
    
    projectUnderstanding: `
      <p>We understand this project involves the comprehensive renovation of the historic downtown bridge spanning 
      Main Street, originally constructed in 1962. The scope includes structural repairs to deteriorated concrete supports, 
      replacement of expansion joints, installation of a modern LED lighting system, and complete repainting of all steel 
      structural elements.</p>
      
      <p><strong>Key project challenges we have identified:</strong></p>
      <ul>
        <li>Maintaining at least one lane of traffic in each direction during construction</li>
        <li>Coordinating work to avoid peak commute hours (7-9 AM and 4-6 PM)</li>
        <li>Environmental protection measures for the river below</li>
        <li>Noise restrictions in adjacent residential areas</li>
        <li>Historical preservation requirements for the bridge's original architectural features</li>
      </ul>
    `,
    
    scopeOfWork: `
      <h4>1. Structural Assessment and Repairs</h4>
      <ul>
        <li>Comprehensive structural inspection using ultrasonic testing and ground-penetrating radar</li>
        <li>Repair of spalled and deteriorated concrete on all support piers</li>
        <li>Replacement of corroded rebar with epoxy-coated steel reinforcement</li>
        <li>Application of waterproof membrane to deck surface</li>
      </ul>
      
      <h4>2. Steel Structure Renovation</h4>
      <ul>
        <li>Abrasive blasting to remove all existing paint and corrosion</li>
        <li>Application of rust-inhibiting primer and two coats of high-performance coating</li>
        <li>Replacement of 12 deteriorated steel connection plates</li>
      </ul>
      
      <h4>3. Mechanical Systems</h4>
      <ul>
        <li>Installation of 48 LED light fixtures with automatic day/night sensors</li>
        <li>Replacement of all expansion joints with modern modular systems</li>
        <li>Upgrade of drainage system with new scuppers and downspouts</li>
      </ul>
    `,
    
    methodology: `
      <h4>Phase 1: Mobilization and Site Preparation (Weeks 1-2)</h4>
      <p>We will establish site access, safety protocols, and traffic control measures. Our team will conduct a 
      detailed pre-construction survey and coordinate with all stakeholders.</p>
      
      <h4>Phase 2: Structural Repairs (Weeks 3-12)</h4>
      <p>Working from specialized equipment platforms, we will systematically address all concrete repairs. Work will 
      proceed from upstream to downstream, maintaining traffic flow at all times.</p>
      
      <h4>Phase 3: Steel Renovation (Weeks 13-24)</h4>
      <p>All steel painting operations will occur during off-peak hours (9 PM to 5 AM) to minimize traffic disruption.</p>
    `,
    
    pricingItems: [
      {
        itemNumber: 1,
        description: "Site Mobilization and Traffic Control",
        details: "Equipment delivery, safety barriers, signage, and traffic management personnel",
        quantity: "1 LS",
        amount: 125000
      },
      {
        itemNumber: 2,
        description: "Structural Concrete Repairs",
        details: "Spall repair, rebar replacement, waterproofing membrane",
        quantity: "2,400 SF",
        amount: 384000
      },
      {
        itemNumber: 3,
        description: "Steel Blasting and Painting",
        details: "Complete surface preparation and three-coat system",
        quantity: "18,500 SF",
        amount: 462500
      },
      {
        itemNumber: 4,
        description: "Expansion Joint Replacement",
        details: "Modular expansion joints at 4 locations",
        quantity: "4 EA",
        amount: 180000
      },
      {
        itemNumber: 5,
        description: "LED Lighting System",
        details: "48 fixtures with controls and electrical infrastructure",
        quantity: "1 LS",
        amount: 96000
      },
    ],
    
    totalAmount: 1247500,
    
    timelineItems: [
      {
        date: "Weeks 1-2 (Jan 15 - Jan 26, 2026)",
        description: "Site mobilization, establish safety protocols, and pre-construction surveys"
      },
      {
        date: "Weeks 3-12 (Jan 27 - Apr 2, 2026)",
        description: "Structural concrete repairs including spall repair and waterproofing"
      },
      {
        date: "Weeks 13-24 (Apr 3 - Jun 18, 2026)",
        description: "Steel structure blasting and painting operations"
      },
    ],
    
    teamMembers: [
      {
        name: "Robert Chen, PE",
        title: "Project Manager",
        bio: "28 years of experience managing bridge projects. Licensed Professional Engineer with expertise in structural rehabilitation."
      },
      {
        name: "Sarah Martinez",
        title: "Site Superintendent",
        bio: "15 years in bridge construction. OSHA 30-hour certified. Specializes in traffic control and safety management."
      },
    ],
  };
  
  return generateBidProposal(exampleData);
}
```

### Validation

```bash
# Check TypeScript compilation
npx tsc --noEmit server/lib/templates/bid-template-generator.ts

# Expected: No errors
```

### Success Criteria
- ✅ File created at correct path
- ✅ No TypeScript errors
- ✅ File size ~18-20KB

---

## 🔧 STEP 5: Integrate with Existing Routes (20 MINUTES)

### File to Modify
`server/routes.ts`

### Action Required

**ADD IMPORTS at the top of file (after existing imports):**

```typescript
import { generateBidFromAI, BidProposalData } from './lib/templates/bid-template-generator';
import { companyConfig } from './config/company';
```

**FIND the generate endpoint** (around line 213):

```typescript
app.post("/api/projects/:id/generate", authenticateToken, async (req: AuthRequest, res) => {
```

**REPLACE the entire endpoint with:**

```typescript
app.post("/api/projects/:id/generate", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { instructions, tone, model, useTemplate = true } = generateBidSchema.parse(req.body);
    const projectId = req.params.id;

    // Verify ownership
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    if (project.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Sanitize AI inputs
    let sanitizedInstructions: string;
    let sanitizedTone: string;
    
    try {
      sanitizedInstructions = sanitizeInstructions(instructions);
      sanitizedTone = sanitizeTone(tone || 'professional');
    } catch (error) {
      if (error instanceof InputSanitizationError) {
        return res.status(400).json({ 
          error: 'Invalid input detected',
          reason: error.reason,
          message: error.message
        });
      }
      throw error;
    }

    // Generate embedding and search
    console.log('Generating query embedding for:', sanitizedInstructions.substring(0, 100) + '...');
    const queryEmbedding = await generateEmbedding(sanitizedInstructions);
    const relevantChunks = await storage.searchSimilarChunks(queryEmbedding, projectId, 10);

    const context = relevantChunks
      .map((chunk, i) => `[Chunk ${i + 1}]: ${chunk.content}`)
      .join('\n\n');

    const contextOrDefault = context || 'No relevant context found.';
    
    console.log(`Found ${relevantChunks.length} relevant chunks for bid generation`);

    // Generate bid content using selected model
    let aiHtml: string;
    switch (model) {
      case 'anthropic':
        aiHtml = await generateBidWithAnthropic({ 
          instructions: sanitizedInstructions, 
          context: contextOrDefault, 
          tone: sanitizedTone 
        });
        break;
      case 'gemini':
        aiHtml = await generateBidWithGemini({ 
          instructions: sanitizedInstructions, 
          context: contextOrDefault, 
          tone: sanitizedTone 
        });
        break;
      case 'deepseek':
        aiHtml = await generateBidWithDeepSeek({ 
          instructions: sanitizedInstructions, 
          context: contextOrDefault, 
          tone: sanitizedTone 
        });
        break;
      default:
        aiHtml = await generateBidContent({ 
          instructions: sanitizedInstructions, 
          context: contextOrDefault, 
          tone: sanitizedTone 
        });
    }

    // Wrap in professional template if requested
    let finalHtml: string;
    if (useTemplate) {
      try {
        finalHtml = generateBidFromAI(aiHtml, {
          projectName: project.name,
          clientName: req.body.clientName || "Valued Client",
          executiveSummary: aiHtml.substring(0, 500), // Use beginning of AI content
          // Add more fields as needed from request body
        });
      } catch (error) {
        console.error('Template generation error:', error);
        // Fallback to AI content without template
        finalHtml = aiHtml;
      }
    } else {
      finalHtml = aiHtml;
    }

    res.json({ html: finalHtml });
  } catch (error: any) {
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**UPDATE the schema** to include `useTemplate`:

Find `generateBidSchema` (around line 54):

```typescript
const generateBidSchema = z.object({
  instructions: z.string().min(1),
  tone: z.string().optional().default('professional'),
  model: z.enum(['openai', 'anthropic', 'gemini', 'deepseek']).optional().default('openai'),
  useTemplate: z.boolean().optional().default(true), // ✅ Add this line
  clientName: z.string().optional(), // ✅ Add this line
});
```

### Validation

```bash
# Check TypeScript compilation
npx tsc --noEmit server/routes.ts

# Test endpoint (after server restart)
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Create a bid for road construction",
    "tone": "professional",
    "useTemplate": true,
    "clientName": "City of Springfield"
  }'

# Expected: HTML response with professional template
```

### Success Criteria
- ✅ No TypeScript errors
- ✅ Server starts without errors
- ✅ Generate endpoint returns templated HTML

---

## 🔧 STEP 6: Add PDF Export Capability (15 MINUTES)

### Install Dependencies

```bash
npm install puppeteer --break-system-packages
npm install @types/puppeteer --save-dev --break-system-packages
```

### File to Modify
`server/routes.ts`

### Action Required

**ADD IMPORT at top:**

```typescript
import puppeteer from 'puppeteer';
```

**ADD NEW ENDPOINT after the generate endpoint:**

```typescript
/**
 * POST /api/projects/:id/export-pdf
 * Export bid proposal as PDF
 */
app.post("/api/projects/:id/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { html } = req.body;
    const projectId = req.params.id;

    if (!html) {
      return res.status(400).json({ error: "HTML content is required" });
    }

    // Verify project ownership
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { 
      waitUntil: 'networkidle0' 
    });
    
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.75in',
        bottom: '0.5in',
        left: '0.75in'
      }
    });
    
    await browser.close();

    // Set headers for PDF download
    const filename = `bid-proposal-${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);

  } catch (error: any) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

/**
 * GET /api/templates/preview
 * Preview the bid template with example data
 */
app.get("/api/templates/preview", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { createExampleBidProposal } = await import('./lib/templates/bid-template-generator');
    const exampleHtml = createExampleBidProposal();
    res.setHeader('Content-Type', 'text/html');
    res.send(exampleHtml);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

### Validation

```bash
# Test template preview
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/templates/preview > preview.html

# Open preview.html in browser to verify

# Test PDF export
curl -X POST http://localhost:5000/api/projects/PROJECT_ID/export-pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><h1>Test</h1></body></html>"}' \
  > test.pdf

# Verify PDF was created
file test.pdf
# Expected: "PDF document"
```

### Success Criteria
- ✅ Preview endpoint returns HTML
- ✅ PDF export endpoint creates valid PDF
- ✅ PDF opens correctly in PDF viewer

---

## 🔧 STEP 7: Create Frontend Preview Component (20 MINUTES)

### File to Create
`client/src/components/bid/BidPreview.tsx`

### Complete File Contents

```typescript
import React, { useState } from 'react';

interface BidPreviewProps {
  html: string;
  projectId: string;
  onClose?: () => void;
}

export function BidPreview({ html, projectId, onClose }: BidPreviewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsExporting(true);
      
      const token = localStorage.getItem('auth_token'); // Adjust based on your auth system
      
      const response = await fetch(`/api/projects/${projectId}/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ html })
      });

      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bid-proposal-${projectId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyHTML = () => {
    navigator.clipboard.writeText(html).then(() => {
      alert('HTML copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy HTML:', err);
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '1200px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        {/* Toolbar */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#333' }}>
            Bid Proposal Preview
          </h2>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🖨️ Print
            </button>
            
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              style={{
                padding: '8px 16px',
                backgroundColor: isExporting ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {isExporting ? '⏳ Exporting...' : '📄 Download PDF'}
            </button>
            
            <button
              onClick={handleCopyHTML}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📋 Copy HTML
            </button>
            
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#e0e0e0',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            margin: '0 auto',
            maxWidth: '8.5in'
          }}>
            <iframe
              srcDoc={html}
              title="Bid Preview"
              style={{
                width: '100%',
                height: '11in',
                border: 'none',
                display: 'block'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Usage Example

Create `client/src/pages/GenerateBid.tsx` or add to existing page:

```typescript
import { BidPreview } from '../components/bid/BidPreview';
import { useState } from 'react';

export function GenerateBidPage() {
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>('');

  const handleGenerate = async () => {
    // Your existing generation logic
    const response = await fetch(`/api/projects/${projectId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructions: "Create a bid...",
        useTemplate: true,
        clientName: "City of Springfield"
      })
    });
    
    const data = await response.json();
    setGeneratedHtml(data.html);
  };

  return (
    <div>
      {/* Your existing UI */}
      <button onClick={handleGenerate}>Generate Bid</button>
      
      {/* Show preview when HTML is generated */}
      {generatedHtml && (
        <BidPreview 
          html={generatedHtml}
          projectId={projectId}
          onClose={() => setGeneratedHtml(null)}
        />
      )}
    </div>
  );
}
```

### Validation

```bash
# Check TypeScript compilation
npx tsc --noEmit client/src/components/bid/BidPreview.tsx

# Start client
cd client && npm run dev

# Test in browser - generate a bid and verify preview appears
```

### Success Criteria
- ✅ Component renders without errors
- ✅ Preview displays HTML correctly
- ✅ Print button works
- ✅ PDF download works
- ✅ Copy HTML works

---

## 🔧 STEP 8: Add Template Settings UI (OPTIONAL - 30 MINUTES)

### File to Create
`client/src/components/bid/TemplateSettings.tsx`

### Complete File Contents

```typescript
import React, { useState } from 'react';

interface TemplateSettingsProps {
  onSave?: (settings: TemplateSettings) => void;
}

interface TemplateSettings {
  useTemplate: boolean;
  clientName: string;
  includeTeam: boolean;
  includePricing: boolean;
  includeTimeline: boolean;
}

export function TemplateSettings({ onSave }: TemplateSettingsProps) {
  const [settings, setSettings] = useState<TemplateSettings>({
    useTemplate: true,
    clientName: '',
    includeTeam: true,
    includePricing: true,
    includeTimeline: true,
  });

  const handleChange = (field: keyof TemplateSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    if (onSave) {
      onSave(newSettings);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
        Template Settings
      </h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.useTemplate}
            onChange={(e) => handleChange('useTemplate', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span>Use professional bid template</span>
        </label>
        <small style={{ color: '#666', marginLeft: '24px', display: 'block' }}>
          Wrap AI-generated content in branded template with company logo
        </small>
      </div>

      {settings.useTemplate && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
              Client Name:
            </label>
            <input
              type="text"
              value={settings.clientName}
              onChange={(e) => handleChange('clientName', e.target.value)}
              placeholder="e.g., City of Springfield"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeTeam}
                onChange={(e) => handleChange('includeTeam', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span>Include team section</span>
            </label>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includePricing}
                onChange={(e) => handleChange('includePricing', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span>Include pricing breakdown</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.includeTimeline}
                onChange={(e) => handleChange('includeTimeline', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span>Include project timeline</span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
```

### Success Criteria
- ✅ Component renders without errors
- ✅ Settings update in real-time
- ✅ Callback function works

---

## 🔧 STEP 9: Testing and Validation (20 MINUTES)

### Test 1: Company Configuration

```bash
# Create test script
cat > server/test-company-config.ts << 'EOF'
import { companyConfig, formatCurrency, formatDate } from './config/company';

console.log('Testing Company Configuration...\n');

console.log('Company Name:', companyConfig.name);
console.log('Address:', `${companyConfig.address}, ${companyConfig.city}, ${companyConfig.state}`);
console.log('Phone:', companyConfig.phone);
console.log('Email:', companyConfig.email);
console.log('License:', companyConfig.licenseNumber);
console.log('\nColors:');
console.log('  Primary:', companyConfig.primaryColor);
console.log('  Secondary:', companyConfig.secondaryColor);
console.log('  Accent:', companyConfig.accentColor);
console.log('\nCertifications:', companyConfig.certifications.length);
console.log('\nHelper Functions:');
console.log('  formatCurrency(1234567.89):', formatCurrency(1234567.89));
console.log('  formatDate(new Date()):', formatDate(new Date()));

console.log('\n✅ Company configuration loaded successfully!');
EOF

# Run test
npx ts-node server/test-company-config.ts

# Expected: All values print correctly
```

### Test 2: Template Generation

```bash
# Create test script
cat > server/test-template-generator.ts << 'EOF'
import { createExampleBidProposal } from './lib/templates/bid-template-generator';
import { writeFileSync } from 'fs';

console.log('Testing Template Generator...\n');

try {
  const html = createExampleBidProposal();
  
  console.log('Generated HTML length:', html.length, 'characters');
  console.log('Contains company name:', html.includes('Premier Construction'));
  console.log('Contains pricing table:', html.includes('price-table'));
  console.log('Contains timeline:', html.includes('timeline'));
  
  // Save to file for manual inspection
  writeFileSync('test-output-bid.html', html);
  console.log('\n✅ Template generated successfully!');
  console.log('📄 Saved to: test-output-bid.html');
  console.log('   Open this file in a browser to view the template');
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
EOF

# Run test
npx ts-node server/test-template-generator.ts

# Open the generated HTML file in browser
# Expected: Professional bid proposal displays correctly
```

### Test 3: End-to-End API Test

```bash
# Test the complete flow

# 1. Start server
npm run dev

# 2. Preview template (in another terminal)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/templates/preview > preview.html

# 3. Open preview.html in browser
# Expected: See example bid proposal with company branding

# 4. Test generate endpoint
curl -X POST http://localhost:5000/api/projects/YOUR_PROJECT_ID/generate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instructions": "Create a professional bid for commercial construction",
    "tone": "professional",
    "model": "openai",
    "useTemplate": true,
    "clientName": "Test Client Corp"
  }' | jq -r '.html' > generated-bid.html

# 5. Open generated-bid.html
# Expected: AI-generated content wrapped in professional template

# 6. Test PDF export
curl -X POST http://localhost:5000/api/projects/YOUR_PROJECT_ID/export-pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"html\":\"$(cat generated-bid.html | jq -Rs .)\"}" \
  > generated-bid.pdf

# 7. Open generated-bid.pdf
# Expected: Professional PDF with proper formatting
```

### Test 4: Frontend Integration

```bash
# 1. Start frontend
cd client && npm run dev

# 2. Navigate to bid generation page
# 3. Enter project details
# 4. Click generate
# 5. Verify preview appears
# 6. Test print button
# 7. Test PDF download
# 8. Test copy HTML

# Expected: All functions work correctly
```

### Validation Checklist

Run through this checklist:

- [ ] **Company config loads without errors**
- [ ] **Template HTML file exists and is valid**
- [ ] **Template generator creates HTML**
- [ ] **Example bid renders correctly in browser**
- [ ] **Colors match company config**
- [ ] **Company logo placeholder exists**
- [ ] **Generate endpoint returns templated HTML**
- [ ] **AI content is wrapped in template**
- [ ] **PDF export creates valid PDF**
- [ ] **Preview endpoint works**
- [ ] **Frontend component renders**
- [ ] **Print function works**
- [ ] **PDF download works**
- [ ] **Copy HTML works**
- [ ] **No console errors**
- [ ] **No TypeScript errors**
- [ ] **Server starts without errors**

---

## ✅ COMPLETION CHECKLIST

Mark each item as complete:

### Files Created
- [ ] `server/config/company.ts`
- [ ] `server/templates/bid-response-template.html`
- [ ] `server/lib/templates/bid-template-generator.ts`
- [ ] `client/src/components/bid/BidPreview.tsx`
- [ ] `client/src/components/bid/TemplateSettings.tsx` (optional)

### Code Modified
- [ ] `server/routes.ts` - Added imports
- [ ] `server/routes.ts` - Updated generate endpoint
- [ ] `server/routes.ts` - Added PDF export endpoint
- [ ] `server/routes.ts` - Added preview endpoint
- [ ] `server/routes.ts` - Updated schema

### Dependencies Installed
- [ ] `puppeteer`
- [ ] `@types/puppeteer`

### Testing Complete
- [ ] Company config test passed
- [ ] Template generation test passed
- [ ] Example bid renders correctly
- [ ] API endpoints tested
- [ ] Frontend components tested
- [ ] PDF export works
- [ ] Print function works

### Documentation
- [ ] Company information updated in config
- [ ] Company logo uploaded (if available)
- [ ] Colors customized to match brand
- [ ] Terms reviewed and updated
- [ ] Team updated README with new feature

---

## 📚 NEXT STEPS

After completing implementation:

### 1. Customize Company Information
- Edit `server/config/company.ts`
- Add real company details
- Upload company logo to `client/public/images/company-logo.png`
- Customize colors to match brand

### 2. Test with Real Data
- Generate bids for actual projects
- Review output for accuracy
- Get stakeholder feedback
- Iterate on template design

### 3. Optional Enhancements
- Add more template variations
- Create multiple themes
- Add custom section support
- Implement template version control
- Add template analytics

### 4. Production Preparation
- Review all default content
- Have legal review terms & conditions
- Verify insurance amounts are current
- Test PDF generation at scale
- Set up monitoring for PDF exports

---

## 🆘 TROUBLESHOOTING

### Issue: Template not found error

**Solution:**
```bash
# Verify file exists
ls -la server/templates/bid-response-template.html

# Check file path in generator
grep -n "templatePath" server/lib/templates/bid-template-generator.ts
```

### Issue: Colors not applying

**Solution:**
```typescript
// Verify colors in company.ts
console.log(companyConfig.primaryColor);
console.log(companyConfig.secondaryColor);
console.log(companyConfig.accentColor);

// Check template has color placeholders
grep "{{PRIMARY_COLOR}}" server/templates/bid-response-template.html
```

### Issue: PDF export fails

**Solution:**
```bash
# Check puppeteer installation
npm list puppeteer

# Reinstall if needed
npm uninstall puppeteer
npm install puppeteer --break-system-packages

# Try with different launch options
args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
```

### Issue: Logo not displaying

**Solution:**
```bash
# Check logo exists
ls -la client/public/images/company-logo.png

# Use absolute URL as fallback
logoUrl: "https://yourdomain.com/images/logo.png"

# Or use base64 encoded image
logoUrl: "data:image/png;base64,iVBORw0KG..."
```

### Issue: TypeScript errors

**Solution:**
```bash
# Check all imports are correct
npm run type-check

# Restart TypeScript server in VS Code
Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
```

---

## 🎉 SUCCESS CRITERIA

You have successfully implemented the bid template system when:

✅ **Company configuration loads without errors**
✅ **Template generates with company branding**
✅ **AI content wraps in professional template**
✅ **PDF export creates valid PDFs**
✅ **Frontend preview component works**
✅ **All endpoints respond correctly**
✅ **No console or TypeScript errors**
✅ **Template renders correctly in browser**
✅ **Print function works**
✅ **Colors match company brand**

---

## 📞 SUPPORT

If you encounter issues:

1. **Check the troubleshooting section above**
2. **Review validation steps for each section**
3. **Verify all files are in correct locations**
4. **Check TypeScript compilation errors**
5. **Review server logs for errors**
6. **Test endpoints individually**

---

**Estimated Total Time:** 2-3 hours  
**Difficulty:** Intermediate  
**Result:** Professional branded bid proposals with PDF export

**Good luck! Follow each step carefully and test thoroughly.** 🚀
