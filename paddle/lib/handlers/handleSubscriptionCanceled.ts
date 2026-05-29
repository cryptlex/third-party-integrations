import { CtlxClientType } from '@shared-utils/client';
import { HandlerReturn } from '@shared-utils/index';
import { getLicensesBySubscriptionId } from '@shared-utils/licenseActions';
import { PADDLE_SUBSCRIPTION_ID_METADATA_KEY } from '../utils/constants';
import { SubscriptionCanceledEvent } from '@paddle/paddle-node-sdk';

export async function handleSubscriptionCanceled(
  client: CtlxClientType,
  event: SubscriptionCanceledEvent
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
        body: { revoked: true },
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
      message: 'License(s) revoked successfully.',
      data: { licenses: responses },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the subscription.canceled webhook event with Id ${event.eventId ?? 'unknown'}. ${responses.length ? `Licenses revoked: ${(responses as Array<{ id?: string }>).map((r) => r?.id).join(', ')}.` : 'No license revoked.'} ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
