
import { beforeEach, expect, test, vi } from 'vitest';
import { handleSubscriptionCanceled } from '../lib/handlers/handleSubscriptionCanceled';
import { EventName, TimePeriodNotification } from '@paddle/paddle-node-sdk';

const mockGetLicensesBySubscriptionId = vi.fn();
const mockPatch = vi.fn();

vi.mock('@shared-utils/licenseActions', () => ({
  getLicensesBySubscriptionId: (...args: unknown[]) => mockGetLicensesBySubscriptionId(...args),
  createLicense: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLicensesBySubscriptionId.mockResolvedValue([
    { id: 'lic_01', revoked: false },
  ]);
  mockPatch.mockResolvedValue({ data: { id: 'lic_01', revoked: true }, error: null });
});

test('handleSubscriptionCanceled revokes all licenses for subscription', async () => {
  const client = {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: mockPatch,
    DELETE: vi.fn(),
  } as unknown as Parameters<typeof handleSubscriptionCanceled>[0];

  const result = await handleSubscriptionCanceled(client, {
    data: {
          id: 'sub_01',
          status: 'canceled',
          customerId: 'ctm_01',
          addressId: 'addr_01',
          businessId: 'biz_01',
          customData: {},
          createdAt: '2021-01-01',
          updatedAt: '2021-01-01',
          collectionMode: 'manual',
          currencyCode: 'USD',
          startedAt: null,
          firstBilledAt: null,
          nextBilledAt: null,
          pausedAt: null,
          canceledAt: null,
          discount: null,
          billingDetails: null,
          currentBillingPeriod: null,
          billingCycle: new TimePeriodNotification({
              interval: 'month',
              frequency: 1,
            }),
         scheduledChange: null,
         items: [],
         importMeta: null
    },
    eventId: 'evt_01',
    eventType: EventName.SubscriptionCanceled,
    notificationId: null,
    occurredAt: ''
  });

  expect(mockGetLicensesBySubscriptionId).toHaveBeenCalledWith(
    client,
    'sub_01',
    'paddle_subscription_id'
  );
  expect(mockPatch).toHaveBeenCalledWith('/v3/licenses/{id}', {
    params: { path: { id: 'lic_01' } },
    body: { revoked: true },
  });
  expect(result.status).toBe(200);
  expect(result.message).toContain('revoked');
});
