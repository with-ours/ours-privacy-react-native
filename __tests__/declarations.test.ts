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
client.trackScreen('Schedule');
client.init('token', {
  trackAutomaticEvents: true,
  appVersion: '2.0.0',
  appBuild: '42',
});

// @ts-expect-error appVersion must be supplied as a string
client.init('token', { appVersion: 2 });
// @ts-expect-error appBuild must be supplied as a string
client.init('token', { appBuild: 42 });
// @ts-expect-error a screen label must be a string
client.trackScreen(123);

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
