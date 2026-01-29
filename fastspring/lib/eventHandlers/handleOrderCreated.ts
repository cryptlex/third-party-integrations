import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { createLicense } from "@shared-utils/licenseActions";
import { insertUser } from "@shared-utils/userActions";
import {
  getCustomAttributes,
  ORDER_ID_METADATA_KEY,
  DRIVER_METADATA_KEY,
  QUANTITY_MAPPING_MODE_ALLOWED_ACTIVATIONS,
  QUANTITY_MAPPING_MODE_LICENSE_COUNT,
  SUBSCRIPTION_ID_METADATA_KEY,
} from "../utils/getCustomAttributes";
import { getSubscriptionProperties } from "../utils/getSubscriptionProperties";
import { components } from "@cryptlex/web-api-types/production";
type LicenseRequestModel = components["schemas"]["LicenseRequestModel"];

export type subscriptionProperties = {
  subscriptionInterval: string;
  subscriptionStartTrigger: LicenseRequestModel["subscriptionStartTrigger"];
};
/**
 * Create a license on order.completed event (handles both one time and subscription based licenses)
 * @param data
 */
export async function handleOrderCreated(
  client: CtlxClientType,
  orderCompletedEvent: any
): HandlerReturn {
  const orderCompletedData = orderCompletedEvent.data;
  const licenses: any[] = [];
  const licenseRequests: any[] = [];
  let userId: string | null = null;
  const parentSubscriptionPropertiesDictionary: Record<
    string,
    subscriptionProperties
  > = {};

  if (orderCompletedData.completed && orderCompletedData.items.length > 0) {
    try {
      userId = await insertUser(
        orderCompletedData.customer.email,
        orderCompletedData.customer.first,
        client,
        orderCompletedData.customer.last,
        orderCompletedData.customer.company
      );
      for (const item of orderCompletedData.items) {
        const customAttributes: {
          productId: string;
          licenseTemplateId: string;
          subscriptionInterval?: string;
          mappingsQuantity?: string;
          isBundle?: boolean;
        } = getCustomAttributes(item);
        let metadata: Array<{
          key: string;
          value: string;
          viewPermissions: [];
        }> = [];
        let subscriptionInterval: string | undefined =
          customAttributes?.subscriptionInterval;
        let subscriptionStartTrigger:
          | LicenseRequestModel["subscriptionStartTrigger"]
          | undefined = undefined;
        if (customAttributes?.isBundle) {
          // the bundle product itself won't be created in cryptlex, so we skip it
          continue;
        }
        // Check if this is a bundle item
        if (item?.driver?.type === "bundle") {
          // Bundle item: extract bundle product name from driver.path
          const bundleProductName = item.driver.path;
          metadata = [
            {
              key: ORDER_ID_METADATA_KEY,
              value: orderCompletedData.id,
              viewPermissions: [],
            },
            {
              key: DRIVER_METADATA_KEY,
              value: `bundle_${bundleProductName}`,
              viewPermissions: [],
            },
          ];
          // Bundle items are not subscription based, so set subscriptionInterval to empty string for perpetual licenses
          subscriptionInterval = "";
        }
        // Check if this is an add-on (has parentSubscription)
        else if (item.parentSubscription && item?.driver?.type === "addon") {
          // Add-on: extract parent subscription ID and product name
          const parentSubscriptionId = item.parentSubscription;
          const parentProductName = item.driver.path;
          metadata = [
            {
              key: SUBSCRIPTION_ID_METADATA_KEY,
              value: parentSubscriptionId,
              viewPermissions: [],
            },
            {
              key: DRIVER_METADATA_KEY,
              value: `addon_${parentProductName}`,
              viewPermissions: [],
            },
          ];

          const parentSubscriptionProperties = await getSubscriptionProperties(
            parentSubscriptionId,
            orderCompletedData.items,
            parentSubscriptionPropertiesDictionary,
            client
          );
          subscriptionInterval =
            parentSubscriptionProperties.subscriptionInterval;
          subscriptionStartTrigger =
            parentSubscriptionProperties.subscriptionStartTrigger;
        }
        // Regular subscription or one-time product
        else if (item?.subscription) {
          // Subscription based licenses
          const subscriptionId = item.subscription.id;
          metadata = [
            {
              key: SUBSCRIPTION_ID_METADATA_KEY,
              value: subscriptionId,
              viewPermissions: [],
            },
          ];
          subscriptionInterval =
            item.attributes?.cryptlex_license_subscription_interval;
        } else {
          // One time licenses
          metadata = [
            {
              key: ORDER_ID_METADATA_KEY,
              value: orderCompletedData.id,
              viewPermissions: [],
            },
          ];
        }

        const body: LicenseRequestModel = {
          productId: customAttributes.productId,
          licenseTemplateId: customAttributes.licenseTemplateId,
          metadata: metadata,
          userId: userId,
        };
        if (
          subscriptionInterval !== undefined &&
          subscriptionInterval !== null
        ) {
          body.subscriptionInterval = subscriptionInterval;
        }
        if (subscriptionStartTrigger) {
          body.subscriptionStartTrigger = subscriptionStartTrigger;
        }
        if (
          customAttributes?.mappingsQuantity ===
          QUANTITY_MAPPING_MODE_ALLOWED_ACTIVATIONS
        ) {
          body.allowedActivations = Number(item.quantity);
        }

        let createdCount = 0;
        do {
          const licenseRequest = createLicense(client, body);
          licenseRequests.push(licenseRequest);
          createdCount += 1;
        } while (
          createdCount < Number(item.quantity) &&
          (!customAttributes.mappingsQuantity ||
            customAttributes.mappingsQuantity ===
              QUANTITY_MAPPING_MODE_LICENSE_COUNT)
        );
      }

      await Promise.all(
        licenseRequests.map(async (licenseRequest) => {
          const license = await licenseRequest;
          licenses.push(license.data.license);
        })
      );
      return {
        message: "Licenses created successfully.",
        data: { licenses: licenses },
        status: 201,
      };
    } catch (error) {
      throw new Error(
        `Could not process the order.completed webhook event with Id ${orderCompletedEvent.id}. ${userId ? `User ID: ${userId} created` : "User ID not created"}.
       ${licenses.length ? `Licenses created: ${licenses.map((license: any) => license.id).join(", ")}` : "No License created"}.
       Failure reason: ${error} `
      );
    }
  } else {
    throw new Error(
      `Could not process the order.completed webhook event with Id ${orderCompletedEvent.id}.
      Order was not completed.`
    );
  }
}
