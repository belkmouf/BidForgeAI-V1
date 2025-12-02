import { openai } from './openai';
import { storage } from '../storage';
import type { RFPAnalysis, AnalysisAlert, Vendor } from '@shared/schema';

interface AnalysisResult {
  qualityScore: number;
  doabilityScore: number;
  clarityScore: number;
  vendorRiskScore: number;
  overallRiskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  
  issues: {
    missingDocuments: string[];
    unclearRequirements: Array<{ section: string; issue: string }>;
    redFlags: Array<{ type: string; severity: string; description: string; action: string }>;
  };
  
  opportunities: Array<{ type: string; description: string; benefit: string }>;
  recommendations: Array<{ action: string; priority: string; details: string; estimatedTime: string }>;
  
  vendorInfo?: {
    name: string;
    paymentRating: string;
    paymentHistory?: {
      averagePaymentDays: number;
      onTimeRate: number;
      totalProjects: number;
      disputedPayments: number;
    };
  };
  
  alerts: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    action: string;
  }>;
}

const ANALYSIS_PROMPT = `You are an expert construction bid analyst. Analyze the following RFP documents and provide a comprehensive risk assessment.

Evaluate:
1. Document Quality (0-100): Are all required documents present? Are they complete and well-formatted?
2. Requirement Clarity (0-100): Are project requirements, scope, and deliverables clearly defined?
3. Doability (0-100): Given typical construction company capabilities, how feasible is this project?
4. Vendor/Client Risk (0-100): Based on the client name and any payment terms mentioned, assess risk (100 = high risk).

Look for:
- Missing critical documents (drawings, specifications, BOQ, insurance requirements)
- Unclear or ambiguous requirements
- Unrealistic timelines or budgets
- One-sided contract terms
- Opportunities to differentiate or add value

Return a JSON object with this exact structure:
{
  "quality_score": number,
  "clarity_score": number,
  "doability_score": number,
  "vendor_risk_score": number,
  "overall_risk_level": "Low" | "Medium" | "High" | "Critical",
  "missing_documents": ["string"],
  "unclear_requirements": [{"section": "string", "issue": "string"}],
  "red_flags": [{"type": "string", "severity": "Low|Medium|High|Critical", "description": "string", "action": "string"}],
  "opportunities": [{"type": "string", "description": "string", "benefit": "string"}],
  "recommendations": [{"action": "string", "priority": "LOW|MEDIUM|HIGH|CRITICAL", "details": "string", "estimated_time": "string"}],
  "alerts": [{"type": "string", "severity": "Low|Medium|High|Critical", "title": "string", "description": "string", "action": "string"}]
}

Only return valid JSON, no additional text.`;

