import { beforeEach, expect, test, vi } from 'vitest';
import { handleCustomerSubscriptionDeleted, parseCancellationAction } from '../lib/handlers/handleCustomerSubscription';
import Stripe from 'stripe';

const mockGetLicensesBySubscriptionId = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('@shared-utils/licenseActions', () => ({
  getLicensesBySubscriptionId: (...args: unknown[]) => mockGetLicensesBySubscriptionId(...args),
  createLicense: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLicensesBySubscriptionId.mockResolvedValue([{ id: 'lic_01' }, { id: 'lic_02' }]);
  mockPatch.mockResolvedValue({ data: { id: 'lic_01', revoked: true }, error: null });
  mockDelete.mockResolvedValue({ data: undefined, error: null });
});

const getClient = () => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: mockPatch,
  DELETE: mockDelete,
}) as unknown as Parameters<typeof handleCustomerSubscriptionDeleted>[0]['client'];

const getEvent = () => ({
  id: 'evt_01',
  type: 'customer.subscription.deleted',
  data: { object: { id: 'sub_01' } },
}) as unknown as Stripe.CustomerSubscriptionDeletedEvent;

test('revokes all licenses when no cancellation action is configured', async () => {
  const result = await handleCustomerSubscriptionDeleted({ event: getEvent(), client: getClient() });

  expect(mockGetLicensesBySubscriptionId).toHaveBeenCalledWith(
    expect.anything(),
    'sub_01',
    'stripe_subscription_id'
  );
  expect(mockDelete).not.toHaveBeenCalled();
  expect(mockPatch).toHaveBeenCalledTimes(2);
  expect(mockPatch).toHaveBeenCalledWith('/v3/licenses/{id}', {
    params: { path: { id: 'lic_01' } },
    body: { revoked: true },
  });
  expect(result.message).toContain('revoked');
  expect(result.status).toBe(200);
});

test('deletes all licenses when the cancellation action is delete', async () => {
  const result = await handleCustomerSubscriptionDeleted({
    event: getEvent(),
    client: getClient(),
    cancellationAction: 'delete',
  });

  expect(mockPatch).not.toHaveBeenCalled();
  expect(mockDelete).toHaveBeenCalledTimes(2);
  expect(mockDelete).toHaveBeenCalledWith('/v3/licenses/{id}', {
    params: { path: { id: 'lic_01' } },
  });
  expect(result.message).toContain('deleted');
  expect(result.status).toBe(200);
});

test('parses the cancellation action env var case-insensitively and ignores surrounding whitespace', () => {
  expect(parseCancellationAction(' Delete ')).toBe('delete');
  expect(parseCancellationAction('delete')).toBe('delete');
});

test('parsing falls back to revoke when the cancellation action env var is unset or unrecognised', () => {
  expect(parseCancellationAction(undefined)).toBe('revoke');
  expect(parseCancellationAction('')).toBe('revoke');
  expect(parseCancellationAction('destroy')).toBe('revoke');
});

test('throws when a license update fails', async () => {
  mockPatch.mockResolvedValue({ data: null, error: { message: 'License not found.' } });

  await expect(
    handleCustomerSubscriptionDeleted({ event: getEvent(), client: getClient() })
  ).rejects.toThrow(/License not found\./);
});
