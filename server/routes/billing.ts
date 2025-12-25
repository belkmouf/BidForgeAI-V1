import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { subscriptionService } from '../lib/subscription-service.js';
import { limitChecker } from '../lib/limit-checker.js';
import { trialService } from '../lib/trial-service.js';

const router = Router();

router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    const subscription = await subscriptionService.getCompanySubscription(companyId);
    
    if (!subscription) {
      return res.json({ subscription: null, isTrial: false });
    }
    
    const isTrial = subscription.plan.tier === 0;
    let trialInfo = null;
    
    if (isTrial) {
      trialInfo = await trialService.getTrialRemainingTime(companyId);
    }
    
    return res.json({
      subscription: subscription.subscription,
      plan: subscription.plan,
      isTrial,
      trialInfo,
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    const usage = await limitChecker.getUsageSummary(companyId);
    
    if (!usage) {
      return res.json({ usage: null });
    }
    
    return res.json({ usage });
  } catch (error: any) {
    console.error('Error fetching usage:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/plans', authenticateToken, async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    return res.json({ plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/public-plans', async (req, res) => {
  try {
    const plans = await subscriptionService.getAllPlans();
    return res.json({ plans });
  } catch (error: any) {
    console.error('Error fetching public plans:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/subscription', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    const { planId, billingCycle } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID required' });
    }
    
    const result = await subscriptionService.changePlan(
      companyId,
      planId,
      billingCycle || 'monthly'
    );
    
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error changing subscription:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/add-projects', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    const { quantity } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    
    const result = await subscriptionService.addExtraProjects(companyId, quantity);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error adding projects:', error);
    return res.status(400).json({ error: error.message });
  }
});

router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    const { cancelAtPeriodEnd, reason } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    await subscriptionService.cancelSubscription(
      companyId,
      cancelAtPeriodEnd !== false,
      reason
    );
    
    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/check-limit/:type', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const companyId = authReq.user?.companyId;
    const { type } = req.params;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    let result;
    switch (type) {
      case 'projects':
        result = await limitChecker.checkProjectLimit(companyId);
        break;
      case 'documents':
        result = await limitChecker.checkDocumentLimit(companyId);
        break;
      case 'bids':
        result = await limitChecker.checkBidLimit(companyId);
        break;
      default:
        return res.status(400).json({ error: 'Invalid limit type' });
    }
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error checking limit:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
