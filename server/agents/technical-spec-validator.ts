import { BaseAgent, AgentInput, AgentOutput, AgentContext } from './base-agent';
import type { CompiledContext } from './context-builder';
import type { SketchAnalysisOutput } from './sketch-agent';

export interface TechValidationResult {
  passed: boolean;
  criticalViolations: ValidationViolation[];
  warnings: ValidationViolation[];
  complianceScore: number;
  gccCompliance: GCCComplianceResult;
  hardStop: boolean;
}

export interface ValidationViolation {
  id: string;
  rule: string;
  category: 'material_grade' | 'structural' | 'regional_code' | 'safety' | 'specification';
  severity: 'critical' | 'high' | 'medium' | 'low';
  found: string;
  required: string;
  location?: string;
  standard?: string;
}

export interface GCCComplianceResult {
  region: string;
  currencyValid: boolean;
  codesChecked: string[];
  violations: string[];
}

const MATERIAL_STANDARDS: Record<string, { minValue: number; unit: string; standard: string }> = {
  'concrete_strength': { minValue: 35, unit: 'N/mm²', standard: 'BS EN 206' },
  'rebar_grade': { minValue: 460, unit: 'MPa', standard: 'BS 4449' },
  'steel_grade': { minValue: 275, unit: 'MPa', standard: 'BS EN 10025' },
  'waterproofing_thickness': { minValue: 2, unit: 'mm', standard: 'BS 8102' },
};

const GCC_REGIONAL_CODES = {
  UAE: ['Abu Dhabi Building Code', 'Dubai Municipality Code', 'BS EN'],
  Saudi: ['Saudi Building Code (SBC)', 'BS EN', 'ARAMCO Standards'],
  Qatar: ['Qatar Construction Specifications (QCS)', 'BS EN'],
  Oman: ['Oman Building Regulations', 'BS EN'],
  Kuwait: ['Kuwait Building Code', 'BS EN'],
  Bahrain: ['Bahrain Building Code', 'BS EN'],
};

