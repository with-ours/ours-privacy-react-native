import {OursPrivacy} from '../index';

const client = new OursPrivacy();
client.track('purchase', {
  value: 42,
  currency: 'USD',
  details: {items: [{sku: 'book', quantity: 1}], discount: null},
});
client.identify({
  externalId: 'visitor-1',
  customProperties: {plan: 'plus', seats: 3},
  consent: {analytics: true},
});
client.updateDefaultEventProperties({origin: 'demo', enabled: true});
client.updateDefaultUserConsentProperties({marketing: false});

// @ts-expect-error functions cannot be serialized as event properties
client.track('invalid', {callback: () => 'no'});
// @ts-expect-error consent values must be booleans
client.updateDefaultUserConsentProperties({marketing: 'yes'});
