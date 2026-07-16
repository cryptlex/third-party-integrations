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

/**
 * Helper to get Payment Intent ID
 */
export function getPaymentIntentId(paymentIntent: Stripe.PaymentIntent | string | null | undefined): string {
    if (paymentIntent && typeof paymentIntent === 'string') {
        return paymentIntent;
    }
    else if (paymentIntent && typeof paymentIntent === 'object') {
        return paymentIntent.id;
    } else {
        return TRANSACTION_ID_EMPTY;
    }
}

/** License Metadata Key in which subscription_id is stored  */
export const SUBSCRIPTION_ID_KEY = 'stripe_subscription_id';
export const SUBSCRIPTION_ID_EMPTY = 'subscription_empty';

/** License Metadata Key in which payment_intent is stored for one-time payments */
export const TRANSACTION_ID_KEY = 'stripe_transaction_id';
export const TRANSACTION_ID_EMPTY = 'transaction_empty';