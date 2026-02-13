import { beforeEach, expect, test, vi } from 'vitest';
import { handleSubscriptionPaused } from '../lib/handlers/handleSubscriptionPaused';
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
    { id: 'lic_01', suspended: false },
  ]);
  mockPatch.mockResolvedValue({ data: { id: 'lic_01', suspended: true }, error: null });
});

test('handleSubscriptionPaused suspends all licenses for subscription', async () => {
  const client = {
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: mockPatch,
    DELETE: vi.fn(),
  } as unknown as Parameters<typeof handleSubscriptionPaused>[0];

  const result = await handleSubscriptionPaused(client, {
    data: {
      id: 'sub_01', status: 'active', customerId: 'ctm_01', addressId: 'addr_01', businessId: 'biz_01', customData: {}, createdAt: '2021-01-01', updatedAt: '2021-01-01', collectionMode: 'manual',
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
    eventType: EventName.SubscriptionPaused,
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
    body: { suspended: true },
  });
  expect(result.status).toBe(200);
  expect(result.message).toContain('suspended');
});
