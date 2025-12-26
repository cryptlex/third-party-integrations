import { HandlerReturn } from "@shared-utils/index.js";
import { SUBSCRIPTION_ID_METADATA_KEY } from "../utils/getCustomAttributes.js";
import { getLicensesBySubscriptionId } from "@shared-utils/licenseActions.js";
import { CtlxClientType } from "@shared-utils/client.js";

export async function handleSubscriptionChargeCompleted(
  client: CtlxClientType,
  subscriptionChargeCompletedEvent: any
): HandlerReturn {
  const subscriptionChargeCompletedData = subscriptionChargeCompletedEvent.data;
  const requests: any[] = [];
  const responses: any[] = [];
  // logic to renew a license
  if (
    subscriptionChargeCompletedData.status === "successful" &&
    subscriptionChargeCompletedData.order.items.length > 0
  ) {
    try {
      const subscriptionId = subscriptionChargeCompletedData.subscription.id;
      const licenses = await getLicensesBySubscriptionId(
        client,
        subscriptionId,
        SUBSCRIPTION_ID_METADATA_KEY
      );
      for (const license of licenses) {
        const renewalRequest = client.POST("/v3/licenses/{id}/renew", {
          params: {
            path: {
              id: license.id,
            },
          },
        });
        requests.push(renewalRequest);
        if (license?.suspended) {
          const unsuspensionRequest = await client.PATCH("/v3/licenses/{id}", {
            params: {
              path: {
                id: license.id,
              },
            },
            body: {
              suspended: false,
            },
          });
          requests.push(unsuspensionRequest);
        }
      }
      await Promise.all(
        requests.map(async (request) => {
          const response = await request;
          responses.push(response.data);
        })
      );
      return {
        message: "License(s) renewed and unsuspended successfully.",
        data: { responses: responses },
        status: 200,
      };
    } catch (error) {
      throw new Error(
        `Could not process the subscription.charge.completed webhook event with Id ${subscriptionChargeCompletedEvent.id}. ${responses ? `Licenses renewed: ${responses.map((response: any) => response.id).join(", ")}` : "No License renewed"} `
      );
    }
  } else {
    throw new Error(
      `Could not process the subscription.charge.completed webhook event with Id ${subscriptionChargeCompletedEvent.id}.`
    );
  }
}
