import { companyConfig, formatCurrency, formatDate, generateProposalNumber, calculateValidityDate, defaultValuePropositions, type CompanyConfig } from '../../config/company';
import { db } from '../../db';
import { companies } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function getCompanyConfig(companyId: number | null): Promise<CompanyConfig> {
  if (!companyId) {
    return companyConfig;
  }
  
  try {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    
    if (company?.settings && typeof company.settings === 'object') {
      const settings = company.settings as Record<string, any>;
      return {
        ...companyConfig,
        name: company.name || companyConfig.name,
        primaryColor: settings.primaryColor || companyConfig.primaryColor,
        secondaryColor: settings.secondaryColor || companyConfig.secondaryColor,
        accentColor: settings.accentColor || companyConfig.accentColor,
        tagline: settings.tagline || companyConfig.tagline,
        address: settings.address || companyConfig.address,
        city: settings.city || companyConfig.city,
        state: settings.state || companyConfig.state,
        zip: settings.zip || companyConfig.zip,
        phone: settings.phone || companyConfig.phone,
        email: settings.email || companyConfig.email,
        website: settings.website || companyConfig.website,
        licenseNumber: settings.licenseNumber || companyConfig.licenseNumber,
      };
    }
    
    return {
      ...companyConfig,
      name: company?.name || companyConfig.name,
    };
  } catch (error) {
    console.error('Failed to load company config:', error);
    return companyConfig;
  }
}

export interface BidData {
  projectName: string;
  clientName: string;
  projectDescription?: string;
  scope?: string;
  timeline?: string;
  pricing?: {
    items: Array<{ description: string; amount: number }>;
    subtotal: number;
    contingency?: number;
    total: number;
  };
  proposalNumber?: string;
  validUntil?: Date;
  customSections?: Array<{ title: string; content: string }>;
}

export interface TemplateOptions {
  includeValuePropositions?: boolean;
  includeTerms?: boolean;
  includeCertifications?: boolean;
  includeInsurance?: boolean;
  includeSafety?: boolean;
  customLogo?: string;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
}

