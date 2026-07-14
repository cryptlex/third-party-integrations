import Stripe from "stripe";
import { getSubscriptionId, SUBSCRIPTION_ID_KEY } from "../utils/getSubscriptionId";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { createLicense } from "@shared-utils/licenseActions";
import { insertUser } from "@shared-utils/userActions";
import { getLicenseParamsFromMetadata } from "../utils/getLicenseParamsFromMetadata";

/** Create the Cryptlex user from the checkout session and issue a license. */
async function createLicenseFromCheckoutSession({ event, client, productId, licenseTemplateId }: { event: Stripe.CheckoutSessionCompletedEvent, client: CtlxClientType, productId: string, licenseTemplateId?: string }): HandlerReturn {
    const session = event.data.object;
    const email = session.customer_email ?? session.customer_details?.email;
    if (!email) {
        throw new Error(`Customer email not found in checkout session ${session.id}.`);
    }
    const userName = session.customer_details?.name ?? `Stripe Checkout ${session.id}`;
    const userId = await insertUser(email, userName, client);
    const subscriptionId = getSubscriptionId(session.subscription);

    return await createLicense(client, {
        productId,
        licenseTemplateId,
        userId,
        metadata: [
            {
                key: SUBSCRIPTION_ID_KEY,
                value: subscriptionId,
                viewPermissions: []
            }
        ]
    });
}

export async function handleCheckoutSessionFlow({ event, productId, client }: { event: Stripe.CheckoutSessionCompletedEvent, productId: string, client: CtlxClientType }): HandlerReturn {
    return createLicenseFromCheckoutSession({ event, client, productId });
}

export async function handleCheckoutSessionFlowV2({ event, client }: { event: Stripe.CheckoutSessionCompletedEvent, client: CtlxClientType }): HandlerReturn {
    const { productId, licenseTemplateId } = getLicenseParamsFromMetadata(event.data.object.metadata);
    return createLicenseFromCheckoutSession({ event, client, productId, licenseTemplateId });
}
