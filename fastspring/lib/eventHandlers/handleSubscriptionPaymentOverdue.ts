import { CtlxClientType } from "@shared-utils/client.js";
import { HandlerReturn } from "@shared-utils/index.js";
import { getLicensesBySubscriptionId } from "@shared-utils/licenseActions.js";
import { SUBSCRIPTION_ID_METADATA_KEY } from "../utils/getCustomAttributes.js";

export async function handleSubscriptionPaymentOverdue(
  client: CtlxClientType,
  paymentOverdueEvent: any
): HandlerReturn {
  const paymentOverdueData = paymentOverdueEvent.data;
  const requests: any[] = [];
  const responses: any[] = [];
  // logic to suspend a license
  if (paymentOverdueData.state == "overdue") {
    try {
      const subscriptionId = paymentOverdueData.id;
      const licenses = await getLicensesBySubscriptionId(
        client,
        subscriptionId,
        SUBSCRIPTION_ID_METADATA_KEY
      );
      for (const license of licenses) {
        const request = client.PATCH("/v3/licenses/{id}", {
          params: {
            path: {
              id: license.id,
            },
          },
          body: {
            suspended: true,
          },
        });
        requests.push(request);
      }
      await Promise.all(
        requests.map(async (request) => {
          const response = await request;
          responses.push(response.data);
        })
      );
      return {
        message: "License suspended successfully.",
        data: { license: responses },
        status: 200,
      };
    } catch (error) {
      throw new Error(
        `Could not process the subscription.payment.overdue webhook event with Id ${paymentOverdueEvent.id}.
         ${responses.length ? `Licenses suspended: ${responses.map((response: any) => response.id).join(", ")}` : "No License suspended"}.
         Failure reason: ${error} `
      );
    }
  } else {
    throw new Error(
      `Could not process the subscription.payment.overdue webhook event with Id ${paymentOverdueEvent.id}.
      Subscription payment was not overdue.`
    );
  }
}
