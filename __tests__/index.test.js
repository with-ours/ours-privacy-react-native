import {OursPrivacy} from "oursprivacy-react-native";
import {NativeModules} from "react-native";

test(`it calls OursPrivacyReactNative initialize`, async () => {
  const oursprivacy = await OursPrivacy.init("token", true);
  expect(NativeModules.OursPrivacyReactNative.initialize).toBeCalledWith(
    "token",
    true,
    false,
    {$lib_version: expect.any(String), op_lib: "react-native"},
    "https://api.oursprivacy.com/api/v1"
  );
});

test(`it calls OursPrivacyReactNative initialize with optOut and superProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init(true, {super: "property"});
  expect(NativeModules.OursPrivacyReactNative.initialize).toBeCalledWith(
    "token",
    true,
    true,
    {
      $lib_version: expect.any(String),
      op_lib: "react-native",
      super: "property",
    },
    "https://api.oursprivacy.com/api/v1"
  );
});

test(`it calls OursPrivacyReactNative setServerURL`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.setServerURL("https://api-eu.oursprivacy.com");
  expect(NativeModules.OursPrivacyReactNative.setServerURL).toBeCalledWith(
    "token",
    "https://api-eu.oursprivacy.com"
  );
});

test(`it calls OursPrivacyReactNative setLoggingEnabled`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.setLoggingEnabled(true);
  expect(NativeModules.OursPrivacyReactNative.setLoggingEnabled).toBeCalledWith(
    "token",
    true
  );
});

test(`it calls OursPrivacyReactNative setUseIpAddressForGeolocation`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.setUseIpAddressForGeolocation(true);
  expect(
    NativeModules.OursPrivacyReactNative.setUseIpAddressForGeolocation
  ).toBeCalledWith("token", true);
});

test(`it calls OursPrivacyReactNative setFlushBatchSize`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.setFlushBatchSize(20);
  expect(NativeModules.OursPrivacyReactNative.setFlushBatchSize).toBeCalledWith(
    "token",
    20
  );
});

test(`it calls OursPrivacyReactNative hasOptedOutTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.hasOptedOutTracking();
  expect(NativeModules.OursPrivacyReactNative.hasOptedOutTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative optInTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.optInTracking();
  expect(NativeModules.OursPrivacyReactNative.optInTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative optOutTracking`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.optOutTracking();
  expect(NativeModules.OursPrivacyReactNative.optOutTracking).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative identify`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.identify("distinct_id");
  expect(NativeModules.OursPrivacyReactNative.identify).toBeCalledWith(
    "token",
    "distinct_id",
    undefined
  );
});

test(`it calls OursPrivacyReactNative alias`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.alias("alias", "distinct_id");
  expect(NativeModules.OursPrivacyReactNative.alias).toBeCalledWith(
    "token",
    "alias",
    "distinct_id"
  );
});

test(`it calls OursPrivacyReactNative track`, async () => {
  const oursprivacy = await OursPrivacy.init("token", true);
  oursprivacy.track("event name", {
    "Cool Property": "Property Value",
  });
  expect(NativeModules.OursPrivacyReactNative.track).toBeCalledWith(
    "token",
    "event name",
    {
      "Cool Property": "Property Value",
      $lib_version: expect.any(String),
      op_lib: "react-native",
    }
  );
});

test(`it calls OursPrivacyReactNative registerSuperProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.registerSuperProperties({
    "super property": "super property value",
    "super property1": "super property value1",
  });
  expect(
    NativeModules.OursPrivacyReactNative.registerSuperProperties
  ).toBeCalledWith("token", {
    "super property": "super property value",
    "super property1": "super property value1",
  });
});

test(`it calls OursPrivacyReactNative registerSuperPropertiesOnce`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.registerSuperPropertiesOnce({
    "super property": "super property value",
    "super property1": "super property value1",
  });
  expect(
    NativeModules.OursPrivacyReactNative.registerSuperProperties
  ).toBeCalledWith("token", {
    "super property": "super property value",
    "super property1": "super property value1",
  });
});

test(`it calls OursPrivacyReactNative unregisterSuperProperty`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.unregisterSuperProperty("super property");
  expect(
    NativeModules.OursPrivacyReactNative.unregisterSuperProperty
  ).toBeCalledWith("token", "super property");
});

test(`it calls OursPrivacyReactNative getSuperProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getSuperProperties();
  expect(NativeModules.OursPrivacyReactNative.getSuperProperties).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative clearSuperProperties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.clearSuperProperties();
  expect(NativeModules.OursPrivacyReactNative.clearSuperProperties).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative timeEvent`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.timeEvent("Timed Event");
  expect(NativeModules.OursPrivacyReactNative.timeEvent).toBeCalledWith(
    "token",
    "Timed Event"
  );
});

test(`it calls OursPrivacyReactNative eventElapsedTime`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.eventElapsedTime("Timed Event");
  expect(NativeModules.OursPrivacyReactNative.eventElapsedTime).toBeCalledWith(
    "token",
    "Timed Event"
  );
});

test(`it calls OursPrivacyReactNative reset`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.reset();
  expect(NativeModules.OursPrivacyReactNative.reset).toBeCalledWith("token");
});

test(`it calls OursPrivacyReactNative getDistinctId`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getDistinctId();
  expect(NativeModules.OursPrivacyReactNative.getDistinctId).toBeCalledWith(
    "token"
  );
});

