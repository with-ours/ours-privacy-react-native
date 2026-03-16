import {OursPrivacy} from "oursprivacy-react-native";
import {NativeModules} from "react-native";

test(`it calls OursPrivacyReactNative initialize`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  await oursprivacy.init();
  expect(NativeModules.OursPrivacyReactNative.initialize).toBeCalledWith(
    "token",
    true,
    false,
    {},
    "https://cdn.oursprivacy.com"
  );
});

test(`it calls OursPrivacyReactNative initialize with optOut and options`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  await oursprivacy.init(true, {default_event_properties: {prop: "value"}});
  expect(NativeModules.OursPrivacyReactNative.initialize).toBeCalledWith(
    "token",
    true,
    true,
    {default_event_properties: {prop: "value"}},
    "https://cdn.oursprivacy.com"
  );
});

test(`it calls OursPrivacyReactNative setServerURL`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.setServerURL("https://api-eu.oursprivacy.com");
  expect(NativeModules.OursPrivacyReactNative.setServerURL).toBeCalledWith(
    "token",
    "https://api-eu.oursprivacy.com"
  );
});

test(`it calls OursPrivacyReactNative setLoggingEnabled`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.setLoggingEnabled(true);
  expect(NativeModules.OursPrivacyReactNative.setLoggingEnabled).toBeCalledWith(
    "token",
    true
  );
});

test(`it calls OursPrivacyReactNative setFlushBatchSize`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.setFlushBatchSize(20);
  expect(NativeModules.OursPrivacyReactNative.setFlushBatchSize).toBeCalledWith(
    "token",
    20
  );
});

test(`it calls OursPrivacyReactNative hasOptedOutTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.hasOptedOutTracking();
  expect(NativeModules.OursPrivacyReactNative.hasOptedOutTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative optInTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.optInTracking();
  expect(NativeModules.OursPrivacyReactNative.optInTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative optOutTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.optOutTracking();
  expect(NativeModules.OursPrivacyReactNative.optOutTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative identify`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.identify("user@example.com");
  expect(NativeModules.OursPrivacyReactNative.identify).toBeCalledWith(
    "token",
    "user@example.com",
    undefined
  );
});

test(`it calls OursPrivacyReactNative identify with userProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.identify("user@example.com", {email: "user@example.com", external_id: "123"});
  expect(NativeModules.OursPrivacyReactNative.identify).toBeCalledWith(
    "token",
    "user@example.com",
    {email: "user@example.com", external_id: "123"}
  );
});

test(`it calls OursPrivacyReactNative track`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.track("event name", {
    "Cool Property": "Property Value",
  });
  expect(NativeModules.OursPrivacyReactNative.track).toBeCalledWith(
    "token",
    "event name",
    {
      "Cool Property": "Property Value",
    }
  );
});

test(`it calls OursPrivacyReactNative reset`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.reset();
  expect(NativeModules.OursPrivacyReactNative.reset).toBeCalledWith("token");
});

test(`it calls OursPrivacyReactNative updateDefaultEventProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.updateDefaultEventProperties({tier: "pro"});
  expect(NativeModules.OursPrivacyReactNative.updateDefaultEventProperties).toBeCalledWith(
    "token",
    {tier: "pro"}
  );
});

test(`it calls OursPrivacyReactNative updateDefaultUserCustomProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.updateDefaultUserCustomProperties({plan: "enterprise"});
  expect(NativeModules.OursPrivacyReactNative.updateDefaultUserCustomProperties).toBeCalledWith(
    "token",
    {plan: "enterprise"}
  );
});

test(`it calls OursPrivacyReactNative updateDefaultUserConsentProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.updateDefaultUserConsentProperties({marketing: true});
  expect(NativeModules.OursPrivacyReactNative.updateDefaultUserConsentProperties).toBeCalledWith(
    "token",
    {marketing: true}
  );
});
