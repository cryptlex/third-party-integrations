import { beforeEach, expect, test, vi } from 'vitest';
import { handleTransactionCompleted } from '../lib/handlers/handleTransactionCompleted';
import { EventName } from '@paddle/paddle-node-sdk';
import type { TransactionCompletedEvent } from '@paddle/paddle-node-sdk';

const mockGetOrCreateUserIdByPaddleCustomerId = vi.fn();
const mockCreateLicense = vi.fn();
const mockGetLicensesBySubscriptionId = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mock('@shared-utils/licenseActions', () => ({
  createLicense: (...args: unknown[]) => mockCreateLicense(...args),
  getLicensesBySubscriptionId: (...args: unknown[]) =>
    mockGetLicensesBySubscriptionId(...args),
}));

vi.mock('../lib/utils/paddleUserActions', () => ({
  getOrCreateUserIdByPaddleCustomerId: (...args: unknown[]) =>
    mockGetOrCreateUserIdByPaddleCustomerId(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrCreateUserIdByPaddleCustomerId.mockResolvedValue('user_01');
  mockCreateLicense.mockResolvedValue({
    message: 'License created.',
    data: { license: { id: 'lic_01' } },
    status: 201,
  });
  mockGetLicensesBySubscriptionId.mockResolvedValue([
    { id: 'lic_01', suspended: false },
  ]);
  mockPatch.mockResolvedValue({ data: { id: 'lic_01' }, error: null });
  mockPost.mockResolvedValue({ data: { id: 'lic_01' }, error: null });
});

const baseClient = {
  GET: vi.fn(),
  POST: mockPost,
  PATCH: mockPatch,
  DELETE: vi.fn(),
};

function makeTransactionEvent(
  overrides: Partial<TransactionCompletedEvent['data']>
): TransactionCompletedEvent {
  const defaults: TransactionCompletedEvent['data'] = {
    id: '',
    status: 'draft',
    customerId: null,
    addressId: null,
    businessId: null,
    customData: null,
    currencyCode: 'USD',
    origin: 'web',
    subscriptionId: null,
    invoiceId: null,
    invoiceNumber: null,
    collectionMode: 'automatic',
    discountId: null,
    billingDetails: null,
    billingPeriod: null,
    items: [],
    details: null,
    payments: [],
    checkout: null,
    createdAt: '',
    updatedAt: '',
    billedAt: null,
    revisedAt: null,
  };
  return {
    data: { ...defaults, ...overrides },
    eventId: 'evt_01',
    eventType: EventName.TransactionCompleted,
    notificationId: null,
    occurredAt: '',
  };
}

test('transaction.completed origin web: creates user and licenses', async () => {
  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'web',
    customerId: 'ctm_01',
    subscriptionId: 'sub_01',
    items: [
      {
        price: {
          id: 'pri_01',
          billingCycle: { interval: 'month', frequency: 1 },
        } as TransactionCompletedEvent['data']['items'][0]['price'],
        quantity: 1,
        proration: null,
      },
    ],
    details: {
      lineItems: [
        {
          priceId: 'pri_01',
          quantity: 1,
          product: {
            id: 'prod_01',
            customData: {
              cryptlex_productId: 'prod_clx',
              cryptlex_licenseTemplateId: 'tpl_clx',
            },
            name: '',
            type: null,
            description: null,
            taxCategory: 'standard',
            imageUrl: null,
            status: 'active',
            createdAt: '',
            updatedAt: null,
            importMeta: null
          },
          id: '',
          proration: null,
          taxRate: '',
          unitTotals: null,
          totals: null
        },
      ],
      taxRatesUsed: [],
      totals: null,
      adjustedTotals: null,
      payoutTotals: null,
      adjustedPayoutTotals: null
    },
  });

  const result = await handleTransactionCompleted(client, event);

  expect(mockGetOrCreateUserIdByPaddleCustomerId).toHaveBeenCalledWith(
    client,
    'ctm_01'
  );
  expect(mockCreateLicense).toHaveBeenCalled();
  expect(result.status).toBe(201);
  expect(result.message).toContain('Licenses created');
});

test('transaction.completed origin web: throws when customer_id missing', async () => {
  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'web',
    customerId: null,
    subscriptionId: null,
  });

  await expect(handleTransactionCompleted(client, event)).rejects.toThrow(
    /customer_id/
  );
});

test('transaction.completed origin subscription_recurring: renews licenses', async () => {
  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'subscription_recurring',
    subscriptionId: 'sub_01',
    billingPeriod: { startsAt: '2025-01-01', endsAt: '2025-02-01' },
  });

  const result = await handleTransactionCompleted(client, event);

  expect(mockGetLicensesBySubscriptionId).toHaveBeenCalledWith(
    client,
    'sub_01',
    'paddle_subscription_id'
  );
  expect(mockPost).toHaveBeenCalledWith('/v3/licenses/{id}/renew', {
    params: { path: { id: 'lic_01' } },
  });
  expect(result.status).toBe(200);
  expect(result.message).toContain('renewed');
});

test('transaction.completed origin subscription_recurring: throws when subscription_id missing', async () => {
  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'subscription_recurring',
    subscriptionId: null,
  });

  await expect(handleTransactionCompleted(client, event)).rejects.toThrow(
    /subscription_id/
  );
});

test('transaction.completed origin subscription_update: resumes suspended licenses', async () => {
  mockGetLicensesBySubscriptionId.mockResolvedValue([
    { id: 'lic_01', suspended: true },
  ]);

  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'subscription_update',
    subscriptionId: 'sub_01',
    billingPeriod: { startsAt: '2025-01-01', endsAt: '2025-02-01' },
  });

  const result = await handleTransactionCompleted(client, event);

  expect(mockPatch).toHaveBeenCalledWith('/v3/licenses/{id}', {
    params: { path: { id: 'lic_01' } },
    body: { suspended: false },
  });
  expect(result.status).toBe(200);
  expect(result.message).toContain('resumed');
});

test('transaction.completed unsupported origin: returns 200 with message', async () => {
  const client = baseClient as Parameters<typeof handleTransactionCompleted>[0];

  const event = makeTransactionEvent({
    origin: 'other' as TransactionCompletedEvent['data']['origin'],
    customerId: 'ctm_01',
    subscriptionId: null,
  });

  const result = await handleTransactionCompleted(client, event);

  expect(result.status).toBe(200);
  expect(result.message).toContain('Unsupported');
  expect(result.message).toContain('other');
  expect(mockCreateLicense).not.toHaveBeenCalled();
  expect(mockGetLicensesBySubscriptionId).not.toHaveBeenCalled();
});
