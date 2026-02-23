import { Hono } from 'hono';
import { CustomerCreatedEvent, EventEntity, Paddle, SubscriptionPausedEvent, TransactionCompletedEvent } from '@paddle/paddle-node-sdk';
import createClient from 'openapi-fetch';
import { paths } from '@cryptlex/web-api-types/production';
import { getAuthMiddleware } from '@shared-utils/client';
import { handleTransactionCompleted } from './handlers/handleTransactionCompleted';
import { handleSubscriptionPaused } from './handlers/handleSubscriptionPaused';
import { handleCustomerCreated } from './handlers/handleCustomerCreated';
import { env } from 'hono/adapter';

const paddle = new Paddle('');

const app = new Hono();

app.post('/v1', async (context) => {
  try {
    const { PADDLE_WEBHOOK_SECRET, CRYPTLEX_ACCESS_TOKEN, CRYPTLEX_WEB_API_BASE_URL } = env(context);

    if (typeof PADDLE_WEBHOOK_SECRET !== 'string') {
      throw new Error('PADDLE_WEBHOOK_SECRET was not found in environment variables.');
    }
    if (typeof CRYPTLEX_ACCESS_TOKEN !== 'string') {
      throw new Error('CRYPTLEX_ACCESS_TOKEN was not found in environment variables.');
    }
    if (typeof CRYPTLEX_WEB_API_BASE_URL !== 'string') {
      throw new Error('CRYPTLEX_WEB_API_BASE_URL was not found in environment variables.');
    }

    const CtlxClient = createClient<paths>({ baseUrl: CRYPTLEX_WEB_API_BASE_URL });
    CtlxClient.use(getAuthMiddleware(CRYPTLEX_ACCESS_TOKEN));

    const paddleSignature = context.req.header('Paddle-Signature');
    if (!paddleSignature) {
      throw new Error('No Paddle-Signature header was found.');
    }
    const rawBody = await context.req.text();

    let eventData: EventEntity;
    try {
      eventData = await paddle.webhooks.unmarshal(rawBody, PADDLE_WEBHOOK_SECRET, paddleSignature);
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? (error as Error).message
          : 'Paddle webhook signature verification failed.';
      throw new Error(message);
    }

    const eventType = String(eventData.eventType);
    console.info(`Paddle webhook event type: ${eventType} verified.`);


    let result;
    switch (eventType) {
      case 'transaction.completed':
        result = await handleTransactionCompleted(CtlxClient, eventData as TransactionCompletedEvent);
        return context.json(result, result.status);
      case 'subscription.paused':
        result = await handleSubscriptionPaused(CtlxClient, eventData as SubscriptionPausedEvent);
        return context.json(result, result.status);
      case 'customer.created':
        result = await handleCustomerCreated(CtlxClient, eventData as CustomerCreatedEvent);
        return context.json(result, result.status);
      default:
        throw new Error(`Webhook with event type ${eventType} is not supported.`);
    }
  } catch (error) {
    console.error(error);
    return context.json(
      {
        message:
          error && typeof error === 'object' && 'message' in error
            ? (error as Error).message
            : `Unexpected error ${error} in integration lambda.`,
      },
      400
    );
  }
});

export default app;
