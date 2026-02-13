import { beforeEach, expect, test, vi } from 'vitest';
import { handleCustomerCreated } from '../lib/handlers/handleCustomerCreated';
import { EventName } from '@paddle/paddle-node-sdk';

const mockFindOrCreateUpdateUser = vi.fn();

vi.mock('../lib/utils/paddleUserActions', () => ({
  findOrCreateUpdateUserForPaddleCustomer: (...args: unknown[]) =>
    mockFindOrCreateUpdateUser(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFindOrCreateUpdateUser.mockResolvedValue('user_01');
});

test('handleCustomerCreated calls findOrCreateUpdateUser and returns 201', async () => {
  const client = {} as Parameters<typeof handleCustomerCreated>[0];

  const result = await handleCustomerCreated(client, {
    data: {
      id: 'ctm_01',
      email: 'jo@example.com',
      name: 'Jo Brown',
      marketingConsent: false,
      status: 'active',
      customData: null,
      locale: '',
      createdAt: '',
      updatedAt: '',
      importMeta: null
    },
    eventId: 'evt_01',
    eventType: EventName.CustomerCreated,
    notificationId: null,
    occurredAt: ''
  });

  expect(mockFindOrCreateUpdateUser).toHaveBeenCalledWith(
    client,
    'ctm_01',
    'jo@example.com',
    'Jo Brown'
  );
  expect(result.status).toBe(201);
  expect(result.data?.userId).toBe('user_01');
});

test('handleCustomerCreated throws when email is missing', async () => {
  const client = {} as Parameters<typeof handleCustomerCreated>[0];

  await expect(
    handleCustomerCreated(client, {
      data: {
        id: 'ctm_01', email: '', name: null,
        marketingConsent: false,
        status: 'active',
        customData: null,
        locale: '',
        createdAt: '',
        updatedAt: '',
        importMeta: null
      },
      eventId: 'evt_01',
      eventType: EventName.CustomerCreated,
      notificationId: null,
      occurredAt: ''
    })
  ).rejects.toThrow(/email/);
});
