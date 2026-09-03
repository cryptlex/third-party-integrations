import Stripe from "stripe";
import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { getLicensesBySubscriptionId } from "@shared-utils/licenseActions";
import { SUBSCRIPTION_ID_KEY } from "../utils/getSubscriptionId";

/** What happens to a license when its subscription is deleted. */
export type CancellationAction = 'revoke' | 'delete';

export function parseCancellationAction(value: unknown): CancellationAction {
  return typeof value === 'string' && value.trim().toLowerCase() === 'delete' ? 'delete' : 'revoke';
}

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

/**
 * Revokes or deletes the subscription's licenses when Stripe deletes (cancels) it.
 */

export async function handleCustomerSubscriptionDeleted({ event, client, cancellationAction = 'revoke' }: { event: Stripe.CustomerSubscriptionDeletedEvent, client: CtlxClientType, cancellationAction?: CancellationAction }): HandlerReturn {
  const subscriptionId = event.data.object.id;
  if (!subscriptionId) {
    throw new Error(
      `Subscription ID not found in ${event.type} event ${event.id}.`,
    );
  }

  const action = cancellationAction === 'delete' ? 'deleted' : 'revoked';
  const processedLicenseIds: string[] = [];
  try {
    const licenses = await getLicensesBySubscriptionId(client, subscriptionId, SUBSCRIPTION_ID_KEY);

    await Promise.all(
      licenses.map(async (license) => {
        const response = cancellationAction === 'delete'
          ? await client.DELETE('/v3/licenses/{id}', {
              params: { path: { id: license.id } },
            })
          : await client.PATCH('/v3/licenses/{id}', {
              params: { path: { id: license.id } },
              body: { revoked: true },
            });
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        processedLicenseIds.push(license.id);
      })
    );

    return {
      message: `License(s) ${action} successfully.`,
      data: { licenseIds: processedLicenseIds, cancellationAction },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the ${event.type} webhook event with Id ${event.id}. ${processedLicenseIds.length ? `Licenses ${action}: ${processedLicenseIds.join(', ')}.` : `No license ${action}.`} ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
