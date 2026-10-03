import { OursPrivacy } from '../index';

const client = new OursPrivacy();
client.track('purchase', {
  value: 42,
  currency: 'USD',
  details: { items: [{ sku: 'book', quantity: 1 }], discount: null },
});
client.identify({
  externalId: 'visitor-1',
  customProperties: { plan: 'plus', seats: 3 },
  consent: { analytics: true },
});
client.updateDefaultEventProperties({ origin: 'demo', enabled: true });
client.updateDefaultUserConsentProperties({ marketing: false });
client.updateDefaultUserConsentProperties({ analytics: 'granted' });
client.identify({ consent: { analytics: 'granted' } });

const maybeCoupon: string | undefined =
  Math.random() > 0.5 ? 'SAVE10' : undefined;
client.track('purchase', { coupon: maybeCoupon });

interface Order {
  id: string;
  total: number;
  items: { sku: string; quantity: number }[];
}
const order: Order = {
  id: 'order-1',
  total: 42,
  items: [{ sku: 'book', quantity: 1 }],
};
client.track('purchase', order);
client.updateDefaultEventProperties(order);

// @ts-expect-error functions cannot be serialized as event properties
client.track('invalid', { callback: () => 'no' });
// @ts-expect-error functions cannot be serialized as consent values
client.updateDefaultUserConsentProperties({ callback: () => 'no' });