export function generateBidTemplate(
  bidData: BidData,
  options: TemplateOptions = {},
  companyConfigOverride?: CompanyConfig
): string {
  const activeConfig = companyConfigOverride || companyConfig;
  
  const {
    includeValuePropositions = true,
    includeTerms = true,
    includeCertifications = true,
    includeInsurance = true,
    customColors = {},
  } = options;

  const colors = {
    primary: customColors.primary || activeConfig.primaryColor,
    secondary: customColors.secondary || activeConfig.secondaryColor,
    accent: customColors.accent || activeConfig.accentColor,
  };

  const proposalNumber = bidData.proposalNumber || generateProposalNumber(Math.floor(Math.random() * 1000));
  const validUntil = bidData.validUntil || calculateValidityDate(90);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bid Proposal - ${bidData.projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid ${colors.primary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-info h1 {
      color: ${colors.primary};
      font-size: 28px;
      margin-bottom: 5px;
    }
    .company-info .tagline {
      color: ${colors.secondary};
      font-style: italic;
      margin-bottom: 10px;
    }
    .company-info .contact {
      font-size: 12px;
      color: #666;
    }
    .proposal-meta {
      text-align: right;
      font-size: 14px;
    }
    .proposal-meta .label { color: #666; }
    .proposal-meta .value { font-weight: bold; color: ${colors.primary}; }
    
    /* Title Section */
    .title-section {
      background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
      color: white;
      padding: 30px;
      margin: 30px -40px;
      text-align: center;
    }
    .title-section h2 { font-size: 24px; margin-bottom: 10px; }
    .title-section .subtitle { opacity: 0.9; }
    
    /* Sections */
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h3 {
      color: ${colors.primary};
      border-bottom: 2px solid ${colors.accent};
      padding-bottom: 10px;
      margin-bottom: 15px;
      font-size: 18px;
    }
    .section-content { padding-left: 15px; }
    
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: ${colors.primary};
      color: white;
      font-weight: 600;
    }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row {
      background: ${colors.accent} !important;
      color: white;
      font-weight: bold;
    }
    .amount { text-align: right; }
    
    /* Lists */
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    
    /* Value Props */
    .value-props {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .value-prop {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .value-prop .icon {
      color: ${colors.accent};
      font-size: 18px;
    }
    
    /* Certifications */
    .certifications {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .cert-badge {
      background: ${colors.secondary};
      color: white;
      padding: 5px 12px;
      border-radius: 15px;
      font-size: 12px;
    }
    
    /* Footer */
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid ${colors.primary};
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    
    /* Signature Block */
    .signature-block {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .signature-area {
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: 50px;
    }
    .signature-label { font-size: 12px; color: #666; }
    
    @media print {
      .container { padding: 20px; }
      .title-section { margin: 30px -20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        <h1>${activeConfig.name}</h1>
        <div class="tagline">${activeConfig.tagline}</div>
        <div class="contact">
          ${activeConfig.address}, ${activeConfig.city}, ${activeConfig.state} ${activeConfig.zip}<br>
          ${activeConfig.phone} | ${activeConfig.email}
        </div>
      </div>
      <div class="proposal-meta">
        <div><span class="label">Proposal #:</span> <span class="value">${proposalNumber}</span></div>
        <div><span class="label">Date:</span> <span class="value">${formatDate(new Date())}</span></div>
        <div><span class="label">Valid Until:</span> <span class="value">${formatDate(validUntil)}</span></div>
      </div>
    </div>
    
    <!-- Title Section -->
    <div class="title-section">
      <h2>Bid Proposal</h2>
      <div class="subtitle">${bidData.projectName}</div>
      <div class="subtitle">Prepared for: ${bidData.clientName}</div>
    </div>
    
    <!-- Executive Summary -->
    <div class="section">
      <h3>Executive Summary</h3>
      <div class="section-content">
        <p>${activeConfig.name} is pleased to submit this proposal for <strong>${bidData.projectName}</strong>. 
        ${bidData.projectDescription || 'We are committed to delivering exceptional quality and value for this project.'}</p>
      </div>
    </div>
    
    ${bidData.scope ? `
    <!-- Scope of Work -->
    <div class="section">
      <h3>Scope of Work</h3>
      <div class="section-content">
        ${bidData.scope}
      </div>
    </div>
    ` : ''}
    
    ${bidData.timeline ? `
    <!-- Project Timeline -->
    <div class="section">
      <h3>Project Timeline</h3>
      <div class="section-content">
        ${bidData.timeline}
      </div>
    </div>
    ` : ''}
    
    ${bidData.pricing ? `
    <!-- Pricing -->
    <div class="section">
      <h3>Investment Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${bidData.pricing.items.map(item => `
          <tr>
            <td>${item.description}</td>
            <td class="amount">${formatCurrency(item.amount)}</td>
          </tr>
          `).join('')}
          <tr>
            <td><strong>Subtotal</strong></td>
            <td class="amount"><strong>${formatCurrency(bidData.pricing.subtotal)}</strong></td>
          </tr>
          ${bidData.pricing.contingency ? `
          <tr>
            <td>Contingency (${((bidData.pricing.contingency / bidData.pricing.subtotal) * 100).toFixed(0)}%)</td>
            <td class="amount">${formatCurrency(bidData.pricing.contingency)}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td><strong>Total Investment</strong></td>
            <td class="amount"><strong>${formatCurrency(bidData.pricing.total)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    ` : ''}
    
    ${includeValuePropositions ? `
    <!-- Why Choose Us -->
    <div class="section">
      <h3>Why Choose ${activeConfig.name}</h3>
      <div class="value-props">
        ${defaultValuePropositions.slice(0, 6).map(prop => `
        <div class="value-prop">
          <span class="icon">✓</span>
          <span>${prop}</span>
        </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${includeCertifications ? `
    <!-- Certifications -->
    <div class="section">
      <h3>Certifications & Qualifications</h3>
      <div class="certifications">
        ${activeConfig.certifications.map(cert => `
        <span class="cert-badge">${cert}</span>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${includeInsurance ? `
    <!-- Insurance & Bonding -->
    <div class="section">
      <h3>Insurance & Bonding</h3>
      <div class="section-content">
        <ul>
          <li><strong>General Liability:</strong> ${activeConfig.insurance.generalLiability}</li>
          <li><strong>Workers' Compensation:</strong> ${activeConfig.insurance.workersComp}</li>
          <li><strong>Bonding Capacity:</strong> ${activeConfig.insurance.bondingCapacity}</li>
        </ul>
      </div>
    </div>
    ` : ''}
    
    ${bidData.customSections?.map(section => `
    <!-- Custom Section: ${section.title} -->
    <div class="section">
      <h3>${section.title}</h3>
      <div class="section-content">
        ${section.content}
      </div>
    </div>
    `).join('') || ''}
    
    ${includeTerms ? `
    <!-- Terms & Conditions -->
    <div class="section">
      <h3>Terms & Conditions</h3>
      <div class="section-content">
        <ol>
          ${activeConfig.defaultTerms.map(term => `
          <li>${term}</li>
          `).join('')}
        </ol>
      </div>
    </div>
    ` : ''}
    
    <!-- Signature Block -->
    <div class="signature-block">
      <div>
        <p><strong>Submitted by:</strong></p>
        <p>${activeConfig.defaultRep.name}<br>
        ${activeConfig.defaultRep.title}<br>
        ${activeConfig.defaultRep.email}<br>
        ${activeConfig.defaultRep.phone}</p>
        <div class="signature-area">
          <div class="signature-label">Authorized Signature & Date</div>
        </div>
      </div>
      <div>
        <p><strong>Accepted by:</strong></p>
        <p>${bidData.clientName}</p>
        <div class="signature-area">
          <div class="signature-label">Client Signature & Date</div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>${activeConfig.name} | License #${activeConfig.licenseNumber}</p>
      <p>${activeConfig.website}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function wrapContentInTemplate(
  content: string,
  projectName: string,
  clientName: string,
  options: TemplateOptions = {},
  companyConfigOverride?: CompanyConfig
): string {
  const activeConfig = companyConfigOverride || companyConfig;
  
  const bidData: BidData = {
    projectName,
    clientName,
  };
  
  const templateStart = generateBidTemplate(bidData, options, activeConfig).split('<!-- Executive Summary -->')[0];
  const templateEnd = `
    <!-- Generated Content -->
    <div class="section">
      <h3>Detailed Proposal</h3>
      <div class="section-content">
        ${content}
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>${activeConfig.name} | License #${activeConfig.licenseNumber}</p>
      <p>${activeConfig.website}</p>
    </div>
  </div>
</body>
</html>`;

  return templateStart + templateEnd;
}
