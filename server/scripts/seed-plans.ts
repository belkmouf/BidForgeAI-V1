import { db } from '../db.js';
import { subscriptionPlans } from '../../shared/schema.js';
import { sql } from 'drizzle-orm';

const plans = [
  {
    name: 'sifter',
    displayName: 'The Sifter',
    tier: 1,
    basePrice: 49.00,
    features: {
      tender_aggregation: true,
      smart_filtering: true,
      basic_analysis: true,
      win_probability: true,
    },
    limits: {
      projects: 5,
      documents: 50,
      bid_generations: 3,
      storage_gb: 1,
      team_members: 1,
    },
    includedCredits: {} as Record<string, number>,
    overagePricing: {
      bid_generation: 25.00,
    } as Record<string, number>,
  },
  {
    name: 'estimator',
    displayName: "The Estimator's Assistant",
    tier: 2,
    basePrice: 299.00,
    features: {
      everything_in_tier_1: true,
      auto_summarization: true,
      compliance_matrix: true,
      deep_analysis: true,
      conflict_detection: true,
      knowledge_base: true,
      team_collaboration: true,
      custom_branding: true,
    },
    limits: {
      projects: 20,
      documents: 200,
      storage_gb: 10,
      team_members: 10,
      api_calls: 1000,
    },
    includedCredits: {
      deep_analyses: 5,
      document_pages: 50,
      bid_generations: 10,
    },
    overagePricing: {
      deep_analysis: 50.00,
      bid_generation: 15.00,
      document_page: 0.01,
    },
  },
  {
    name: 'bid_manager',
    displayName: 'The Bid Manager',
    tier: 3,
    basePrice: 799.00,
    features: {
      everything_in_tier_2: true,
      ai_bid_generation: true,
      multi_model_comparison: true,
      pdf_export: true,
      advanced_analytics: true,
      priority_support: true,
    },
    limits: {
      projects: 100,
      documents: 1000,
      storage_gb: 50,
      team_members: 50,
      api_calls: 10000,
    },
    includedCredits: {
      deep_analyses: 20,
      document_pages: 200,
      bid_generations: 50,
      blueprint_analyses: 10,
    },
    overagePricing: {
      deep_analysis: 40.00,
      bid_generation: 10.00,
      document_page: 0.005,
      blueprint_analysis: 20.00,
    },
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    tier: 4,
    basePrice: 1999.00,
    features: {
      everything_in_tier_3: true,
      white_label: true,
      custom_integrations: true,
      dedicated_support: true,
      sla_guarantee: true,
      unlimited_api: true,
    },
    limits: {
      projects: -1,
      documents: -1,
      storage_gb: 500,
      team_members: -1,
      api_calls: -1,
    },
    includedCredits: {
      deep_analyses: 100,
      document_pages: 1000,
      bid_generations: 200,
      blueprint_analyses: 50,
    },
    overagePricing: {
      deep_analysis: 30.00,
      bid_generation: 5.00,
      document_page: 0.002,
      blueprint_analysis: 15.00,
    },
  },
];

async function seedPlans() {
  console.log('Seeding subscription plans...');
  
  for (const plan of plans) {
    try {
      await db.insert(subscriptionPlans).values({
        name: plan.name,
        displayName: plan.displayName,
        tier: plan.tier,
        basePrice: plan.basePrice,
        features: plan.features,
        limits: plan.limits,
        includedCredits: plan.includedCredits,
        overagePricing: plan.overagePricing,
        isActive: true,
      }).onConflictDoUpdate({
        target: subscriptionPlans.name,
        set: {
          displayName: plan.displayName,
          tier: plan.tier,
          basePrice: plan.basePrice,
          features: plan.features,
          limits: plan.limits,
          includedCredits: plan.includedCredits,
          overagePricing: plan.overagePricing,
          updatedAt: new Date(),
        },
      });
      console.log(`  - ${plan.displayName} (Tier ${plan.tier}): $${plan.basePrice}/month`);
    } catch (error) {
      console.error(`Failed to seed plan ${plan.name}:`, error);
    }
  }
  
  console.log('Done seeding subscription plans!');
}

seedPlans().catch(console.error);
