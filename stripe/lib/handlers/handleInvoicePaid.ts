import Stripe from "stripe";
import { getSubscriptionId, SUBSCRIPTION_ID_KEY } from "../utils/getSubscriptionId";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { insertUser } from "@shared-utils/userActions";

/**  Find the license carrying the subscription ID in its metadata and renew its expiry. */
async function renewLicenseBySubscriptionId({ client, subscriptionId, productId }: { client: CtlxClientType, subscriptionId: string, productId?: string }): HandlerReturn {
    const {data,error} = await client.GET('/v3/licenses', {
        params: {
            query: {
                ...(productId ? { "productId": { eq: productId } } : {}),
                "metadata.key": {
                    eq: SUBSCRIPTION_ID_KEY
                },
                "metadata.value": {
                    eq: subscriptionId
                },
            }
        }
    });
    if (error) {
      throw new Error(
        `While attempting to retrieve license: ${error.message}`,
      );
    }

    const licenseId = data?.[0]?.id;

    if (!licenseId) {
        throw new Error(`While attempting to renew license, no license with ${subscriptionId} value in the metadata key ${SUBSCRIPTION_ID_KEY} was found.`)
    }

    const license = await client.POST('/v3/licenses/{id}/renew', {
        params: {
            path: {
                id: licenseId
            }
        }
    });
    if (license.error) {
        throw new Error(`Error while attempting to renew license: ${license.error.message}`);
    }

    return ({ data: { license: license.data }, message: `License renewed with new expiry date set to: ${license.data?.expiresAt}`, status: 201 });
}

export async function handleInvoicePaid({ event, productId, client }: { event: Stripe.InvoicePaidEvent, productId: string, client: CtlxClientType }): HandlerReturn {
    const invoice = event.data.object
    const subscriptionId = getSubscriptionId(invoice.parent?.subscription_details?.subscription);

    if (!invoice.customer_email) {
        throw new Error(`Customer email not found in invoice with ID: ${invoice.id}`);
    }

    if (invoice.status == "paid" && invoice.billing_reason == "subscription_create") {
        const email = invoice.customer_email;
        const userName = invoice.customer_name ?? `Stripe Invoice ${invoice.id}`;
        const userId = await insertUser(email, userName, client);

        const license = await client.POST('/v3/licenses', {
            body: {
                productId: productId,
                userId: userId,
                metadata: [
                    { key: SUBSCRIPTION_ID_KEY, value: subscriptionId, viewPermissions: [] }
                ]
            }
        });

        if (license.error) {
            throw new Error(license.error.message);
        }

        return { message: "License created successfully.", data: { license: license.data }, status: 200 };
    }
    else if (invoice.status == "paid" && invoice.billing_reason == "subscription_cycle") {
        return renewLicenseBySubscriptionId({ client, subscriptionId, productId });
    }
    else {
        throw new Error(`Unhandled event of type "${event.type}". Invoice status: ${invoice.status}, Billing reason: ${invoice.billing_reason}.`);
    }
}

export async function handleInvoicePaidV2({ event, client }: { event: Stripe.InvoicePaidEvent, client: CtlxClientType }): HandlerReturn {
    const invoice = event.data.object
    const subscriptionId = getSubscriptionId(invoice.parent?.subscription_details?.subscription);

    if (!invoice.customer_email) {
        throw new Error(`Customer email not found in invoice with ID: ${invoice.id}`);
    }

    if (invoice.status == "paid" && invoice.billing_reason == "subscription_cycle") {
        return renewLicenseBySubscriptionId({ client, subscriptionId });
    }
    else if (invoice.status == "paid" && invoice.billing_reason == "subscription_create") {
        // License creation is handled by the checkout.session.completed event, so the
        // subscription's first invoice is acknowledged without any action.
        return { message: `Ignored invoice ${invoice.id} with billing reason "subscription_create". License creation is handled via checkout session.`, data: {}, status: 200 };
    }
    else {
        throw new Error(`Unhandled event of type "${event.type}". Invoice status: ${invoice.status}, Billing reason: ${invoice.billing_reason}.`);
    }
}
