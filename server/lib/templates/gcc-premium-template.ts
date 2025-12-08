import { companyConfig, formatCurrency, formatDate, generateProposalNumber, calculateValidityDate, type CompanyConfig } from '../../config/company';

export interface PremiumBidData {
  projectName: string;
  clientName: string;
  clientContact?: string;
  projectDescription?: string;
  proposalNumber?: string;
  validUntil?: Date;
  validityDays?: number;
  aiGeneratedContent?: string;
  stats?: Array<{ value: string; label: string }>;
  qualifications?: Array<string>;
  riskMitigation?: Array<{ risk: string; solution: string }>;
  pricing?: {
    items: Array<{ category: string; description: string; amount: number }>;
    total: number;
  };
  caseStudy?: {
    title: string;
    client: string;
    location: string;
    value: string;
    description: string;
    achievements: Array<string>;
  };
  contactPerson?: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
}

export interface PremiumTemplateOptions {
  includeStats?: boolean;
  includeQualifications?: boolean;
  includeRiskMatrix?: boolean;
  includePricing?: boolean;
  includeCaseStudy?: boolean;
  includeContactCTA?: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function generateGCCPremiumTemplate(
  bidData: PremiumBidData,
  options: PremiumTemplateOptions = {},
  companyConfigOverride?: CompanyConfig
): string {
  const activeConfig = companyConfigOverride || companyConfig;
  
  const {
    includeStats = true,
    includeQualifications = true,
    includeRiskMatrix = true,
    includePricing = true,
    includeCaseStudy = false,
    includeContactCTA = true,
  } = options;

  const proposalNumber = bidData.proposalNumber || generateProposalNumber(Math.floor(Math.random() * 1000));
  const validityDays = bidData.validityDays || 60;
  const validUntil = bidData.validUntil || calculateValidityDate(validityDays);

  const defaultStats = bidData.stats || [
    { value: '100%', label: 'Safety Compliance Record' },
    { value: '0', label: 'Litigation / Claims History' },
    { value: '98.5%', label: 'On-Time Delivery Rate' },
    { value: '$50M+', label: 'Bonding Capacity' },
  ];

  const defaultQualifications = bidData.qualifications || [
    '<strong>ISO 9001:2015</strong> Quality Management Systems Certified',
    '<strong>OSHA 30</strong> Certified Site Supervisors on All Projects',
    '<strong>LEED AP</strong> Accredited Professionals for Sustainable Design',
    `Bonding Capacity: <strong>${activeConfig.insurance.bondingCapacity}</strong>`,
    `Full Liability Insurance Coverage: <strong>${activeConfig.insurance.generalLiability}</strong>`,
    '<strong>Zero Lost-Time Incidents</strong> in the Past 36 Months',
  ];

  const defaultRiskMatrix = bidData.riskMitigation || [
    { risk: 'Material Supply Chain Delays', solution: '3-Week Rolling Lookahead + Pre-Approved Alternate Vendors' },
    { risk: 'Adverse Weather Conditions', solution: 'Built-in Schedule Float + Weatherization Protocols' },
    { risk: 'Budget Variance & Scope Creep', solution: 'Guaranteed Maximum Price (GMP) with Change Order Controls' },
    { risk: 'Permitting & Regulatory Delays', solution: 'Pre-Construction Agency Engagement + Expeditor Services' },
    { risk: 'Labor Availability', solution: 'Multi-Union Agreements + Pre-Qualified Workforce Database' },
  ];

  const contactPerson = bidData.contactPerson || {
    name: activeConfig.defaultRep.name,
    title: activeConfig.defaultRep.title,
    phone: activeConfig.defaultRep.phone,
    email: activeConfig.defaultRep.email,
  };

  let sectionNumber = 1;

  const statsSection = includeStats ? `
    <div class="stats-grid">
      ${defaultStats.map(stat => `
        <div class="stat-card">
          <span class="stat-number">${stat.value}</span>
          <span class="stat-label">${stat.label}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const qualificationsSection = includeQualifications ? `
    <section>
      <div class="section-number">${String(sectionNumber++).padStart(2, '0')}</div>
      <span class="section-title">Qualifications & Compliance</span>
      <h3>Certifications & Safety Protocols</h3>
      <p>We maintain the highest levels of industry accreditation to ensure your project meets all regulatory standards and exceeds industry best practices.</p>
      
      <ul class="feature-list">
        ${defaultQualifications.map(qual => `<li>${qual}</li>`).join('')}
      </ul>

      <div class="alert-box">
        <strong>Risk Mitigation Strategy</strong>
        <p>We utilize a proprietary verification system for all subcontractors, ensuring financial stability, technical capability, and safety compliance—eliminating weak links in the supply chain before they impact your project.</p>
      </div>
    </section>
  ` : '';

  const riskMatrixSection = includeRiskMatrix ? `
    <section>
      <div class="section-number">${String(sectionNumber++).padStart(2, '0')}</div>
      <span class="section-title">Technical Approach</span>
      <h3>Methodology & Contingency Planning</h3>
      <p>Our approach minimizes disruption and ensures predictability through advanced project controls and proactive risk management.</p>
      
      <div class="risk-matrix">
        <div class="risk-header">Comprehensive Risk Mitigation Plan</div>
        ${defaultRiskMatrix.map(item => `
          <div class="risk-item">
            <span class="risk-label"><strong>Risk:</strong> ${item.risk}</span>
            <span class="risk-solution"><strong>Solution:</strong> ${item.solution}</span>
          </div>
        `).join('')}
      </div>
    </section>
  ` : '';

  const pricingSection = includePricing && bidData.pricing ? `
    <section>
      <div class="section-number">${String(sectionNumber++).padStart(2, '0')}</div>
      <span class="section-title">Financial Investment</span>
      <h3>Transparent Cost Breakdown</h3>
      <p>The following costs represent a "Hard Bid" with zero hidden fees. We believe in absolute financial transparency and accountability to ensure informed decision-making.</p>
      
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Cost Category</th>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${bidData.pricing.items.map(item => `
              <tr>
                <td>${item.category}</td>
                <td>${item.description}</td>
                <td>${formatCurrency(item.amount)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">TOTAL PROJECT COST</td>
              <td>${formatCurrency(bidData.pricing.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  ` : '';

  const caseStudySection = includeCaseStudy && bidData.caseStudy ? `
    <section>
      <div class="section-number">${String(sectionNumber++).padStart(2, '0')}</div>
      <span class="section-title">Proven Track Record</span>
      <h3>Recent Success Stories</h3>
      
      <div class="case-study">
        <div class="case-study-header">
          <div class="case-study-title">${bidData.caseStudy.title}</div>
          <div class="case-study-badge">Similar Scope</div>
        </div>
        <p><strong>Client:</strong> ${bidData.caseStudy.client} | <strong>Location:</strong> ${bidData.caseStudy.location} | <strong>Value:</strong> ${bidData.caseStudy.value}</p>
        <p>${bidData.caseStudy.description}</p>
        ${bidData.caseStudy.achievements.length > 0 ? `
          <p style="margin-top: 20px;"><strong>Key Achievements:</strong></p>
          <ul class="feature-list">
            ${bidData.caseStudy.achievements.map(ach => `<li>${ach}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    </section>
  ` : '';

  const ctaSection = includeContactCTA ? `
    <section class="cta-section">
      <div class="cta-content">
        <h3>Ready to Begin Your Vision</h3>
        <p>We are prepared to mobilize our team within <strong>14 days</strong> of contract signature, with full site setup and procurement initiated. Our commitment extends beyond construction—we partner with you to create lasting value.</p>
        
        <div class="contact-info">
          <strong>${contactPerson.name}</strong>
          ${contactPerson.title}<br>
          Direct: ${contactPerson.phone}<br>
          Email: ${contactPerson.email}
        </div>
      </div>
    </section>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Premium Proposal - ${bidData.projectName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --primary-gradient: linear-gradient(135deg, #0a4d3c 0%, #0d6e58 50%, #10b981 100%);
      --secondary-gradient: linear-gradient(135deg, #1e3a5f 0%, #2c5282 50%, #3b82f6 100%);
      --accent-gold-primary: #d4af37;
      --accent-gold-light: #f4c430;
      --accent-gold-dark: #b8860b;
      --accent-emerald: #10b981;
      --accent-emerald-dark: #059669;
      --burgundy: #8b2942;
      --burgundy-light: #a53860;
      --royal-blue: #1e40af;
      --text-primary: #2c2416;
      --text-secondary: #6b5a3d;
      --text-light: #9c8a6b;
      --bg-main: #faf8f5;
      --bg-cream: #f5f1ea;
      --white: #ffffff;
      --glass-bg: rgba(255, 255, 255, 0.75);
      --glass-border: rgba(212, 175, 55, 0.25);
      --shadow-sm: 0 2px 8px rgba(139, 41, 66, 0.06);
      --shadow-md: 0 4px 20px rgba(212, 175, 55, 0.12);
      --shadow-lg: 0 10px 40px rgba(139, 41, 66, 0.15);
      --shadow-xl: 0 20px 60px rgba(212, 175, 55, 0.2);
      --shadow-gold: 0 8px 32px rgba(212, 175, 55, 0.3);
      --font-display: 'Playfair Display', Georgia, serif;
      --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-body);
      color: var(--text-primary);
      line-height: 1.7;
      background: var(--bg-main);
      overflow-x: hidden;
      position: relative;
    }

    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: 
        radial-gradient(circle at 20% 20%, rgba(212, 175, 55, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(139, 41, 66, 0.05) 0%, transparent 60%),
        linear-gradient(135deg, #faf8f5 0%, #f5f1ea 100%);
      z-index: -1;
      animation: backgroundShift 25s ease infinite;
    }

    body::after {
      content: '';
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-image: 
        repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(212, 175, 55, 0.02) 35px, rgba(212, 175, 55, 0.02) 70px),
        repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(16, 185, 129, 0.02) 35px, rgba(16, 185, 129, 0.02) 70px);
      z-index: -1;
      opacity: 0.6;
    }

    @keyframes backgroundShift {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.95; }
    }

    .container { max-width: 1100px; margin: 0 auto; position: relative; }

    header {
      background: var(--primary-gradient);
      position: relative;
      overflow: hidden;
      padding: 80px 60px;
      margin: 40px 40px 0 40px;
      border-radius: 24px;
      box-shadow: var(--shadow-xl);
      border: 3px solid var(--accent-gold-primary);
    }

    header::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 120px; height: 120px;
      background: linear-gradient(135deg, var(--accent-gold-primary) 0%, transparent 70%);
      opacity: 0.3;
    }

    header::after {
      content: '';
      position: absolute;
      bottom: 0; right: 0;
      width: 120px; height: 120px;
      background: linear-gradient(-45deg, var(--accent-gold-primary) 0%, transparent 70%);
      opacity: 0.3;
    }

    .header-accent {
      position: absolute;
      top: 50%; right: 10%;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(244, 196, 48, 0.25) 0%, transparent 70%);
      animation: float 15s ease-in-out infinite;
      pointer-events: none;
    }

    @keyframes float {
      0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
      33% { transform: translate(30px, -30px) rotate(120deg) scale(1.1); }
      66% { transform: translate(-20px, 20px) rotate(240deg) scale(0.9); }
    }

    .header-content {
      position: relative;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      overflow: hidden;
    }

    .company-branding {
      flex: 1;
      min-width: 0;
      max-width: 55%;
      overflow: hidden;
    }

    .company-branding h1 {
      color: var(--white);
      font-family: var(--font-display);
      font-size: clamp(24px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 8px;
      text-shadow: 0 4px 20px rgba(212, 175, 55, 0.4);
      animation: fadeInUp 0.8s ease;
      background: linear-gradient(135deg, #ffffff 0%, var(--accent-gold-light) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: break-word;
      hyphens: auto;
    }

    .company-tagline {
      color: var(--accent-gold-light);
      font-size: 13px;
      letter-spacing: 3px;
      text-transform: uppercase;
      font-weight: 600;
      animation: fadeInUp 0.8s ease 0.2s backwards;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .proposal-meta {
      text-align: right;
      color: rgba(255, 255, 255, 0.95);
      animation: fadeInUp 0.8s ease 0.4s backwards;
      flex-shrink: 0;
      min-width: 180px;
      max-width: 40%;
    }

    .proposal-meta .meta-title {
      font-size: 11px;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--accent-gold-light);
      margin-bottom: 12px;
      font-weight: 700;
    }

    .proposal-meta .meta-item {
      font-size: 14px;
      margin-bottom: 6px;
      font-weight: 400;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .content-wrapper { margin: 0 40px 40px 40px; }

    section {
      background: var(--white);
      margin-top: 30px;
      padding: 60px;
      border-radius: 20px;
      box-shadow: var(--shadow-md);
      position: relative;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      animation: fadeIn 0.6s ease backwards;
      border: 1px solid rgba(212, 175, 55, 0.15);
    }

    section:hover {
      box-shadow: var(--shadow-gold);
      transform: translateY(-4px);
      border-color: var(--accent-gold-primary);
    }

    section::before {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 80px; height: 80px;
      background: linear-gradient(-135deg, rgba(212, 175, 55, 0.1) 0%, transparent 70%);
      pointer-events: none;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .section-number {
      position: absolute;
      top: -15px; left: 60px;
      background: linear-gradient(135deg, var(--accent-gold-primary), var(--accent-gold-light));
      color: var(--white);
      width: 55px; height: 55px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      box-shadow: var(--shadow-gold);
      z-index: 10;
      border: 3px solid var(--white);
      font-family: var(--font-display);
    }

    .section-title {
      font-size: 12px;
      letter-spacing: 3px;
      text-transform: uppercase;
      background: linear-gradient(135deg, var(--accent-gold-dark), var(--accent-gold-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 800;
      margin-bottom: 16px;
      display: inline-block;
    }

    h2 {
      font-family: var(--font-display);
      font-size: 36px;
      background: linear-gradient(135deg, var(--burgundy), var(--burgundy-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 20px;
      font-weight: 800;
      line-height: 1.3;
    }

    h3 {
      font-family: var(--font-display);
      font-size: 28px;
      color: var(--text-primary);
      margin-bottom: 16px;
      font-weight: 700;
    }

    p {
      color: var(--text-secondary);
      font-size: 16px;
      margin-bottom: 16px;
      line-height: 1.8;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      margin-top: 40px;
    }

    .stat-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(245, 241, 234, 0.9));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 2px solid var(--accent-gold-primary);
      border-radius: 16px;
      padding: 32px;
      position: relative;
      overflow: hidden;
      transition: all 0.4s ease;
      box-shadow: var(--shadow-md);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 5px;
      background: linear-gradient(90deg, var(--accent-gold-primary), var(--accent-gold-light), var(--accent-emerald));
    }

    .stat-card::after {
      content: '';
      position: absolute;
      bottom: -50%; right: -50%;
      width: 150px; height: 150px;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, transparent 70%);
      transition: all 0.5s ease;
    }

    .stat-card:hover {
      transform: translateY(-10px) scale(1.02);
      box-shadow: var(--shadow-gold);
      border-color: var(--accent-gold-light);
    }

    .stat-number {
      font-size: 52px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-gold-dark), var(--accent-gold-light), var(--accent-emerald));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      display: block;
      margin-bottom: 8px;
      font-family: var(--font-display);
      position: relative;
      z-index: 2;
    }

    .stat-label {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-secondary);
      font-weight: 700;
      position: relative;
      z-index: 2;
    }

    .feature-list {
      list-style: none;
      margin-top: 24px;
    }

    .feature-list li {
      padding: 18px 24px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, var(--bg-cream) 0%, #faf8f5 100%);
      border-radius: 12px;
      border-left: 5px solid var(--accent-gold-primary);
      transition: all 0.3s ease;
      color: var(--text-primary);
      font-size: 15px;
      box-shadow: var(--shadow-sm);
      position: relative;
      overflow: hidden;
    }

    .feature-list li::before {
      content: '\u25C6';
      position: absolute;
      right: 20px; top: 50%;
      transform: translateY(-50%);
      color: var(--accent-gold-primary);
      font-size: 20px;
      opacity: 0.2;
    }

    .feature-list li:hover {
      transform: translateX(12px);
      box-shadow: var(--shadow-md);
      border-left-color: var(--accent-emerald);
      background: linear-gradient(135deg, #ffffff 0%, var(--bg-cream) 100%);
    }

    .feature-list li strong { color: var(--burgundy); font-weight: 700; }

    .alert-box {
      margin-top: 32px;
      padding: 28px 32px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(212, 175, 55, 0.08));
      border-radius: 16px;
      border: 2px solid var(--accent-gold-primary);
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-md);
    }

    .alert-box::after {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(45deg, transparent 30%, rgba(212, 175, 55, 0.05) 50%, transparent 70%);
      animation: shimmer 3s ease infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .alert-box strong {
      color: var(--accent-emerald-dark);
      font-weight: 800;
      font-size: 17px;
      position: relative;
      z-index: 2;
    }

    .alert-box p {
      margin: 8px 0 0 0;
      color: var(--text-primary);
      position: relative;
      z-index: 2;
    }

    .risk-matrix {
      margin-top: 32px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      border: 2px solid var(--accent-gold-primary);
    }

    .risk-header {
      background: linear-gradient(135deg, var(--burgundy), var(--burgundy-light));
      color: var(--white);
      padding: 24px 28px;
      font-weight: 800;
      font-size: 17px;
      letter-spacing: 1px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border-bottom: 3px solid var(--accent-gold-primary);
    }

    .risk-item {
      padding: 22px 28px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--white);
      transition: all 0.3s ease;
      position: relative;
    }

    .risk-item::before {
      content: '';
      position: absolute;
      left: 0; top: 0;
      width: 4px; height: 100%;
      background: linear-gradient(180deg, var(--accent-gold-primary), var(--accent-emerald));
      transform: scaleY(0);
      transition: transform 0.3s ease;
    }

    .risk-item:hover {
      background: linear-gradient(135deg, #faf8f5, #f5f1ea);
      transform: translateX(6px);
    }

    .risk-item:hover::before { transform: scaleY(1); }
    .risk-item:last-child { border-bottom: none; }
    .risk-label { font-weight: 700; color: var(--text-primary); }
    .risk-solution { color: var(--text-secondary); font-size: 14px; font-weight: 600; }

    .table-wrapper {
      margin-top: 32px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      border: 2px solid var(--accent-gold-primary);
    }

    table { width: 100%; border-collapse: collapse; }

    thead { background: linear-gradient(135deg, var(--accent-emerald-dark), var(--accent-emerald)); }

    th {
      color: var(--white);
      text-align: left;
      padding: 22px 28px;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border-bottom: 3px solid var(--accent-gold-primary);
    }

    th:last-child { text-align: right; }

    tbody tr {
      background: var(--white);
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      transition: all 0.3s ease;
    }

    tbody tr:hover {
      background: linear-gradient(135deg, #faf8f5, #f5f1ea);
      transform: scale(1.01);
    }

    td {
      padding: 20px 28px;
      color: var(--text-secondary);
      font-size: 15px;
    }

    td:first-child { color: var(--text-primary); font-weight: 700; }

    td:last-child {
      text-align: right;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-gold-dark), var(--accent-gold-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 16px;
    }

    .total-row {
      background: linear-gradient(135deg, var(--accent-gold-primary), var(--accent-gold-light)) !important;
      border-top: 4px solid var(--burgundy);
    }

    .total-row td {
      font-weight: 900;
      font-size: 20px;
      color: var(--white) !important;
      padding: 28px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      -webkit-text-fill-color: var(--white);
    }

    .case-study {
      margin-top: 32px;
      padding: 36px;
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(16, 185, 129, 0.04));
      border-radius: 16px;
      border: 2px solid var(--accent-gold-primary);
      position: relative;
      box-shadow: var(--shadow-md);
    }

    .case-study-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      position: relative;
      z-index: 2;
    }

    .case-study-title {
      font-family: var(--font-display);
      font-size: 24px;
      color: var(--burgundy);
      font-weight: 800;
    }

    .case-study-badge {
      background: linear-gradient(135deg, var(--accent-gold-primary), var(--accent-gold-light));
      color: var(--white);
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      box-shadow: var(--shadow-gold);
      border: 2px solid var(--white);
    }

    .cta-section {
      background: var(--primary-gradient);
      color: var(--white);
      position: relative;
      overflow: hidden;
      border: 3px solid var(--accent-gold-primary);
    }

    .cta-section::before {
      content: '';
      position: absolute;
      top: -30%; right: -10%;
      width: 400px; height: 400px;
      background: radial-gradient(circle, rgba(244, 196, 48, 0.25) 0%, transparent 70%);
      animation: float 12s ease-in-out infinite;
    }

    .cta-section::after {
      content: '';
      position: absolute;
      bottom: -20%; left: -5%;
      width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(212, 175, 55, 0.2) 0%, transparent 70%);
      animation: float 15s ease-in-out infinite reverse;
    }

    .cta-content { position: relative; z-index: 2; }

    .cta-content h3 {
      color: var(--white);
      font-size: 36px;
      margin-bottom: 20px;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      background: linear-gradient(135deg, var(--white), var(--accent-gold-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .cta-content p { color: rgba(255, 255, 255, 0.95); font-size: 16px; }

    .contact-info {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 2px solid var(--accent-gold-primary);
    }

    .contact-info strong {
      display: block;
      font-size: 20px;
      margin-bottom: 8px;
      color: var(--accent-gold-light);
      font-weight: 800;
    }

    footer {
      background: linear-gradient(135deg, var(--burgundy), var(--burgundy-light));
      color: rgba(255, 255, 255, 0.8);
      padding: 48px 60px;
      margin: 40px 40px 40px 40px;
      border-radius: 24px;
      text-align: center;
      font-size: 13px;
      box-shadow: var(--shadow-xl);
      border: 3px solid var(--accent-gold-primary);
      position: relative;
      overflow: hidden;
    }

    footer::before {
      content: '';
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent-gold-primary), transparent);
    }

    footer a {
      color: var(--accent-gold-light);
      text-decoration: none;
      transition: color 0.3s ease;
      font-weight: 600;
    }

    footer a:hover { color: var(--white); }

    .ai-content { margin-top: 24px; }
    .ai-content h1, .ai-content h2, .ai-content h3, .ai-content h4 {
      font-family: var(--font-display);
      color: var(--burgundy);
      margin-top: 24px;
      margin-bottom: 12px;
    }
    .ai-content ul, .ai-content ol {
      margin-left: 24px;
      margin-bottom: 16px;
      color: var(--text-secondary);
    }
    .ai-content li { margin-bottom: 8px; }
    .ai-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }
    .ai-content table th, .ai-content table td {
      padding: 12px 16px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      text-align: left;
    }
    .ai-content table th {
      background: linear-gradient(135deg, var(--accent-emerald-dark), var(--accent-emerald));
      color: white;
    }

    @media (max-width: 768px) {
      header, section, footer { margin: 20px; padding: 40px 30px; }
      .header-content { flex-direction: column; align-items: flex-start; }
      .proposal-meta { text-align: left; margin-top: 24px; }
      .company-branding h1 { font-size: 32px; }
      h2 { font-size: 28px; }
      h3 { font-size: 22px; }
      .stats-grid { grid-template-columns: 1fr; }
      .risk-item { flex-direction: column; align-items: flex-start; }
      .risk-solution { margin-top: 8px; }
      .content-wrapper { margin: 0 20px 20px 20px; }
      .section-number { left: 30px; }
    }

    @media print {
      body::before, body::after { display: none; }
      header, section, footer { box-shadow: none; margin: 0; page-break-inside: avoid; border: 1px solid #ccc; }
      section:hover { transform: none; }
    }

    html { scroll-behavior: smooth; }
    ::selection { background: var(--accent-gold-primary); color: var(--white); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="header-accent"></div>
      <div class="header-content">
        <div class="company-branding">
          <h1>${activeConfig.name.toUpperCase()}</h1>
          <div class="company-tagline">${activeConfig.tagline} | LIC #${activeConfig.licenseNumber}</div>
        </div>
        <div class="proposal-meta">
          <div class="meta-title">Response to RFP/RFQ</div>
          <div class="meta-item">Project: <strong>${bidData.projectName}</strong></div>
          <div class="meta-item">Date: <strong>${formatDate(new Date())}</strong></div>
          <div class="meta-item">Prepared for: <strong>${bidData.clientName}</strong></div>
          <div class="meta-item">Valid Until: <strong>${formatDate(validUntil)}</strong></div>
        </div>
      </div>
    </header>

    <div class="content-wrapper">
      <section>
        <div class="section-number">01</div>
        <span class="section-title">Executive Summary</span>
        <h2>Certainty of Delivery & Risk Mitigation</h2>
        <p>
          Thank you for the opportunity to present this proposal for the <strong>${bidData.projectName}</strong>. 
          At ${activeConfig.name}, we understand that safety, compliance, and budget adherence are not just goals—they are non-negotiable requirements that define project success.
        </p>
        ${bidData.aiGeneratedContent ? `
          <div class="ai-content">
            ${bidData.aiGeneratedContent}
          </div>
        ` : `
          <p>
            With extensive experience in commercial and industrial construction, our team focuses on minimizing project risk through rigorous pre-planning, transparent communication, and data-driven decision making. 
            This proposal outlines a comprehensive strategy that prioritizes operational excellence and stakeholder confidence.
          </p>
        `}
        ${statsSection}
      </section>

      ${qualificationsSection}
      ${riskMatrixSection}
      ${pricingSection}
      ${caseStudySection}
      ${ctaSection}
    </div>

    <footer>
      <strong style="color: var(--accent-gold-light); font-size: 15px; display: block; margin-bottom: 12px; letter-spacing: 2px;">${activeConfig.name.toUpperCase()}</strong>
      &copy; ${new Date().getFullYear()} ${activeConfig.name}. All Rights Reserved.<br>
      ${activeConfig.address} | ${activeConfig.city}, ${activeConfig.state} ${activeConfig.zip}<br>
      <a href="${activeConfig.website}">${activeConfig.website}</a> | License #${activeConfig.licenseNumber}
    </footer>
  </div>
</body>
</html>`;
}

export function wrapContentInPremiumTemplate(
  aiContent: string,
  projectName: string,
  clientName: string,
  options: PremiumTemplateOptions = {},
  companyConfigOverride?: CompanyConfig
): string {
  return generateGCCPremiumTemplate(
    {
      projectName,
      clientName,
      aiGeneratedContent: aiContent,
    },
    options,
    companyConfigOverride
  );
}
