import Stripe from "stripe";
import { getSubscriptionId, SUBCRIPTION_ID_KEY } from "../utils/getSubscriptionId";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { createLicense } from "@shared-utils/licenseActions";
import { insertUser } from "@shared-utils/userActions";


export async function handleCheckoutSessionFlow({ event, productId, client }: { event: Stripe.CheckoutSessionCompletedEvent, productId: string, client: CtlxClientType }): HandlerReturn {
    const email = event.data.object.customer_email ?? event.data.object.customer_details?.email;
    const checkoutSessionId = event.data.object.id;
    if (!email) {
        throw new Error(`Customer email not found in checkout session ${checkoutSessionId}.`);
    }
    const userName = event.data.object.customer_details?.name ?? `Stripe Checkout ${checkoutSessionId}`;
    const userId = await insertUser(email, userName, client);
    const subscriptionId = getSubscriptionId(event.data.object.subscription);

    const body =  {
            productId: productId,
            userId: userId,
            metadata: [
                {
                    key: SUBCRIPTION_ID_KEY,
                    value: subscriptionId,
                    viewPermissions: []
                },

            ]
        }

   return await createLicense(client,body)
}