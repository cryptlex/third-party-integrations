import { CtlxClientType } from '@shared-utils/client';
import { HandlerReturn } from '@shared-utils/index';
import { getLicensesBySubscriptionId } from '@shared-utils/licenseActions';
import { PADDLE_SUBSCRIPTION_ID_METADATA_KEY } from '../utils/constants';
import { SubscriptionPausedEvent } from '@paddle/paddle-node-sdk';

export async function handleSubscriptionPaused(
  client: CtlxClientType,
  event: SubscriptionPausedEvent
): HandlerReturn {
  const subscriptionId = event.data.id;
  const responses: unknown[] = [];
  try {
    const licenses = await getLicensesBySubscriptionId(
      client,
      subscriptionId,
      PADDLE_SUBSCRIPTION_ID_METADATA_KEY
    );
    const requests = licenses.map((license) =>
      client.PATCH('/v3/licenses/{id}', {
        params: { path: { id: license.id } },
        body: { suspended: true },
      })
    );
    await Promise.all(
      requests.map(async (request) => {
        const response = (await request) as { data: unknown; error?: { message: string } };
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        responses.push(response.data);
      })
    );
    return {
      message: 'License(s) suspended successfully.',
      data: { licenses: responses },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the subscription.paused webhook event with Id ${event.eventId ?? 'unknown'}. ${responses.length ? `Licenses suspended: ${(responses as Array<{ id?: string }>).map((r) => r?.id).join(', ')}.` : 'No license suspended.'} ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
