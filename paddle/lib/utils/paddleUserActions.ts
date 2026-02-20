import { createUser, updateUser } from '@shared-utils/userActions';
import { CtlxClientType } from '@shared-utils/client';
import { PADDLE_CUSTOMER_ID_METADATA_KEY } from './constants';

const PLACEHOLDER_EMAIL_DOMAIN = 'cryptlexpaddle.com';

/**
 * Find Cryptlex user id by Paddle customer id (metadata paddle_customer_id).
 * Returns null if not found.
 */
export async function getUserIdByPaddleCustomerId(
  client: CtlxClientType,
  paddleCustomerId: string
): Promise<string | null> {
  const userResponse = await client.GET('/v3/users', {
    params: {
      query: {
        'metadata.key': { eq: PADDLE_CUSTOMER_ID_METADATA_KEY },
        'metadata.value': { eq: paddleCustomerId },
        limit: 1,
      },
    },
  });
  if (userResponse.error) {
    throw new Error(`User search by paddle_customer_id failed: ${userResponse.error.message}.`);
  }
  const user = userResponse.data?.[0];
  return user?.id ?? null;
}

/**
 * Create a placeholder user for a Paddle customer (used when transaction.completed
 * runs before customer.created). Email = {customer_id}@cryptlexpaddle.com,
 * firstName and lastName = customer_id, metadata paddle_customer_id = customer_id.
 */
export async function createPlaceholderUserForPaddleCustomer(
  client: CtlxClientType,
  paddleCustomerId: string
): Promise<string> {
  const email = `${paddleCustomerId}@${PLACEHOLDER_EMAIL_DOMAIN}`;
  const name = paddleCustomerId;
  const metadata = [
    { key: PADDLE_CUSTOMER_ID_METADATA_KEY, value: paddleCustomerId, viewPermissions: [] as [] },
  ];
  return createUser(email, name, client, name, undefined, metadata);
}

/**
 * Get or create user id for a Paddle customer (transaction flow).
 * Queries by paddle_customer_id; if not found, creates placeholder user.
 */
export async function getOrCreateUserIdByPaddleCustomerId(
  client: CtlxClientType,
  paddleCustomerId: string
): Promise<string> {
  let userId = await getUserIdByPaddleCustomerId(client, paddleCustomerId);
  if (!userId) {
    try {
      userId = await createPlaceholderUserForPaddleCustomer(client, paddleCustomerId);
    } catch (error) {
      userId = await getUserIdByPaddleCustomerId(client, paddleCustomerId) ?? null;
      if (!userId) throw error;
    }
  }
  return userId;
}

/**
 * Find-or-create/update user for customer.created: query by paddle_customer_id.
 * If found: PATCH with email and name from event when not null.
 * If not found: create user with email and name from event and set metadata paddle_customer_id.
 */
export async function findOrCreateUpdateUserForPaddleCustomer(
  client: CtlxClientType,
  paddleCustomerId: string,
  email: string,
  name: string | null
): Promise<string> {
  const userId = await getUserIdByPaddleCustomerId(client, paddleCustomerId);
  let firstName = name?.split(' ')[0];
  let lastName = name?.split(' ')[1];
  if (userId) {
    if (email || firstName) {
      await updateUser(userId, firstName ?? paddleCustomerId, client, lastName , undefined, email);
    }
    return userId;
  }
  const metadata = [
    { key: PADDLE_CUSTOMER_ID_METADATA_KEY, value: paddleCustomerId, viewPermissions: [] as [] },
  ];
  return createUser(
    email,
    firstName ?? paddleCustomerId,
    client,
    lastName,
    undefined,
    metadata
  );
}
