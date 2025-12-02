
import { CtlxClientType } from "@shared-utils/client.js";
import { HandlerReturn } from "@shared-utils/index.js";
import {  getLicensesBySubscriptionId } from "@shared-utils/licenseActions.js";
import { SUBSCRIPTION_ID_METADATA_KEY } from "../utils/getCustomAttributes.js";

export async function handleSubscriptionDeactivated(
  client: CtlxClientType,
  subscriptionDeactivatedEvent: any
): HandlerReturn {
  const subscriptionDeactivatedData = subscriptionDeactivatedEvent.data;
  const requests: any[] = [];
  const responses: any[] = [];
  // Logic to delete a license
  if (subscriptionDeactivatedData.state == "deactivated") {
    const subscriptionId = subscriptionDeactivatedData.id;
    const licenses = await getLicensesBySubscriptionId(client, subscriptionId, SUBSCRIPTION_ID_METADATA_KEY);
    for (const license of licenses) {
    const licenseId = license.id;
    const request =  client.DELETE(`/v3/licenses/{id}`, {
      params: {
        path: {
          id: licenseId,
        },
      },
    });
    requests.push(request);
  }
  await Promise.all(requests.map(async (request) => {
    await request;
  }))
 
    return {
      message: "License deleted successfully.",
      status: 204
    };
  } else {
    throw new Error(
      `Could not process the subscription.deactivated webhook event with Id ${subscriptionDeactivatedEvent.id}.
       ${responses ? `All licenses were not deleted` : "No License deleted" } `
    );
  }
}
