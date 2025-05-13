import {OursPrivacy} from "oursprivacy-react-native";
import {NativeModules} from "react-native";

test(`it calls OursPrivacyReactNative initialize`, async () => {
  const oursprivacy = await OursPrivacy.init("token", true);
  expect(NativeModules.OursPrivacyReactNative.initialize).toBeCalledWith(
    "token",
    true,
    false,
    {$lib_version: expect.any(String), mp_lib: "react-native"},
    "https://api.oursprivacy.com"
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
      mp_lib: "react-native",
      super: "property",
    },
    "https://api.oursprivacy.com"
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
    "distinct_id"
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
      mp_lib: "react-native",
    }
  );
});

test(`it calls OursPrivacyReactNative trackWithGroups`, async () => {
  const oursprivacy = await OursPrivacy.init("token", true);
  oursprivacy.trackWithGroups(
    "tracked with groups",
    {a: 1, b: 2.3},
    {company_id: "OursPrivacy"}
  );
  expect(NativeModules.OursPrivacyReactNative.trackWithGroups).toBeCalledWith(
    "token",
    "tracked with groups",
    {a: 1, b: 2.3, $lib_version: expect.any(String), mp_lib: "react-native"},
    {company_id: "OursPrivacy"}
  );
});

test(`it calls OursPrivacyReactNative setGroup`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.setGroup("company_id", 12345);
  expect(NativeModules.OursPrivacyReactNative.setGroup).toBeCalledWith(
    "token",
    "company_id",
    12345
  );
});

test(`it calls OursPrivacyReactNative addGroup`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.addGroup("company_id", 12345);
  expect(NativeModules.OursPrivacyReactNative.addGroup).toBeCalledWith(
    "token",
    "company_id",
    12345
  );
});

test(`it calls OursPrivacyReactNative removeGroup`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.removeGroup("company_id", 12345);
  expect(NativeModules.OursPrivacyReactNative.removeGroup).toBeCalledWith(
    "token",
    "company_id",
    12345
  );
});

test(`it calls OursPrivacyReactNative deleteGroup`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.deleteGroup("company_id", 12345);
  expect(NativeModules.OursPrivacyReactNative.deleteGroup).toBeCalledWith(
    "token",
    "company_id",
    12345
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

test(`it calls OursPrivacyReactNative profile set`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().set({
    a: 1,
    b: 2.3,
    c: ["4", 5],
  });
  expect(NativeModules.OursPrivacyReactNative.set).toBeCalledWith("token", {
    a: 1,
    b: 2.3,
    c: ["4", 5],
  });
  // set one property
  oursprivacy.getPeople().set("a", 1);
  expect(NativeModules.OursPrivacyReactNative.set).toBeCalledWith("token", {a: 1});
});

test(`it calls OursPrivacyReactNative profile setOnce`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().setOnce({
    a: 1,
    b: 2.3,
    c: ["4", 5],
  });
  expect(NativeModules.OursPrivacyReactNative.setOnce).toBeCalledWith("token", {
    a: 1,
    b: 2.3,
    c: ["4", 5],
  });
  // set one property
  oursprivacy.getPeople().setOnce("a", 1);
  expect(NativeModules.OursPrivacyReactNative.setOnce).toBeCalledWith("token", {
    a: 1,
  });
});

test(`it calls OursPrivacyReactNative profile increment`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().increment({
    a: 1,
    b: 2.3,
  });
  expect(NativeModules.OursPrivacyReactNative.increment).toBeCalledWith("token", {
    a: 1,
    b: 2.3,
  });
  // set one property
  oursprivacy.getPeople().increment("a", 1);
  expect(NativeModules.OursPrivacyReactNative.increment).toBeCalledWith("token", {
    a: 1,
  });
});

test(`it calls OursPrivacyReactNative profile append`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().append("a", "1");
  expect(NativeModules.OursPrivacyReactNative.append).toBeCalledWith("token", {
    a: "1",
  });
});

test(`it calls OursPrivacyReactNative profile union`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().union("a1", "1");
  expect(NativeModules.OursPrivacyReactNative.union).toBeCalledWith("token", {
    a1: ["1"],
  });
});

test(`it calls OursPrivacyReactNative profile remove`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().remove("a", "1");
  expect(NativeModules.OursPrivacyReactNative.remove).toBeCalledWith("token", {
    a: "1",
  });
});

test(`it calls OursPrivacyReactNative profile unset`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().unset("a");
  expect(NativeModules.OursPrivacyReactNative.unset).toBeCalledWith("token", "a");
});

test(`it calls OursPrivacyReactNative profile trackCharge`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().trackCharge(22.8);
  expect(NativeModules.OursPrivacyReactNative.trackCharge).toBeCalledWith(
    "token",
    22.8,
    {}
  );
});

test(`it calls OursPrivacyReactNative profile clearCharges`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().clearCharges();
  expect(NativeModules.OursPrivacyReactNative.clearCharges).toBeCalledWith(
    "token"
  );
});

test(`it calls OursPrivacyReactNative profile deleteUser`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getPeople().deleteUser();
  expect(NativeModules.OursPrivacyReactNative.deleteUser).toBeCalledWith("token");
});

test(`it calls OursPrivacyReactNative group set properties`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getGroup("company_id", 12345).set("prop_key", "prop_value");
  expect(
    NativeModules.OursPrivacyReactNative.groupSetProperties
  ).toBeCalledWith("token", "company_id", 12345, {prop_key: "prop_value"});
});

test(`it calls OursPrivacyReactNative group set property once`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getGroup("company_id", 12345).setOnce("prop_key", "prop_value");
  expect(
    NativeModules.OursPrivacyReactNative.groupSetPropertyOnce
  ).toBeCalledWith("token", "company_id", 12345, {prop_key: "prop_value"});
});

test(`it calls OursPrivacyReactNative group unset property`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getGroup("company_id", 12345).unset("prop_key");
  expect(NativeModules.OursPrivacyReactNative.groupUnsetProperty).toBeCalledWith(
    "token",
    "company_id",
    12345,
    "prop_key"
  );
});

test(`it calls OursPrivacyReactNative group remove property`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getGroup("company_id", 12345).remove("prop_key", "334");
  expect(
    NativeModules.OursPrivacyReactNative.groupRemovePropertyValue
  ).toBeCalledWith("token", "company_id", 12345, "prop_key", "334");
});

test(`it calls OursPrivacyReactNative group union property`, async () => {
  const oursprivacy = new OursPrivacy("token", true);
  oursprivacy.init();
  oursprivacy.getGroup("company_id", 12345).union("prop_key", "334");
  expect(
    NativeModules.OursPrivacyReactNative.groupRemovePropertyValue
  ).toBeCalledWith("token", "company_id", 12345, "prop_key", "334");
});
