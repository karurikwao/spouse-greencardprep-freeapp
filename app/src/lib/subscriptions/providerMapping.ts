/**
 * Payment Provider Mapping
 * 
 * Abstraction layer for payment provider integration.
 * Maps provider-specific events to our standardized subscription events.
 */

import type { 
  PaymentProvider, 
  WebhookEventType, 
  WebhookPayload,
  SubscriptionTransitionEvent,
  SubscriptionStatus
} from './types';
import type { PlanType } from '@/lib/plans';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  webhookSecretEnvVar: string;
  apiKeyEnvVar: string;
  supportedPlans: PlanType[];
  features: {
    subscriptions: boolean;
    oneTimePayments: boolean;
    trials: boolean;
    gracePeriods: boolean;
    webhooks: boolean;
  };
}

/**
 * Provider configurations
 */
export const PROVIDER_CONFIGS: Record<PaymentProvider, ProviderConfig> = {
  internal: {
    name: 'Internal',
    enabled: true,
    webhookSecretEnvVar: '',
    apiKeyEnvVar: '',
    supportedPlans: ['trial', 'monthly', 'lifetime', 'interviewPass'],
    features: {
      subscriptions: false,
      oneTimePayments: false,
      trials: true,
      gracePeriods: false,
      webhooks: false,
    },
  },
  stripe: {
    name: 'Stripe',
    enabled: true, // Stripe is now integrated
    webhookSecretEnvVar: 'STRIPE_WEBHOOK_SECRET',
    apiKeyEnvVar: 'STRIPE_SECRET_KEY',
    supportedPlans: ['monthly', 'lifetime', 'interviewPass'],
    features: {
      subscriptions: true,
      oneTimePayments: true,
      trials: true,
      gracePeriods: true,
      webhooks: true,
    },
  },
  paddle: {
    name: 'Paddle',
    enabled: false,
    webhookSecretEnvVar: 'PADDLE_WEBHOOK_SECRET',
    apiKeyEnvVar: 'PADDLE_API_KEY',
    supportedPlans: ['monthly', 'lifetime', 'interviewPass'],
    features: {
      subscriptions: true,
      oneTimePayments: true,
      trials: true,
      gracePeriods: true,
      webhooks: true,
    },
  },
  lemonsqueezy: {
    name: 'LemonSqueezy',
    enabled: false,
    webhookSecretEnvVar: 'LEMONSQUEEZY_WEBHOOK_SECRET',
    apiKeyEnvVar: 'LEMONSQUEEZY_API_KEY',
    supportedPlans: ['monthly', 'lifetime', 'interviewPass'],
    features: {
      subscriptions: true,
      oneTimePayments: true,
      trials: true,
      gracePeriods: false,
      webhooks: true,
    },
  },
  custom: {
    name: 'Custom',
    enabled: false,
    webhookSecretEnvVar: 'CUSTOM_WEBHOOK_SECRET',
    apiKeyEnvVar: 'CUSTOM_API_KEY',
    supportedPlans: ['monthly', 'lifetime', 'interviewPass'],
    features: {
      subscriptions: true,
      oneTimePayments: true,
      trials: true,
      gracePeriods: false,
      webhooks: true,
    },
  },
};

// ============================================================================
// PROVIDER EVENT MAPPING
// ============================================================================

/**
 * Maps Stripe events to our standardized events
 */
const STRIPE_EVENT_MAP: Record<string, WebhookEventType> = {
  'checkout.session.completed': 'checkout.session.completed',
  'customer.subscription.created': 'customer.subscription.created',
  'customer.subscription.updated': 'customer.subscription.updated',
  'customer.subscription.deleted': 'customer.subscription.deleted',
  'invoice.paid': 'invoice.paid',
  'invoice.payment_failed': 'invoice.payment_failed',
};

/**
 * Maps Paddle events to our standardized events
 */
const PADDLE_EVENT_MAP: Record<string, WebhookEventType> = {
  'subscription.created': 'customer.subscription.created',
  'subscription.updated': 'customer.subscription.updated',
  'subscription.cancelled': 'customer.subscription.deleted',
  'subscription.payment.success': 'invoice.paid',
  'subscription.payment.failed': 'invoice.payment_failed',
  'transaction.completed': 'checkout.session.completed',
};

/**
 * Maps LemonSqueezy events to our standardized events
 */
