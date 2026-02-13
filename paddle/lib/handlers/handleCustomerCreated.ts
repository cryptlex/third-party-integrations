import { CtlxClientType } from '@shared-utils/client';
import { HandlerReturn } from '@shared-utils/index';
import { findOrCreateUpdateUserForPaddleCustomer } from '../utils/paddleUserActions';
import { CustomerCreatedEvent } from '@paddle/paddle-node-sdk';

export type CustomerCreatedEventData = {
  id: string;
  email: string;
  name: string | null;
};

export async function handleCustomerCreated(
  client: CtlxClientType,
  event: CustomerCreatedEvent
): HandlerReturn {
  const { id: paddleCustomerId, email, name } = event.data;
  if (!email) {
    throw new Error(
      `Could not process the customer.created webhook event with Id ${event.eventId ?? 'unknown'}. Customer email is required.`
    );
  }
  const userId = await findOrCreateUpdateUserForPaddleCustomer(
    client,
    paddleCustomerId,
    email,
    name
  );
  return {
    message: 'User upserted successfully.',
    data: { userId },
    status: 201,
  };
}