export async function analyzeRFP(projectId: string): Promise<AnalysisResult> {
  const projectDocs = await storage.listDocumentsByProject(projectId);
  
  if (projectDocs.length === 0) {
    throw new Error('No documents found for this project');
  }
  
  const chunks = await storage.getDocumentChunksForProject(projectId, 50);
  
  const documentContent = chunks.map(c => c.content).join('\n\n---\n\n');
  const documentList = projectDocs.map(d => `- ${d.filename}`).join('\n');
  
  const clientName = await getClientNameFromProject(projectId);
  const vendorData = clientName ? await storage.getVendorByName(clientName) : null;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: ANALYSIS_PROMPT },
      { 
        role: 'user', 
        content: `Documents uploaded:\n${documentList}\n\nClient/Vendor Name: ${clientName || 'Unknown'}\n\nDocument Content:\n${documentContent}`
      }
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' }
  });
  
  const aiResult = JSON.parse(response.choices[0].message.content || '{}');
  
  let vendorRiskAdjustment = 0;
  let vendorInfo: AnalysisResult['vendorInfo'] | undefined;
  
  if (vendorData) {
    if (vendorData.paymentRating === 'F' || vendorData.paymentRating === 'D') {
      vendorRiskAdjustment = 30;
    } else if (vendorData.paymentRating === 'C') {
      vendorRiskAdjustment = 15;
    } else if (vendorData.paymentRating === 'B' || vendorData.paymentRating === 'B+') {
      vendorRiskAdjustment = 5;
    }
    
    vendorInfo = {
      name: vendorData.vendorName,
      paymentRating: vendorData.paymentRating || 'Unknown',
      paymentHistory: {
        averagePaymentDays: vendorData.averagePaymentDays || 0,
        onTimeRate: vendorData.onTimePaymentRate || 0,
        totalProjects: vendorData.totalProjects || 0,
        disputedPayments: vendorData.disputedPayments || 0,
      }
    };
    
    if (vendorData.paymentRating && ['D', 'F'].includes(vendorData.paymentRating)) {
      aiResult.alerts = aiResult.alerts || [];
      aiResult.alerts.push({
        type: 'VENDOR_PAYMENT',
        severity: 'Critical',
        title: 'Poor Payment History',
        description: `${vendorData.vendorName} has a ${vendorData.paymentRating} payment rating with ${vendorData.disputedPayments || 0} disputed payments.`,
        action: 'Consider requiring upfront deposits or milestone-based payments.'
      });
    }
  }
  
  const adjustedVendorRisk = Math.min(100, (aiResult.vendor_risk_score || 50) + vendorRiskAdjustment);
  
  const avgScore = (aiResult.quality_score + aiResult.clarity_score + aiResult.doability_score + (100 - adjustedVendorRisk)) / 4;
  let overallRisk: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  
  if (avgScore < 40 || adjustedVendorRisk > 80) {
    overallRisk = 'Critical';
  } else if (avgScore < 55 || adjustedVendorRisk > 60) {
    overallRisk = 'High';
  } else if (avgScore < 70 || adjustedVendorRisk > 40) {
    overallRisk = 'Medium';
  }
  
  return {
    qualityScore: aiResult.quality_score || 50,
    clarityScore: aiResult.clarity_score || 50,
    doabilityScore: aiResult.doability_score || 50,
    vendorRiskScore: adjustedVendorRisk,
    overallRiskLevel: overallRisk,
    issues: {
      missingDocuments: aiResult.missing_documents || [],
      unclearRequirements: aiResult.unclear_requirements || [],
      redFlags: aiResult.red_flags || [],
    },
    opportunities: aiResult.opportunities || [],
    recommendations: aiResult.recommendations || [],
    vendorInfo,
    alerts: aiResult.alerts || [],
  };
}

async function getClientNameFromProject(projectId: string): Promise<string | null> {
  const project = await storage.getProject(projectId);
  return project?.clientName || null;
}

export async function saveAnalysis(projectId: string, result: AnalysisResult): Promise<RFPAnalysis> {
  const analysisData = {
    qualityScore: result.qualityScore,
    doabilityScore: result.doabilityScore,
    clarityScore: result.clarityScore,
    vendorRiskScore: result.vendorRiskScore,
    overallRiskLevel: result.overallRiskLevel,
    missingDocuments: result.issues.missingDocuments,
    unclearRequirements: result.issues.unclearRequirements,
    redFlags: result.issues.redFlags,
    opportunities: result.opportunities,
    recommendations: result.recommendations,
    vendorName: result.vendorInfo?.name,
    vendorPaymentRating: result.vendorInfo?.paymentRating,
    paymentHistory: result.vendorInfo?.paymentHistory,
  };
  
  const existingAnalysis = await storage.getAnalysisByProject(projectId);
  
  if (existingAnalysis) {
    await storage.deleteAlertsByAnalysis(existingAnalysis.id);
  }
  
  const analysis = await storage.createOrUpdateAnalysis(projectId, analysisData);
  
  if (result.alerts.length > 0) {
    for (const alert of result.alerts) {
      await storage.createAlert({
        analysisId: analysis.id,
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        recommendedAction: alert.action,
      });
    }
  }
  
  return analysis;
}

