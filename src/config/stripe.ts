/**
 * Stripe price IDs (live in the Stripe Dashboard).
 * Synced to Firestore by the firestore-stripe-payments extension under
 * products/{productId}/prices/{priceId}, but we reference them by ID here
 * so checkout doesn't have to wait on a product fetch.
 */

export interface PlanConfig {
  id: 'pro' | 'guide'
  label: string
  priceId: string
  monthly: number
  trialDays: number
}

export const PLANS: Record<'pro' | 'guide', PlanConfig> = {
  pro: {
    id: 'pro',
    label: 'Pro',
    priceId: 'price_1TQ9YQB4dW44xtsTefWTOqhf',
    monthly: 10,
    trialDays: 30,
  },
  guide: {
    id: 'guide',
    label: 'Guide',
    priceId: 'price_1TQ9YhB4dW44xtsTeOfPyRYU',
    monthly: 25,
    trialDays: 30,
  },
}
