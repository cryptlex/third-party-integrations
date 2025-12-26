import { CtlxClientType } from "@shared-utils/client";
import { HandlerReturn } from "@shared-utils/index";
import { upsertUser } from "@shared-utils/userActions";
import Stripe from "stripe";

export async function handleCustomerCreated({ event, client }: { event: Stripe.CustomerCreatedEvent, client: CtlxClientType }): HandlerReturn {
    const email = event.data.object.email;
    const CustomerCreatedEventId = event.data.object.id;
    if (!email) {
        throw new Error(`Customer email not found in customer created event  ${CustomerCreatedEventId}.`);
    }
    const userName = event.data.object.name;
    if (!userName) {
        throw new Error(`Customer username not found in customer created event  ${CustomerCreatedEventId}.`);
    }
    const userId = await upsertUser(email, userName, client);
    return { message: "User upserted successfully.", data: { userId }, status: 201 };


}