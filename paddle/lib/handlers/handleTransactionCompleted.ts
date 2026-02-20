import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import {
  createLicense,
  getLicensesBySubscriptionId,
} from "@shared-utils/licenseActions";
import { getOrCreateUserIdByPaddleCustomerId } from "../utils/paddleUserActions";
import {
  PADDLE_SUBSCRIPTION_ID_METADATA_KEY,
  PADDLE_TRANSACTION_ID_METADATA_KEY,
  TRANSACTION_ORIGIN,
} from "../utils/constants";
import {
  getPaddleItemCustomData,
} from "../utils/getPaddleItemCustomData";
import {
  Interval,
  TransactionCompletedEvent,
  TransactionNotification,
  TransactionOrigin,
} from "@paddle/paddle-node-sdk";

async function handleNewLicense(
  client: CtlxClientType,
  data: TransactionNotification,
  eventId: string,
): Promise<HandlerReturn> {
  const customerId = data.customerId;
  if (!customerId) {
    throw new Error(
      `Unsupported transaction.completed: origin ${data.origin} requires customer_id.`,
    );
  }
  const subscriptionId = data.subscriptionId;
  let subscriptionInterval: string | null = null;
  let oneTimeProductPrice: string[] = [];
  for (const item of data.items) {
    if (!item.price?.billingCycle) {
      if (item.price) {
        oneTimeProductPrice.push(item.price.id);
      }
    } else if (item.price?.billingCycle && !subscriptionInterval) {
      const frequency = item.price?.billingCycle?.frequency;
      const interval: Interval | undefined = item.price?.billingCycle?.interval;

      switch (interval) {
        case "month":
          subscriptionInterval = `P${frequency}M`;
          break;
        case "year":
          subscriptionInterval = `P${frequency}Y`;
          break;
        case "week":
          subscriptionInterval = `P${frequency}W`;
          break;
        case "day":
          subscriptionInterval = `P${frequency}D`;
          break;
        default:
      }
    }
  }

  const licenses: unknown[] = [];
  let userId: string | null = null;
  const licenseRequests: ReturnType<typeof createLicense>[] = [];

  try {
    userId = await getOrCreateUserIdByPaddleCustomerId(client, customerId);
    for (const item of data.details?.lineItems ?? []) {
      const { productId, licenseTemplateId } = getPaddleItemCustomData(item);
      const quantity = item.quantity;
      let metadata = null;
      if (!oneTimeProductPrice.includes(item.priceId)) {
        metadata = [
          {
            key: PADDLE_SUBSCRIPTION_ID_METADATA_KEY,
            value: subscriptionId,
            viewPermissions: [],
          },
        ];
      } else {
        metadata = [
          {
            key: PADDLE_TRANSACTION_ID_METADATA_KEY,
            value: data.id,
            viewPermissions: [],
          },
        ];
      }
      for (let i = 0; i < quantity; i++) {
        licenseRequests.push(
          createLicense(client, {
            productId,
            licenseTemplateId,
            userId,
            metadata,
            subscriptionInterval: oneTimeProductPrice.includes(item.priceId)
              ? ""
              : subscriptionInterval,
          }),
        );
      }
    }
    await Promise.all(
      licenseRequests.map(async (licenseRequest) => {
        const result = await licenseRequest;
        if (result.data?.license) licenses.push(result.data.license);
      }),
    );
    return {
      message: "Licenses created successfully.",
      data: { licenses },
      status: 201,
    };
  } catch (error) {
    throw new Error(
      `Could not process the transaction.completed webhook event with Id ${eventId}. ${userId ? `User ID: ${userId} created.` : "User ID not created."} ${licenses.length ? `Licenses created: ${(licenses as Array<{ id: string }>).map((l) => l.id).join(", ")}.` : "No license created."} ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleRecurringRenewal(
  client: CtlxClientType,
  data: TransactionNotification,
  eventId: string,
): Promise<HandlerReturn> {
  const subscriptionId = data.subscriptionId;
  if (!subscriptionId) {
    throw new Error(
      `Unsupported transaction.completed: origin ${data.origin} requires subscription_id for renewal.`,
    );
  }
  const responses: unknown[] = [];
  try {
    const licenses = await getLicensesBySubscriptionId(
      client,
      subscriptionId,
      PADDLE_SUBSCRIPTION_ID_METADATA_KEY,
    );
    const nextBilledAt: string | undefined = data.billingPeriod?.endsAt;
    const requests: Promise<unknown>[] = [];
    for (const license of licenses) {
      if (license.suspended) {
        // handling this here as paddle docs say resume transaction has origin subscription-update
        // but in practice it has origin subscription-recurring as well so we need to handle both cases
        const response = await client.PATCH("/v3/licenses/{id}", {
          params: { path: { id: license.id } },
          body: { suspended: false },
        });
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        if (nextBilledAt) {
          requests.push(
            client.PATCH("/v3/licenses/{id}/expires-at", {
              params: { path: { id: license.id } },
              body: { expiresAt: nextBilledAt },
            }),
          );
        }
      } else {
        requests.push(
          client.POST("/v3/licenses/{id}/renew", {
            params: { path: { id: license.id } },
          }),
        );
      }
    }
    const results = await Promise.all(
      requests.map(async (request) => {
        const response = (await request) as {
          data: unknown;
          error?: { message: string };
        };
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        return response.data;
      }),
    );
    for (const r of results) {
      if (r != null) responses.push(r);
    }
    return {
      message: "License(s) renewed successfully.",
      data: { responses },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the transaction.completed webhook event with Id ${eventId}. ${responses.length ? `Licenses renewed: ${(responses as Array<{ id?: string }>).map((r) => r?.id).join(", ")}.` : "No license renewed."} ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleSubscriptionResume(
  client: CtlxClientType,
  data: TransactionNotification,
  eventId: string,
): Promise<HandlerReturn> {
  const subscriptionId = data.subscriptionId;
  if (!subscriptionId) {
    throw new Error(
      `Unsupported transaction.completed: origin ${data.origin} requires subscription_id for subscription-update.`,
    );
  }
  const responses: unknown[] = [];
  try {
    const licenses = await getLicensesBySubscriptionId(
      client,
      subscriptionId,
      PADDLE_SUBSCRIPTION_ID_METADATA_KEY,
    );
    const nextBilledAt = data.billingPeriod?.endsAt;
    const perLicensePromises: Promise<unknown>[] = [];
    for (const license of licenses) {
      if (!license.suspended) continue;
      const response = await client.PATCH("/v3/licenses/{id}", {
        params: { path: { id: license.id } },
        body: { suspended: false },
      });
      if (response.error) {
        console.error(response.error);
        throw new Error(response.error.message);
      }
      if (nextBilledAt) {
        perLicensePromises.push(
          client.PATCH("/v3/licenses/{id}/expires-at", {
            params: { path: { id: license.id } },
            body: { expiresAt: nextBilledAt },
          }),
        );
      }
    }
    const results = await Promise.all(
      perLicensePromises.map(async (request) => {
        const response = (await request) as {
          data: unknown;
          error?: { message: string };
        };
        if (response.error) {
          console.error(response.error);
          throw new Error(response.error.message);
        }
        return response.data;
      }),
    );
    for (const r of results) {
      responses.push(r);
    }
    return {
      message: "License(s) resumed and expiry updated successfully.",
      data: { responses },
      status: 200,
    };
  } catch (error) {
    throw new Error(
      `Could not process the transaction.completed webhook event with Id ${eventId}. ${responses.length ? `Licenses resumed: ${(responses as Array<{ id?: string }>).map((r) => r?.id).join(", ")}.` : "No license resumed."} ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function handleTransactionCompleted(
  client: CtlxClientType,
  event: TransactionCompletedEvent,
): HandlerReturn {
  const data: TransactionNotification = event.data;
  const origin: TransactionOrigin = data.origin;
  const _eventId = event.eventId;

  if (origin === TRANSACTION_ORIGIN.WEB || origin === TRANSACTION_ORIGIN.API) {
    return handleNewLicense(client, data, event.eventId);
  }

  if (origin === TRANSACTION_ORIGIN.SUBSCRIPTION_RECURRING) {
    return handleRecurringRenewal(client, data, _eventId);
  }

  if (origin === TRANSACTION_ORIGIN.SUBSCRIPTION_UPDATE) {
    return handleSubscriptionResume(client, data, _eventId);
  }
  return {
    message: `Unsupported transaction.completed origin: ${origin}.`,
    data: {},
    status: 200,
  };
}
