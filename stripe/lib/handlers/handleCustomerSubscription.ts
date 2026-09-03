import Stripe from "stripe";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { getLicensesBySubscriptionId } from "@shared-utils/licenseActions";
import { SUBSCRIPTION_ID_KEY } from "../utils/getSubscriptionId";

/** Suspends or unsuspends every license tagged with this subscription's ID. */
async function setLicensesSuspendedBySubscriptionId({
  event,
  client,
  suspended,
}: {
  event: Stripe.CustomerSubscriptionPausedEvent | Stripe.CustomerSubscriptionResumedEvent;
  client: CtlxClientType;
  suspended: boolean;
}): HandlerReturn {
  const subscriptionId = event.data.object.id;
  if (!subscriptionId) {
    throw new Error(
      `Subscription ID not found in ${event.type} event ${event.id}.`,
    );
  }

  const action = suspended ? "suspended" : "unsuspended";
  const updatedLicenses: unknown[] = [];
  try {
    const licenses = await getLicensesBySubscriptionId(client, subscriptionId, SUBSCRIPTION_ID_KEY);

    await Promise.all(
      licenses.map(async (license) => {
        const response = await client.PATCH('/v3/licenses/{id}', {
          params: { path: { id: license.id } },
          body: { suspended },
        });
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        updatedLicenses.push(response.data);
      })
    );

    return {
      message: `License(s) ${action} successfully.`,
      data: { licenses: updatedLicenses },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the ${event.type} webhook event with Id ${event.id}. ${updatedLicenses.length ? `Licenses ${action}: ${(updatedLicenses as Array<{ id?: string }>).map((license) => license?.id).join(', ')}.` : `No license ${action}.`} ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Suspends the subscription's licenses when Stripe pauses it. */
export async function handleCustomerSubscriptionPaused({ event, client }: { event: Stripe.CustomerSubscriptionPausedEvent, client: CtlxClientType }): HandlerReturn {
  return setLicensesSuspendedBySubscriptionId({ event, client, suspended: true });
}

/** Unsuspends the subscription's licenses when Stripe resumes it. */
export async function handleCustomerSubscriptionResumed({ event, client }: { event: Stripe.CustomerSubscriptionResumedEvent, client: CtlxClientType }): HandlerReturn {
  return setLicensesSuspendedBySubscriptionId({ event, client, suspended: false });
}
