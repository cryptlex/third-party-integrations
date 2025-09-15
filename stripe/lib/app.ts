import { Hono } from 'hono';
import { Stripe } from 'stripe';
import { env } from 'hono/adapter';
import { handleInvoicePaid } from './handlers/handleInvoicePaid';
import { handleCheckoutSessionFlow } from './handlers/handleCheckoutSession';
import { handleCustomerCreated } from './handlers/handleCustomerCreated';
import createClient from 'openapi-fetch';
import { paths } from '@cryptlex/web-api-types/production';
import { getAuthMiddleware } from '@shared-utils/client';

const app = new Hono()


app.post('/v1', async (context) => {
    try {
        /**
         * A mechanism is needed to protect this endpoint from attacks such as malicious third parties spoofing Stripe's webhook event objects and sending requests.
         * In this case, you can protect the API by issuing a webhook secret and verifying each request.
         */
        const { STRIPE_WEBHOOK_SECRET, CRYPTLEX_PRODUCT_ID, CRYPTLEX_ACCESS_TOKEN, CRYPTLEX_WEB_API_BASE_URL } = env(context);

        if (typeof (STRIPE_WEBHOOK_SECRET) !== 'string') {
            throw Error('STRIPE_WEBHOOK_SECRET was not found in environment variables.');
        }

        if (typeof (CRYPTLEX_PRODUCT_ID) !== 'string') {
            throw Error('CRYPTLEX_PRODUCT_ID was not found in environment variables.');
        }

        if (typeof (CRYPTLEX_ACCESS_TOKEN) !== 'string') {
            throw Error('CRYPTLEX_ACCESS_TOKEN was not found in environment variables.');
        }

        if (typeof (CRYPTLEX_WEB_API_BASE_URL) !== 'string') {
            throw Error('CRYPTLEX_WEB_API_BASE_URL was not found in environment variables.');
        }

        /** Instantiate Web API client */
        const CtlxClient = createClient<paths>({ baseUrl: CRYPTLEX_WEB_API_BASE_URL });
        /** Register middleware for authentication */
        CtlxClient.use(getAuthMiddleware(CRYPTLEX_ACCESS_TOKEN));

        const signature = context.req.header('stripe-signature');
        if (!signature) {
            throw Error('No stripe-signature header was found.')
        }
        const body = await context.req.text();
        // Verify event to be sent by Stripe.
        const event = await Stripe.webhooks.constructEventAsync(
            body,
            signature,
            STRIPE_WEBHOOK_SECRET
        );
        console.info(`Stripe webhook event:${event.id} with type:${event.type} verified.`);

        let result;
        switch (event.type) {
            case 'invoice.paid':
                result = await handleInvoicePaid({ event: event, productId: CRYPTLEX_PRODUCT_ID, client: CtlxClient });
                return context.json(result, result.status);
            case 'checkout.session.completed':
                result = await handleCheckoutSessionFlow({ event: event, productId: CRYPTLEX_PRODUCT_ID, client: CtlxClient });
                return context.json(result, result.status);
            case 'customer.created':
                result = await handleCustomerCreated({ event: event, client: CtlxClient });
                return context.json(result, result.status);
            default:
                throw Error(`Webhook with event type ${event.type} is not supported.`);
        }
    } catch (error) {
        console.error(error);
        return context.json(
            { message: error && typeof error === 'object' && 'message' in error ? error.message : `Unexpected error ${error} in integration lambda.` },
            400
        );
    }
})

export default app;
