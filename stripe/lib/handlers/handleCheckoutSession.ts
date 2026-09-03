import Stripe from "stripe";
import { getPaymentIntentId, getSubscriptionId, SUBSCRIPTION_ID_KEY, TRANSACTION_ID_KEY } from "../utils/getSubscriptionId";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { createLicense } from "@shared-utils/licenseActions";
import { insertUser } from "@shared-utils/userActions";
import { getLicenseParamsFromMetadata, LicenseParams } from "../utils/getLicenseParamsFromMetadata";
import { resolveOrganizationId } from "../utils/getOrganization";

/** Creates the Cryptlex user or organization for a checkout session and issues a license. */
async function createLicenseFromCheckoutSession({ event, client, productId, licenseTemplateId, entitlementSetId, licenseAssignee, organizationId, allowedUsers, licenseKey }: { event: Stripe.CheckoutSessionCompletedEvent, client: CtlxClientType } & LicenseParams): HandlerReturn {
    const session = event.data.object;
    const email = session.customer_email ?? session.customer_details?.email;
    if (!email) {
        throw new Error(`Customer email not found in checkout session ${session.id}.`);
    }

    const metadata = session.mode === "subscription"
        ? [
            {
                key: SUBSCRIPTION_ID_KEY,
                value: getSubscriptionId(session.subscription),
                viewPermissions: []
            }
        ]
        : [
            {
                key: TRANSACTION_ID_KEY,
                value: getPaymentIntentId(session.payment_intent),
                viewPermissions: []
            }
        ];

    // A license goes to either a user or an organization, never both.
    const assignee = licenseAssignee === "organization"
        ? {
            organizationId: await resolveOrganizationId({
                organizationId,
                companyName: session.customer_details?.business_name,
                email,
                allowedUsers: allowedUsers,
                client
            })
        }
        : {
            userId: await insertUser(email, session.customer_details?.name ?? `Stripe Checkout ${session.id}`, client)
        };

    return await createLicense(client, {
        productId,
        licenseTemplateId,
        entitlementSetId: entitlementSetId ?? null,
        // Omitted key lets Cryptlex auto-generate one.
        ...(licenseKey ? { key: licenseKey } : {}),
        ...assignee,
        metadata
    });
}

export async function handleCheckoutSessionFlow({ event, productId, client }: { event: Stripe.CheckoutSessionCompletedEvent, productId: string, client: CtlxClientType }): HandlerReturn {
    return createLicenseFromCheckoutSession({ event, client, productId, licenseTemplateId: '', licenseAssignee: 'user' , allowedUsers: 0 });
}

export async function handleCheckoutSessionFlowV2({ event, client }: { event: Stripe.CheckoutSessionCompletedEvent, client: CtlxClientType }): HandlerReturn {
    return createLicenseFromCheckoutSession({ event, client, ...getLicenseParamsFromMetadata(event.data.object.metadata) });
}
