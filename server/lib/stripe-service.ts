import { db } from '../db.js';
import { paymentMethods, companySubscriptions } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

let stripe: any = null;

async function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    const Stripe = (await import('stripe')).default;
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia' as any,
      typescript: true,
    });
  }
  return stripe;
}

export class StripeService {
  async getOrCreateCustomer(companyId: number, email: string) {
    const stripeClient = await getStripe();
    if (!stripeClient) {
      throw new Error('Stripe is not configured');
    }

    const [existing] = await db
      .select()
      .from(paymentMethods)
      .where(
        and(
          eq(paymentMethods.companyId, companyId),
          eq(paymentMethods.provider, 'stripe')
        )
      )
      .limit(1);
    
    if (existing?.providerCustomerId) {
      try {
        return await stripeClient.customers.retrieve(existing.providerCustomerId);
      } catch (error) {
        console.warn('Stripe customer not found, creating new:', error);
      }
    }
    
    const customer = await stripeClient.customers.create({
      email,
      metadata: {
        companyId: companyId.toString(),
      },
    });
    
    if (existing) {
      await db
        .update(paymentMethods)
        .set({ providerCustomerId: customer.id })
        .where(eq(paymentMethods.id, existing.id));
    } else {
      await db.insert(paymentMethods).values({
        companyId,
        provider: 'stripe',
        providerCustomerId: customer.id,
        isDefault: true,
      });
    }
    
    return customer;
  }
  
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId: string
  ) {
    const stripeClient = await getStripe();
    if (!stripeClient) {
      throw new Error('Stripe is not configured');
    }

    await stripeClient.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    await stripeClient.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    const subscription = await stripeClient.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    return subscription;
  }
  
  async handleWebhook(event: any) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const companyId = parseInt(subscription.metadata.companyId || '0');
          
          if (companyId) {
            await db
              .update(companySubscriptions)
              .set({
                status: subscription.status === 'active' ? 'active' : 'cancelled',
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                updatedAt: new Date(),
              })
              .where(eq(companySubscriptions.companyId, companyId));
          }
          break;
        }
        
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const companyId = parseInt(subscription.metadata.companyId || '0');
          
          if (companyId) {
            await db
              .update(companySubscriptions)
              .set({
                status: 'cancelled',
                cancelledAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(companySubscriptions.companyId, companyId));
          }
          break;
        }
        
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          console.log('Invoice paid:', invoice.id);
          break;
        }
        
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.warn('Payment failed for invoice:', invoice.id);
          break;
        }
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }
  
  async constructWebhookEvent(payload: string | Buffer, signature: string) {
    const stripeClient = await getStripe();
    if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook is not configured');
    }
    
    return stripeClient.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}

export const stripeService = new StripeService();
