import Stripe from "stripe";

/**
 * Helper to get Subscription ID
 */
export function getSubscriptionId(subscription: Stripe.Subscription | string | null | undefined): string {
    if (subscription && typeof subscription === 'string') {
        return subscription;
    }
    else if (subscription && typeof subscription === 'object') {
        return subscription.id;
    } else {
        return SUBSCRIPTION_ID_EMPTY;
    }
}

/** License Metadata Key in which subcription_id is stored  */
export const SUBSCRIPTION_ID_KEY = 'stripe_subscription_id';
export const SUBSCRIPTION_ID_EMPTY = 'subscription_empty';