export async function getAnalysisForProject(projectId: string): Promise<{
  analysis: RFPAnalysis | null;
  alerts: AnalysisAlert[];
}> {
  const analysis = await storage.getAnalysisByProject(projectId);
  
  if (!analysis) {
    return { analysis: null, alerts: [] };
  }
  
  const alerts = await storage.getAlertsByAnalysis(analysis.id);
  
  return { analysis, alerts };
}

export async function resolveAlert(alertId: number): Promise<AnalysisAlert> {
  return await storage.resolveAlert(alertId);
}

export async function getAllVendors(): Promise<Vendor[]> {
  return await storage.listVendors();
}

export async function upsertVendor(data: Omit<Vendor, 'id' | 'lastUpdated'>): Promise<Vendor> {
  return await storage.upsertVendor(data);
}

export async function seedVendorDatabase(): Promise<void> {
  const count = await storage.countVendors();
  
  if (count > 0) {
    return;
  }
  
  const sampleVendors = [
    {
      vendorName: "ABC Construction Corp",
      averagePaymentDays: 45,
      onTimePaymentRate: 85.0,
      totalProjects: 150,
      latePayments: 22,
      disputedPayments: 3,
      overallRating: "B+",
      paymentRating: "B",
      communicationRating: "A",
      industrySectors: ["Commercial", "Residential"],
      typicalProjectSize: "$500K-$5M",
      geographicRegions: ["UAE", "Saudi Arabia"],
      notes: "Reliable but occasionally slow to pay. Good communication."
    },
    {
      vendorName: "Premier Development LLC",
      averagePaymentDays: 30,
      onTimePaymentRate: 95.0,
      totalProjects: 200,
      latePayments: 10,
      disputedPayments: 1,
      overallRating: "A+",
      paymentRating: "A+",
      communicationRating: "A",
      industrySectors: ["Commercial", "Infrastructure"],
      typicalProjectSize: "$1M-$10M",
      geographicRegions: ["UAE", "Qatar"],
      notes: "Excellent payment history. Premium client."
    },
    {
      vendorName: "Budget Builders Inc",
      averagePaymentDays: 90,
      onTimePaymentRate: 45.0,
      totalProjects: 80,
      latePayments: 44,
      disputedPayments: 12,
      overallRating: "D",
      paymentRating: "F",
      communicationRating: "C",
      industrySectors: ["Residential"],
      typicalProjectSize: "$100K-$500K",
      geographicRegions: ["UAE"],
      notes: "CAUTION: Frequent payment delays and disputes. Require deposits."
    },
    {
      vendorName: "Gulf Estates Development",
      averagePaymentDays: 35,
      onTimePaymentRate: 92.0,
      totalProjects: 120,
      latePayments: 10,
      disputedPayments: 2,
      overallRating: "A",
      paymentRating: "A",
      communicationRating: "A-",
      industrySectors: ["Residential", "Mixed-Use"],
      typicalProjectSize: "$2M-$15M",
      geographicRegions: ["UAE", "Bahrain"],
      notes: "Strong payment history. Professional team."
    },
    {
      vendorName: "Midtown Contractors LLC",
      averagePaymentDays: 60,
      onTimePaymentRate: 70.0,
      totalProjects: 95,
      latePayments: 28,
      disputedPayments: 5,
      overallRating: "C+",
      paymentRating: "C",
      communicationRating: "B",
      industrySectors: ["Commercial", "Industrial"],
      typicalProjectSize: "$500K-$3M",
      geographicRegions: ["UAE"],
      notes: "Variable payment patterns. Consider payment milestones."
    }
  ];
  
  for (const vendor of sampleVendors) {
    await storage.upsertVendor(vendor);
  }
  
  console.log(`Seeded ${sampleVendors.length} vendors into database`);
}