const GCC_CURRENCIES = ['AED', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD', 'USD'];

export class TechnicalSpecValidator extends BaseAgent {
  name = 'technical-validator';
  description = 'Validates material grades and regional compliance against hard-coded rulesets';

  protected async executeWithCompiledContext(
    compiledContext: CompiledContext,
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentOutput> {
    return this.wrapExecution(async () => {
      const inputData = input.data as {
        documents?: Array<{ name: string; content?: string }>;
        sketchAnalysis?: SketchAnalysisOutput[];
        analysis?: { keyFindings?: string[]; recommendations?: Array<{ action: string }> };
        conflictDetection?: { recommendation?: string };
      };

      const documents = inputData.documents || [];
      const sketchAnalysis = inputData.sketchAnalysis || [];

      this.log('Starting technical specification validation');

      const allContent = documents.map(d => d.content || '').join('\n');
      const allMaterials = sketchAnalysis.flatMap(s => s.materials || []);
      const allStandards = sketchAnalysis.flatMap(s => s.standards || []);
      const allRegionalCodes = sketchAnalysis.flatMap(s => s.regionalCodes || []);

      const materialViolations = this.validateMaterialGrades(allContent, allMaterials);
      const regionalResult = this.validateGCCCompliance(allContent, allStandards, allRegionalCodes);

      const criticalViolations = materialViolations.filter(v => v.severity === 'critical');
      const warnings = materialViolations.filter(v => v.severity !== 'critical');

      const complianceScore = this.calculateComplianceScore(materialViolations, regionalResult);
      const hardStop = criticalViolations.length > 0;

      const result: TechValidationResult = {
        passed: !hardStop && complianceScore >= 70,
        criticalViolations,
        warnings,
        complianceScore,
        gccCompliance: regionalResult,
        hardStop,
      };

      this.log(`Validation complete: ${criticalViolations.length} critical, ${warnings.length} warnings`);
      this.log(`Compliance score: ${complianceScore}%, Hard stop: ${hardStop}`);

      if (hardStop) {
        return {
          success: false,
          error: `HARD_STOP: Critical technical violations detected. ${criticalViolations.map(v => v.rule).join(', ')}`,
          data: {
            technicalValidation: result,
            hardStop: true,
            logs: [
              `HARD STOP: ${criticalViolations.length} critical violations`,
              ...criticalViolations.map(v => `- ${v.rule}: Found ${v.found}, Required ${v.required}`),
            ],
          },
        };
      }

      return {
        success: true,
        data: {
          technicalValidation: result,
          logs: [
            `Technical validation passed with score ${complianceScore}%`,
            `Warnings: ${warnings.length}`,
            `GCC Region: ${regionalResult.region}`,
          ],
        },
      };
    }, 'technical specification validation');
  }

  private validateMaterialGrades(
    content: string,
    materials: Array<{ name: string; grade?: string | null; specification?: string | null }>
  ): ValidationViolation[] {
    const violations: ValidationViolation[] = [];
    const contentLower = content.toLowerCase();

    const concreteMatch = contentLower.match(/concrete[:\s]+(?:grade\s+)?c?(\d+)/i) ||
                          contentLower.match(/(\d+)\s*n\/mm[²2]/i) ||
                          contentLower.match(/grade\s*(\d+)\s*concrete/i);
    
    if (concreteMatch) {
      const foundStrength = parseInt(concreteMatch[1]);
      const required = MATERIAL_STANDARDS.concrete_strength;
      if (foundStrength < required.minValue) {
        violations.push({
          id: 'mat-concrete-1',
          rule: 'Minimum Concrete Strength',
          category: 'material_grade',
          severity: 'critical',
          found: `${foundStrength} ${required.unit}`,
          required: `≥ ${required.minValue} ${required.unit}`,
          standard: required.standard,
        });
      }
    }

    const rebarMatch = contentLower.match(/rebar[:\s]+(?:grade\s+)?(\d+)/i) ||
                       contentLower.match(/steel\s+reinforcement[:\s]+(\d+)/i);
    
    if (rebarMatch) {
      const foundGrade = parseInt(rebarMatch[1]);
      const required = MATERIAL_STANDARDS.rebar_grade;
      if (foundGrade < required.minValue) {
        violations.push({
          id: 'mat-rebar-1',
          rule: 'Minimum Rebar Grade',
          category: 'material_grade',
          severity: 'critical',
          found: `Grade ${foundGrade}`,
          required: `≥ Grade ${required.minValue} (${required.unit})`,
          standard: required.standard,
        });
      }
    }

    for (const material of materials) {
      if (material.name.toLowerCase().includes('concrete') && material.grade) {
        const gradeNum = parseInt(material.grade.replace(/\D/g, ''));
        if (gradeNum > 0 && gradeNum < MATERIAL_STANDARDS.concrete_strength.minValue) {
          violations.push({
            id: `mat-sketch-${material.name}`,
            rule: 'Concrete Grade from Drawing',
            category: 'material_grade',
            severity: 'high',
            found: material.grade,
            required: `≥ ${MATERIAL_STANDARDS.concrete_strength.minValue} ${MATERIAL_STANDARDS.concrete_strength.unit}`,
            standard: MATERIAL_STANDARDS.concrete_strength.standard,
          });
        }
      }
    }

    return violations;
  }

  private validateGCCCompliance(
    content: string,
    standards: string[],
    regionalCodes: string[]
  ): GCCComplianceResult {
    const contentLower = content.toLowerCase();
    
    let detectedRegion = 'Unknown';
    const violations: string[] = [];

    if (contentLower.includes('uae') || contentLower.includes('dubai') || 
        contentLower.includes('abu dhabi') || contentLower.includes('aed')) {
      detectedRegion = 'UAE';
    } else if (contentLower.includes('saudi') || contentLower.includes('riyadh') || 
               contentLower.includes('sar')) {
      detectedRegion = 'Saudi';
    } else if (contentLower.includes('qatar') || contentLower.includes('doha') || 
               contentLower.includes('qar')) {
      detectedRegion = 'Qatar';
    } else if (contentLower.includes('oman') || contentLower.includes('muscat') || 
               contentLower.includes('omr')) {
      detectedRegion = 'Oman';
    }

    let currencyValid = false;
    for (const currency of GCC_CURRENCIES) {
      if (contentLower.includes(currency.toLowerCase())) {
        currencyValid = true;
        break;
      }
    }

    const expectedCodes = GCC_REGIONAL_CODES[detectedRegion as keyof typeof GCC_REGIONAL_CODES] || ['BS EN'];
    const foundCodes = [...standards, ...regionalCodes];
    
    const hasBSEN = foundCodes.some(c => c.toLowerCase().includes('bs en') || c.toLowerCase().includes('bsen'));
    if (!hasBSEN && !contentLower.includes('bs en')) {
      violations.push('Missing BS EN standard references');
    }

    return {
      region: detectedRegion,
      currencyValid,
      codesChecked: expectedCodes,
      violations,
    };
  }

  private calculateComplianceScore(
    violations: ValidationViolation[],
    gccResult: GCCComplianceResult
  ): number {
    let score = 100;

    for (const v of violations) {
      switch (v.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
      }
    }

    if (gccResult.violations.length > 0) {
      score -= gccResult.violations.length * 5;
    }

    if (!gccResult.currencyValid) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

export const technicalSpecValidator = new TechnicalSpecValidator();
