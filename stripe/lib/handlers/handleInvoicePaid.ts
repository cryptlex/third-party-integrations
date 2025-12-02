import Stripe from "stripe";
import { getSubscriptionId, SUBCRIPTION_ID_KEY } from "../utils/getSubscriptionId";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { insertUser } from "@shared-utils/userActions";


export async function handleInvoicePaid({ event, productId, client }: { event: Stripe.InvoicePaidEvent, productId: string, client: CtlxClientType }): HandlerReturn {
    const invoice = event.data.object
    const subscriptionId = getSubscriptionId(invoice.subscription);

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
                    { key: SUBCRIPTION_ID_KEY, value: subscriptionId, viewPermissions: [] }
                ]
            }
        });

        if (license.error) {
            throw new Error(license.error.message);
        }

        return { message: "License created successfully.", data: { license: license.data }, status: 200 };
    }
    else if (invoice.status == "paid" && invoice.billing_reason == "subscription_cycle") {

        // renew license expiry
        const licenses = await client.GET('/v3/licenses', {
            params: {
                query: {
                    "productId": {
                        eq: productId
                    },
                    "metadata.key": {
                        eq: SUBCRIPTION_ID_KEY
                    },
                    "metadata.value": {
                        eq: subscriptionId
                    },
                }
            }
        });

        const licenseId = licenses.data?.[0]?.id;

        if (!licenseId) {
            throw new Error(`While attempting to renew license, no license with ${subscriptionId} value in the metadata key ${SUBCRIPTION_ID_KEY} was found.`)
        }

        const license = await client.POST('/v3/licenses/{id}/renew', {
            params: {
                path: {
                    id: licenseId
                }
            }
        });

        return ({ data: { license: license.data }, message: `License renewed with new expiry date set to: ${license.data?.expiresAt}`, status: 201 });
    }
    else {
        throw new Error(`Unhandled event of type "${event.type}". Invoice status: ${invoice.status}, Billing reason: ${invoice.billing_reason}.`);
    }
}