const LEMONSQUEEZY_EVENT_MAP: Record<string, WebhookEventType> = {
  'order_created': 'checkout.session.completed',
  'subscription_created': 'customer.subscription.created',
  'subscription_updated': 'customer.subscription.updated',
  'subscription_cancelled': 'customer.subscription.deleted',
  'subscription_payment_success': 'invoice.paid',
  'subscription_payment_failed': 'invoice.payment_failed',
};

// ============================================================================
// EVENT NORMALIZATION
// ============================================================================

/**
 * Normalize a provider-specific event to our standard format
 */
export function normalizeWebhookEvent(
  provider: PaymentProvider,
  providerEventType: string,
  rawData: unknown
): WebhookPayload | null {
  switch (provider) {
    case 'stripe':
      return normalizeStripeEvent(providerEventType, rawData);
    case 'paddle':
      return normalizePaddleEvent(providerEventType, rawData);
    case 'lemonsqueezy':
      return normalizeLemonSqueezyEvent(providerEventType, rawData);
    default:
      return null;
  }
}

/**
 * Normalize Stripe event
 */
function normalizeStripeEvent(
  eventType: string,
  data: unknown
): WebhookPayload | null {
  const stripeData = data as Record<string, unknown>;
  const eventId = stripeData.id as string;
  const timestamp = new Date((stripeData.created as number) * 1000).toISOString();
  
  const normalizedType = STRIPE_EVENT_MAP[eventType];
  if (!normalizedType) return null;
  
  // Extract data based on object type
  const objectData = (stripeData.data as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
  
  return {
    eventType: normalizedType,
    provider: 'stripe',
    providerEventId: eventId,
    timestamp,
    data: {
      customerId: objectData?.customer as string,
      subscriptionId: (objectData?.subscription as string) || (objectData?.id as string),
      planType: mapStripePriceToPlan((objectData?.items as Record<string, unknown>)?.data as unknown[]),
      status: mapStripeStatus(objectData?.status as string),
      currentPeriodEnd: objectData?.current_period_end 
        ? new Date((objectData.current_period_end as number) * 1000).toISOString()
        : undefined,
      cancelAtPeriodEnd: objectData?.cancel_at_period_end as boolean,
      metadata: objectData?.metadata as Record<string, unknown>,
    },
  };
}

/**
 * Normalize Paddle event
 */
function normalizePaddleEvent(
  eventType: string,
  data: unknown
): WebhookPayload | null {
  const paddleData = data as Record<string, unknown>;
  const eventId = paddleData.event_id as string;
  const timestamp = new Date().toISOString(); // Paddle doesn't include timestamp
  
  const normalizedType = PADDLE_EVENT_MAP[eventType];
  if (!normalizedType) return null;
  
  return {
    eventType: normalizedType,
    provider: 'paddle',
    providerEventId: eventId,
    timestamp,
    data: {
      customerId: paddleData.customer_id as string,
      subscriptionId: paddleData.subscription_id as string,
      planType: mapPaddleProductToPlan(paddleData.product_id as string),
      status: undefined,
      currentPeriodEnd: undefined,
      cancelAtPeriodEnd: undefined,
      metadata: paddleData,
    },
  };
}

/**
 * Normalize LemonSqueezy event
 */
function normalizeLemonSqueezyEvent(
  eventType: string,
  data: unknown
): WebhookPayload | null {
  const lsData = data as Record<string, unknown>;
  const meta = lsData.meta as Record<string, unknown> | undefined;
  const lsDataData = lsData.data as Record<string, unknown> | undefined;
  const eventId = meta?.event_id as string;
  const timestamp = new Date().toISOString();
  
  const normalizedType = LEMONSQUEEZY_EVENT_MAP[eventType];
  if (!normalizedType) return null;
  
  const attributes = lsDataData?.attributes as Record<string, unknown> | undefined;
  const relationships = lsDataData?.relationships as Record<string, unknown> | undefined;
  const customerRel = relationships?.customer as Record<string, unknown> | undefined;
  const customerData = customerRel?.data as Record<string, unknown> | undefined;
  
  return {
    eventType: normalizedType,
    provider: 'lemonsqueezy',
    providerEventId: eventId,
    timestamp,
    data: {
      customerId: customerData?.id as string,
      subscriptionId: lsDataData?.id as string,
      planType: mapLemonSqueezyProductToPlan(attributes?.product_id as string),
      status: undefined,
      currentPeriodEnd: attributes?.renews_at as string,
      cancelAtPeriodEnd: attributes?.cancelled as boolean,
      metadata: attributes,
    },
  };
}

// ============================================================================
// MAPPING HELPERS (PLACEHOLDER)
// ============================================================================

/**
 * Map Stripe price/plan to our plan types
 * Uses environment variable-based price IDs
 */
function mapStripePriceToPlan(itemsData: unknown[] | undefined): PlanType | undefined {
  const item = itemsData?.[0] as Record<string, unknown> | undefined;
  const priceData = item?.price as Record<string, unknown> | undefined;
  const priceId = priceData?.id as string | undefined;
  
  // Get price IDs from env vars (these would be replaced at build time or fetched from config)
  // In practice, we use metadata from checkout session instead
  const planMap: Record<string, PlanType> = {};
  
  // Fallback: check metadata-based plan_type if available
  const metadata = priceData?.metadata as Record<string, string> | undefined;
  if (metadata?.plan_type) {
    return metadata.plan_type as PlanType;
  }
  
  if (priceId && priceId in planMap) {
    return planMap[priceId];
  }
  
  return undefined;
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus | undefined {
  const statusMap: Record<string, SubscriptionStatus> = {
    'trialing': 'trialing',
    'active': 'active',
    'canceled': 'canceled',
    'incomplete': 'past_due',
    'incomplete_expired': 'expired',
    'past_due': 'past_due',
    'unpaid': 'past_due',
    'paused': 'grace_period',
  };
  
  return statusMap[stripeStatus];
}

/**
 * Map Paddle product to our plan types
 */
function mapPaddleProductToPlan(productId: string): PlanType | undefined {
  const planMap: Record<string, PlanType> = {
    // Add your Paddle product IDs here
  };
  return planMap[productId];
}

/**
 * Map LemonSqueezy product to our plan types
 */
function mapLemonSqueezyProductToPlan(productId: string): PlanType | undefined {
  const planMap: Record<string, PlanType> = {
    // Add your LemonSqueezy product IDs here
  };
  return planMap[productId];
}

// ============================================================================
// TRANSITION MAPPING
// ============================================================================

/**
 * Map webhook events to subscription transition events
 */
export function mapWebhookToTransition(
  payload: WebhookPayload
): SubscriptionTransitionEvent | null {
  switch (payload.eventType) {
    case 'checkout.session.completed':
      return 'checkout_completed';
    case 'subscription.created':
    case 'customer.subscription.created':
      return 'subscription_activated';
    case 'customer.subscription.updated':
      if (payload.data.cancelAtPeriodEnd) {
        return 'subscription_canceled';
      }
      return 'subscription_renewed';
    case 'customer.subscription.deleted':
      return 'subscription_expired';
    case 'invoice.paid':
      return 'payment_succeeded';
    case 'invoice.payment_failed':
      return 'payment_failed';
    default:
      return null;
  }
}

// ============================================================================
// CHECKOUT URL GENERATION (PLACEHOLDER)
// ============================================================================

/**
 * Generate checkout URL for a plan
 * This is a placeholder - implement actual provider integration
 */
export function generateCheckoutUrl(
  provider: PaymentProvider,
  _planType: PlanType,
  _options: {
    successUrl: string;
    cancelUrl: string;
    customerEmail?: string;
    metadata?: Record<string, unknown>;
  }
): string | null {
  switch (provider) {
    case 'stripe':
      // TODO: Implement Stripe checkout session creation
      console.warn('Stripe checkout not yet implemented');
      return null;
    case 'paddle':
      // TODO: Implement Paddle checkout
      console.warn('Paddle checkout not yet implemented');
      return null;
    case 'lemonsqueezy':
      // TODO: Implement LemonSqueezy checkout
      console.warn('LemonSqueezy checkout not yet implemented');
      return null;
    default:
      return null;
  }
}

/**
 * Generate customer portal URL
 * This is a placeholder - implement actual provider integration
 */
export function generatePortalUrl(
  provider: PaymentProvider,
  _customerId: string
): string | null {
  switch (provider) {
    case 'stripe':
      // TODO: Implement Stripe customer portal
      console.warn('Stripe portal not yet implemented');
      return null;
    case 'paddle':
      // TODO: Implement Paddle update URL
      console.warn('Paddle portal not yet implemented');
      return null;
    default:
      return null;
  }
}
