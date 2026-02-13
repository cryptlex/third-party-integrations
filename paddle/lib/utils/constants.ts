/** License metadata key for Paddle subscription id (used by getLicensesBySubscriptionId and handlers). */
export const PADDLE_SUBSCRIPTION_ID_METADATA_KEY = 'paddle_subscription_id';

/** License metadata key for Paddle transaction id (used by getLicensesByTransactionId and handlers). */
export const PADDLE_TRANSACTION_ID_METADATA_KEY = 'paddle_transaction_id';

/** User metadata key for Paddle customer id (used to resolve user from transaction customer_id and in customer.created). */
export const PADDLE_CUSTOMER_ID_METADATA_KEY = 'paddle_customer_id';

/** Transaction origin values from Paddle. */
export const TRANSACTION_ORIGIN = {
  WEB: 'web',
  API: 'api',
  SUBSCRIPTION_RECURRING: 'subscription_recurring',
  SUBSCRIPTION_UPDATE: 'subscription_update',
} as const;

// export type TransactionOrigin = (typeof TRANSACTION_ORIGIN)[keyof typeof TRANSACTION_ORIGIN];
