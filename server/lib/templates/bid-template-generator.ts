import { companyConfig, formatCurrency, formatDate, generateProposalNumber, calculateValidityDate, defaultValuePropositions, type CompanyConfig } from '../../config/company';
import { db } from '../../db';
import { companies, users } from '@shared/schema';
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
        logoUrl: company.logo || settings.logoUrl || companyConfig.logoUrl,
      };
    }
    
    return {
      ...companyConfig,
      name: company?.name || companyConfig.name,
      logoUrl: company?.logo || companyConfig.logoUrl,
    };
  } catch (error) {
    console.error('Failed to load company config:', error);
    return companyConfig;
  }
}

export async function getUserBrandingConfig(userId: number | null): Promise<CompanyConfig | null> {
  if (!userId) {
    return null;
  }
  
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (user?.brandingProfile && typeof user.brandingProfile === 'object') {
      const branding = user.brandingProfile as Record<string, any>;
      return {
        ...companyConfig,
        name: branding.companyName || companyConfig.name,
        primaryColor: branding.primaryColor || companyConfig.primaryColor,
        logoUrl: branding.logoUrl || companyConfig.logoUrl,
        website: branding.websiteUrl || companyConfig.website,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Failed to load user branding config:', error);
    return null;
  }
}

export interface BidData {
  projectName: string;
  clientName: string;
  clientContact?: string;
  projectDescription?: string;
  scope?: string;
  timeline?: string;
  rfpReference?: string;
  pricing?: {
    items: Array<{ description: string; amount: number; duration?: string }>;
    subtotal: number;
    contingency?: number;
    total: number;
  };
  proposalNumber?: string;
  validUntil?: Date;
  validityDays?: number;
  customSections?: Array<{ title: string; content: string }>;
  teamMembers?: Array<{ name: string; role: string; initials?: string }>;
  projectTimeline?: Array<{ phase: string; duration: string; description?: string }>;
  highlights?: Array<{ value: string; label: string }>;
  executiveSummary?: string;
  aboutUs?: string;
  coreCompetencies?: Array<{ title: string; description: string }>;
  references?: Array<{ company: string; project: string; contact?: string }>;
}

export interface TemplateOptions {
  includeValuePropositions?: boolean;
  includeTerms?: boolean;
  includeCertifications?: boolean;
  includeInsurance?: boolean;
  includeSafety?: boolean;
  includeCoverPage?: boolean;
  includeTableOfContents?: boolean;
  includeTeamSection?: boolean;
  includeTimeline?: boolean;
  includeReferences?: boolean;
  customLogo?: string;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
}

function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function generateProfessionalBidTemplate(
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
    includeCoverPage = true,
    includeTableOfContents = true,
    includeTeamSection = true,
    includeTimeline = true,
    includeReferences = false,
    customColors = {},
  } = options;

  const colors = {
    primary: customColors.primary || activeConfig.primaryColor,
    secondary: customColors.secondary || activeConfig.secondaryColor || activeConfig.primaryColor,
    accent: customColors.accent || activeConfig.accentColor || activeConfig.primaryColor,
  };

  const primaryDark = darkenColor(colors.primary, 25);
  const primaryLight = lightenColor(colors.primary, 85);

  const proposalNumber = bidData.proposalNumber || generateProposalNumber(Math.floor(Math.random() * 1000));
  const validityDays = bidData.validityDays || 60;
  const validUntil = bidData.validUntil || calculateValidityDate(validityDays);
  const rfpReference = bidData.rfpReference || `#${new Date().getFullYear()}-${proposalNumber}`;

  const defaultHighlights = bidData.highlights || [
    { value: '99.9%', label: 'Project Success Rate' },
    { value: '24/7', label: 'Support Coverage' },
    { value: '500+', label: 'Completed Projects' },
    { value: '25+', label: 'Years Experience' },
  ];

  const defaultTeam = bidData.teamMembers || [
    { name: activeConfig.defaultRep.name, role: activeConfig.defaultRep.title },
    { name: 'Project Manager', role: 'Project Leadership' },
    { name: 'Technical Lead', role: 'Technical Oversight' },
  ];

  const defaultTimeline = bidData.projectTimeline || [
    { phase: 'Phase 1: Discovery & Planning', duration: '2 weeks' },
    { phase: 'Phase 2: Implementation', duration: '6 weeks' },
    { phase: 'Phase 3: Testing & Quality Assurance', duration: '2 weeks' },
    { phase: 'Phase 4: Deployment & Training', duration: '2 weeks' },
  ];

  const defaultCoreCompetencies = bidData.coreCompetencies || [
    { title: 'Project Management', description: 'End-to-end project delivery with proven methodologies and on-time completion track record.' },
    { title: 'Quality Assurance', description: 'Rigorous quality control processes ensuring exceptional deliverables and client satisfaction.' },
    { title: 'Technical Expertise', description: 'Deep industry knowledge with certified professionals across all disciplines.' },
    { title: 'Client Partnership', description: 'Collaborative approach with transparent communication and dedicated support.' },
  ];

  let pageNumber = 1;

  const coverPage = includeCoverPage ? `
    <!-- COVER PAGE -->
    <div class="cover-page">
      <div class="cover-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          ${activeConfig.logoUrl && activeConfig.logoUrl !== '/images/company-logo.png' ? 
            `<img src="${activeConfig.logoUrl}" alt="${activeConfig.name}" style="height: 50px; max-width: 150px; object-fit: contain; filter: brightness(0) invert(1);">` :
            `<div style="width: 50px; height: 50px; background: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--primary-color);">
              ${getInitials(activeConfig.name)}
            </div>`
          }
          <div>
            <div style="font-size: 1.5em; font-weight: bold;">${activeConfig.name}</div>
            <div style="font-size: 0.9em; opacity: 0.9;">${activeConfig.tagline}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.9em; opacity: 0.9;">RFP Reference</div>
          <div style="font-size: 1.2em; font-weight: bold;">${rfpReference}</div>
        </div>
      </div>

      <div class="cover-content">
        <div class="rfp-title">
          ${bidData.projectName}
        </div>
        <div class="rfp-subtitle">
          ${bidData.projectDescription || 'Comprehensive Professional Proposal'}
        </div>

        <div class="client-info">
          <h3>Prepared For</h3>
          <div style="font-size: 1.4em; font-weight: bold; margin: 10px 0;">${bidData.clientName}</div>
          ${bidData.clientContact ? `<div style="opacity: 0.9;">Attention: ${bidData.clientContact}</div>` : ''}
          <div style="opacity: 0.9; margin-top: 20px;">${formatDate(new Date())}</div>
        </div>
      </div>

      <div class="cover-footer">
        <div>
          <div style="font-weight: bold; margin-bottom: 5px;">Valid Until</div>
          <div>${formatDate(validUntil)} (${validityDays} days)</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold; margin-bottom: 5px;">Contact</div>
          <div>${activeConfig.email}</div>
          <div>${activeConfig.website}</div>
        </div>
      </div>
    </div>
  ` : '';

  const tableOfContents = includeTableOfContents ? `
    <!-- TABLE OF CONTENTS -->
    <div class="content-page">
      <div class="page-header">
        <h1>Table of Contents</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div style="line-height: 2.5;">
        <div class="toc-item">
          <span><strong>1.</strong> Executive Summary</span>
          <span>${pageNumber}</span>
        </div>
        <div class="toc-item">
          <span><strong>2.</strong> Company Overview</span>
          <span>${pageNumber + 1}</span>
        </div>
        <div class="toc-item">
          <span><strong>3.</strong> Understanding Your Requirements</span>
          <span>${pageNumber + 2}</span>
        </div>
        <div class="toc-item">
          <span><strong>4.</strong> Proposed Solution</span>
          <span>${pageNumber + 3}</span>
        </div>
        ${includeTimeline ? `
        <div class="toc-item">
          <span><strong>5.</strong> Implementation Timeline</span>
          <span>${pageNumber + 4}</span>
        </div>
        ` : ''}
        ${includeTeamSection ? `
        <div class="toc-item">
          <span><strong>6.</strong> Project Team</span>
          <span>${pageNumber + 5}</span>
        </div>
        ` : ''}
        <div class="toc-item">
          <span><strong>7.</strong> Investment & Pricing</span>
          <span>${pageNumber + 6}</span>
        </div>
        ${includeTerms ? `
        <div class="toc-item">
          <span><strong>8.</strong> Terms & Conditions</span>
          <span>${pageNumber + 7}</span>
        </div>
        ` : ''}
      </div>
    </div>
  ` : '';

  const highlightsSection = `
    <div class="highlights">
      ${defaultHighlights.map(h => `
        <div class="highlight-card">
          <div class="highlight-number">${h.value}</div>
          <div class="highlight-label">${h.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  const coreCompetenciesSection = `
    <div class="section">
      <h2>Our Core Competencies</h2>
      <div class="competencies-grid">
        ${defaultCoreCompetencies.map(comp => `
          <div class="competency-item">
            <h3 style="font-size: 1.1em; margin-top: 0;">${comp.title}</h3>
            <p>${comp.description}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const timelineSection = includeTimeline ? `
    <div class="content-page">
      <div class="page-header">
        <h1>Implementation Timeline</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="section">
        <h2>Project Phases</h2>
        <div class="timeline">
          ${defaultTimeline.map((item, idx) => `
            <div class="timeline-item">
              <h4>${item.phase}</h4>
              <div class="duration">${item.duration}</div>
              ${item.description ? `<p style="margin-top: 10px; color: var(--text-gray);">${item.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';

  const teamSection = includeTeamSection ? `
    <div class="content-page">
      <div class="page-header">
        <h1>Project Team</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="section">
        <h2>Your Dedicated Team</h2>
        <p>We have assembled a team of experienced professionals who will be dedicated to the success of your project.</p>
        
        <div class="team-grid">
          ${defaultTeam.map(member => `
            <div class="team-member">
              <div class="team-member-avatar">${member.initials || getInitials(member.name)}</div>
              <h4>${member.name}</h4>
              <div class="role">${member.role}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';

  const pricingSection = bidData.pricing ? `
    <div class="content-page">
      <div class="page-header">
        <h1>Investment & Pricing</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="section">
        <h2>Project Investment Summary</h2>

        <table class="pricing-table">
          <thead>
            <tr>
              <th>Service Component</th>
              <th>Description</th>
              ${bidData.pricing.items.some(item => item.duration) ? '<th>Duration</th>' : ''}
              <th style="text-align: right;">Investment</th>
            </tr>
          </thead>
          <tbody>
            ${bidData.pricing.items.map(item => `
              <tr>
                <td><strong>${item.description}</strong></td>
                <td>${item.description}</td>
                ${bidData.pricing!.items.some(i => i.duration) ? `<td>${item.duration || '-'}</td>` : ''}
                <td style="text-align: right;">${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            ${bidData.pricing.contingency ? `
              <tr style="background: var(--primary-color); font-size: 1em;">
                <td colspan="${bidData.pricing.items.some(i => i.duration) ? 3 : 2}">Contingency</td>
                <td style="text-align: right;">${formatCurrency(bidData.pricing.contingency)}</td>
              </tr>
            ` : ''}
            <tr>
              <td colspan="${bidData.pricing.items.some(i => i.duration) ? 3 : 2}"><strong>Total Investment</strong></td>
              <td style="text-align: right;"><strong>${formatCurrency(bidData.pricing.total)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  ` : '';

  const certificationsSection = includeCertifications ? `
    <div class="section">
      <h2>Certifications & Qualifications</h2>
      <div class="certifications">
        ${activeConfig.certifications.map(cert => `
          <span class="cert-badge">${cert}</span>
        `).join('')}
      </div>
    </div>
  ` : '';

  const insuranceSection = includeInsurance ? `
    <div class="section">
      <h2>Insurance & Bonding</h2>
      <div class="section-content">
        <ul>
          <li><strong>General Liability:</strong> ${activeConfig.insurance.generalLiability}</li>
          <li><strong>Workers' Compensation:</strong> ${activeConfig.insurance.workersComp}</li>
          <li><strong>Bonding Capacity:</strong> ${activeConfig.insurance.bondingCapacity}</li>
        </ul>
      </div>
    </div>
  ` : '';

  const termsSection = includeTerms ? `
    <div class="content-page">
      <div class="page-header">
        <h1>Terms & Conditions</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="section">
        <h2>General Terms</h2>
        <div class="section-content">
          <ol style="color: var(--text-gray); line-height: 2;">
            ${activeConfig.defaultTerms.map(term => `
              <li>${term}</li>
            `).join('')}
          </ol>
        </div>
      </div>

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
    </div>
  ` : '';

  const valuePropsSection = includeValuePropositions ? `
    <div class="section">
      <h3>Why Choose ${activeConfig.name}?</h3>
      <ul style="color: var(--text-gray); line-height: 2;">
        ${defaultValuePropositions.slice(0, 6).map(prop => `
          <li><strong>✓</strong> ${prop}</li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RFP Response - ${bidData.projectName}</title>
  <style>
    :root {
      --primary-color: ${colors.primary};
      --primary-dark: ${primaryDark};
      --primary-light: ${primaryLight};
      --text-dark: #1a1a1a;
      --text-gray: #4a5568;
      --border-color: #e2e8f0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: var(--text-dark);
      background: #f7fafc;
    }

    .page {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }

    /* Cover Page */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }

    .cover-header {
      padding: 40px 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
    }

    .cover-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      text-align: center;
    }

    .rfp-title {
      font-size: 3em;
      font-weight: bold;
      margin-bottom: 20px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }

    .rfp-subtitle {
      font-size: 1.5em;
      opacity: 0.95;
      margin-bottom: 40px;
    }

    .client-info {
      background: rgba(255,255,255,0.15);
      padding: 30px;
      border-radius: 12px;
      backdrop-filter: blur(10px);
      max-width: 600px;
      margin: 0 auto;
    }

    .client-info h3 {
      font-size: 1.3em;
      margin-bottom: 15px;
    }

    .cover-footer {
      padding: 40px 60px;
      background: rgba(0,0,0,0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Content Pages */
    .content-page {
      padding: 60px;
      min-height: 100vh;
    }

    .page-header {
      border-bottom: 4px solid var(--primary-color);
      padding-bottom: 20px;
      margin-bottom: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .page-header h1 {
      color: var(--primary-color);
      font-size: 2.5em;
    }

    .page-number {
      color: var(--text-gray);
      font-size: 0.9em;
    }

    .section {
      margin-bottom: 50px;
    }

    .section h2 {
      color: var(--primary-color);
      font-size: 1.8em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--primary-light);
    }

    .section h3 {
      color: var(--text-dark);
      font-size: 1.3em;
      margin: 25px 0 15px 0;
    }

    .section p {
      color: var(--text-gray);
      margin-bottom: 15px;
      text-align: justify;
    }

    /* Executive Summary Box */
    .executive-summary {
      background: var(--primary-light);
      border-left: 5px solid var(--primary-color);
      padding: 30px;
      border-radius: 8px;
      margin: 30px 0;
    }

    /* TOC Items */
    .toc-item {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px dotted var(--border-color);
    }

    /* Stats/Highlights */
    .highlights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 25px;
      margin: 30px 0;
    }

    .highlight-card {
      background: white;
      border: 2px solid var(--primary-color);
      border-radius: 10px;
      padding: 25px;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .highlight-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    }

    .highlight-number {
      font-size: 2.5em;
      font-weight: bold;
      color: var(--primary-color);
      margin-bottom: 10px;
    }

    .highlight-label {
      color: var(--text-gray);
      font-size: 0.95em;
    }

    /* Competencies Grid */
    .competencies-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 25px;
      margin-top: 20px;
    }

    .competency-item {
      border-left: 4px solid var(--primary-color);
      padding-left: 20px;
    }

    /* Pricing Table */
    .pricing-table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .pricing-table thead {
      background: var(--primary-color);
      color: white;
    }

    .pricing-table th,
    .pricing-table td {
      padding: 18px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .pricing-table tbody tr:hover {
      background: var(--primary-light);
    }

    .pricing-table tfoot {
      background: var(--primary-dark);
      color: white;
      font-weight: bold;
      font-size: 1.2em;
    }

    /* Timeline */
    .timeline {
      position: relative;
      padding-left: 40px;
      margin: 30px 0;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--primary-color);
    }

    .timeline-item {
      position: relative;
      margin-bottom: 30px;
      padding-left: 30px;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: -43px;
      top: 5px;
      width: 15px;
      height: 15px;
      border-radius: 50%;
      background: var(--primary-color);
      border: 3px solid white;
      box-shadow: 0 0 0 3px var(--primary-color);
    }

    .timeline-item h4 {
      color: var(--primary-color);
      font-size: 1.1em;
      margin-bottom: 5px;
    }

    .timeline-item .duration {
      color: var(--text-gray);
      font-size: 0.9em;
      font-style: italic;
    }

    /* Team Section */
    .team-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 30px;
      margin: 30px 0;
    }

    .team-member {
      background: white;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 25px;
      text-align: center;
      transition: box-shadow 0.3s ease;
    }

    .team-member:hover {
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }

    .team-member-avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: var(--primary-light);
      border: 3px solid var(--primary-color);
      margin: 0 auto 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2em;
      font-weight: bold;
      color: var(--primary-color);
    }

    .team-member h4 {
      color: var(--text-dark);
      margin-bottom: 5px;
    }

    .team-member .role {
      color: var(--primary-color);
      font-size: 0.9em;
      margin-bottom: 10px;
    }

    /* Certifications */
    .certifications {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .cert-badge {
      background: var(--primary-color);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9em;
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

    .signature-label {
      font-size: 12px;
      color: #666;
    }

    /* Footer */
    .page-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--text-gray);
      font-size: 0.85em;
    }

    /* Lists */
    ul, ol {
      padding-left: 25px;
    }

    li {
      margin-bottom: 8px;
    }

    /* Print Styles */
    @media print {
      .page {
        box-shadow: none;
      }
      .cover-page {
        page-break-after: always;
      }
      .content-page {
        page-break-after: always;
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .cover-header,
      .cover-content,
      .content-page {
        padding: 30px;
      }

      .rfp-title {
        font-size: 2em;
      }

      .page-header h1 {
        font-size: 1.8em;
      }

      .highlights {
        grid-template-columns: 1fr 1fr;
      }

      .competencies-grid {
        grid-template-columns: 1fr;
      }

      .team-grid {
        grid-template-columns: 1fr;
      }

      .signature-block {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${coverPage}

    ${tableOfContents}

    <!-- EXECUTIVE SUMMARY -->
    <div class="content-page">
      <div class="page-header">
        <h1>Executive Summary</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="executive-summary">
        <h2 style="color: var(--primary-color); margin-top: 0;">Our Commitment to Your Success</h2>
        <p style="font-size: 1.1em; line-height: 1.8;">
          ${bidData.executiveSummary || `${activeConfig.name} is pleased to submit this comprehensive proposal for ${bidData.clientName}'s ${bidData.projectName} requirements. With extensive experience delivering exceptional solutions, we understand the critical importance of quality, reliability, and value.`}
        </p>
        <p style="font-size: 1.1em; line-height: 1.8;">
          Our proposed solution addresses all your stated requirements while providing additional value through our proven methodologies, dedicated support infrastructure, and commitment to excellence. We're confident this partnership will deliver outstanding results.
        </p>
      </div>

      ${highlightsSection}

      ${valuePropsSection}
    </div>

    <!-- COMPANY OVERVIEW -->
    <div class="content-page">
      <div class="page-header">
        <h1>Company Overview</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      <div class="section">
        <h2>About ${activeConfig.name}</h2>
        <p>
          ${bidData.aboutUs || `${activeConfig.name} is a trusted provider of professional services, specializing in delivering exceptional results for our clients. Our mission is to empower organizations to achieve their goals through innovative solutions, expert guidance, and unwavering commitment to operational excellence.`}
        </p>
        <p>
          We believe that successful partnerships go beyond technical delivery—they require a strategic partner who understands your business objectives and delivers measurable outcomes. That's why we're committed to building long-term relationships based on trust, transparency, and mutual success.
        </p>
      </div>

      ${coreCompetenciesSection}

      ${certificationsSection}
    </div>

    <!-- PROPOSED SOLUTION -->
    <div class="content-page">
      <div class="page-header">
        <h1>Proposed Solution</h1>
        <div class="page-number">Page ${pageNumber++}</div>
      </div>

      ${bidData.scope ? `
      <div class="section">
        <h2>Scope of Work</h2>
        <div class="section-content">
          ${bidData.scope}
        </div>
      </div>
      ` : `
      <div class="section">
        <h2>Our Approach</h2>
        <p>
          We have carefully reviewed your requirements and developed a comprehensive solution designed to meet and exceed your expectations. Our approach combines industry best practices with innovative techniques to deliver exceptional results.
        </p>
      </div>
      `}

      ${bidData.customSections?.map(section => `
      <div class="section">
        <h2>${section.title}</h2>
        <div class="section-content">
          ${section.content}
        </div>
      </div>
      `).join('') || ''}

      ${insuranceSection}
    </div>

    ${timelineSection}

    ${teamSection}

    ${pricingSection}

    ${termsSection}

    <!-- FOOTER -->
    <div class="page-footer" style="padding: 30px 60px;">
      <p>${activeConfig.name} | License #${activeConfig.licenseNumber}</p>
      <p>${activeConfig.website}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateBidTemplate(
  bidData: BidData,
  options: TemplateOptions = {},
  companyConfigOverride?: CompanyConfig
): string {
  return generateProfessionalBidTemplate(bidData, options, companyConfigOverride);
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
    customSections: [
      { title: 'Detailed Proposal', content }
    ]
  };
  
  return generateProfessionalBidTemplate(bidData, {
    ...options,
    includeCoverPage: true,
    includeTableOfContents: true,
  }, activeConfig);
}
