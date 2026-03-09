import {OursPrivacyType} from "oursprivacy-react-native/javascript/oursprivacy-constants";

jest.mock("oursprivacy-react-native/javascript/oursprivacy-core", () => ({
  OursPrivacyCore: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    startProcessingQueue: jest.fn(),
    addToOursPrivacyQueue: jest.fn(),
    flush: jest.fn(),
  })),
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-network", () => ({
  OursPrivacyNetwork: {
    sendRequest: jest.fn(),
  },
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-persistent", () => {
  return {
    OursPrivacyPersistent: {
      getInstance: jest.fn().mockImplementation(() => {
        return {
          initializationCompletePromise: jest.fn(),
          reset: jest.fn(),
          updateOptedOut: jest.fn(),
          persistOptedOut: jest.fn(),
          getSuperProperties: jest.fn().mockReturnValue({
            company_id: [222],
            superProp1: "value1",
            superProp2: "value2",
          }),
          getDistinctId: jest.fn().mockReturnValue("distinct-id-mock"),
          getDeviceId: jest.fn().mockReturnValue("device-id-mock"),
          getUserId: jest.fn().mockReturnValue("user-id-mock"),
          getOptedOut: jest.fn(),
          getQueue: jest.fn(),
          saveQueue: jest.fn(),
          loadQueue: jest.fn(),
          loadDeviceId: jest.fn(),
          updateDeviceId: jest.fn(),
          persistDeviceId: jest.fn(),
          loadDistinctId: jest.fn(),
          updateDistinctId: jest.fn(),
          persistDistinctId: jest.fn(),
          loadUserId: jest.fn(),
          updateUserId: jest.fn(),
          persistUserId: jest.fn(),
          loadSuperProperties: jest.fn(),
          persistSuperProperties: jest.fn(),
          loadOptedOut: jest.fn(),
          persistOptedOut: jest.fn(),
          loadIdentity: jest.fn(),
          persistIdentity: jest.fn(),
          getIdentity: jest.fn(),
          resetIdentity: jest.fn(),
          getTimeEvents: jest.fn().mockReturnValue({
            "test-event": Math.round(Date.now() / 1000 - 1000),
          }),
          loadTimeEvents: jest.fn(),
          updateTimeEvents: jest.fn(),
          persistTimeEvents: jest.fn(),
          updateSuperProperties: jest.fn(),
        };
      }),
    },
  };
});

jest.mock("oursprivacy-react-native/javascript/oursprivacy-config", () => ({
  OursPrivacyConfig: {
    getInstance: jest.fn().mockReturnValue({
      getFlushInterval: jest.fn().mockReturnValue(1000),
      getFlushBatchSize: jest.fn().mockReturnValue(50),
      getServerURL: jest.fn(),
      getUseIpAddressForGeolocation: jest.fn(),
      setLoggingEnabled: jest.fn(),
      getLoggingEnabled: jest.fn().mockReturnValue(true),
      setServerURL: jest.fn(),
    }),
  },
}));

// jest.mock("oursprivacy-react-native/javascript/oursprivacy-logger", () => {
//   return {
//     OursPrivacyLogger: {
//       log: jest.fn(),
//     },
//   };
// });

const {
  OursPrivacyNetwork,
} = require("oursprivacy-react-native/javascript/oursprivacy-network");

const {
  OursPrivacyCore,
} = require("oursprivacy-react-native/javascript/oursprivacy-core");

const {
  OursPrivacyQueueManager,
} = require("oursprivacy-react-native/javascript/oursprivacy-queue");

const {
  OursPrivacyPersistent,
} = require("oursprivacy-react-native/javascript/oursprivacy-persistent");

const {
  OursPrivacyConfig,
} = require("oursprivacy-react-native/javascript/oursprivacy-config");

describe("OursPrivacyMain", () => {
  let oursprivacyMain;
  const token = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(async () => {
      const OursPrivacyMain = require("oursprivacy-react-native/javascript/oursprivacy-main")
        .default;
      oursprivacyMain = new OursPrivacyMain(token);
      OursPrivacyConfig.getInstance().getLoggingEnabled.mockReturnValue(true);
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should initialize properly", async () => {
    const trackAutomaticEvents = false;
    const optOutTrackingDefault = false;
    const superProperties = {superProp1: "value1", superProp2: "value2"};
    const serverURL = "https://api.oursprivacy.com";

    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      superProperties,
      serverURL
    );

    expect(oursprivacyMain.core.initialize).toHaveBeenCalledWith(token);

    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      company_id: [222],
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("should not track if initialize with optOutTrackingDefault being true", async () => {
    const trackAutomaticEvents = false;
    const optOutTrackingDefault = true;
    const superProperties = {superProp1: "value1", superProp2: "value2"};
    const serverURL = "https://api.oursprivacy.com";


    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      superProperties,
      serverURL
    );

    const eventName = "Test Event";
    const eventProperties = {prop1: "value1", prop2: "value2"};

    expect(
          oursprivacyMain.oursprivacyPersistent.updateOptedOut
        ).toHaveBeenCalledWith(token, true);

    oursprivacyMain.oursprivacyPersistent.getOptedOut.mockReturnValue(true);
    await oursprivacyMain.track(token, eventName, eventProperties);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).not.toHaveBeenCalled();
  });

  it("should track if initialize with optOutTrackingDefault being false", async () => {
    const trackAutomaticEvents = false;
    const optOutTrackingDefault = false;
    const superProperties = {superProp1: "value1", superProp2: "value2"};
    const serverURL = "https://api.oursprivacy.com";

    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      superProperties,
      serverURL
    );
    oursprivacyMain.setLoggingEnabled(token, true);
    const eventName = "Test Event";
    const eventProperties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.track(token, eventName, eventProperties);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalled();
  });

  it("register super properties should update properties", async () => {
    oursprivacyMain.registerSuperProperties(token, {superProp3: "value3"});
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      superProp3: "value3",
      company_id: [222],
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("register super properties once should update properties only once", async () => {
    oursprivacyMain.registerSuperPropertiesOnce(token, {superProp3: "value3"});
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      superProp3: "value3",
      company_id: [222],
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
    oursprivacyMain.registerSuperPropertiesOnce(token, {superProp3: "value4"});
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      superProp3: "value3",
      company_id: [222],
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("unregister super properties should update properties properly", async () => {
    oursprivacyMain.registerSuperPropertiesOnce(token, {superProp3: "value3"});
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      superProp3: "value3",
      company_id: [222],
    });

    oursprivacyMain.unregisterSuperProperty(token, "superProp3");
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      superProp1: "value1",
      superProp2: "value2",
      company_id: [222],
    });
  });

  it("clear super properties should clear properties properly", async () => {
    oursprivacyMain.clearSuperProperties(token);
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {});
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("should send correct payload on track event", async () => {
    const eventName = "Test Event";
    const eventProperties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.track(token, eventName, eventProperties);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        event: eventName,
        properties: expect.objectContaining({
          token: token,
          time: expect.any(Number),
          prop1: "value1",
          prop2: "value2",
          $device_id: "device-id-mock",
          $user_id: "user-id-mock",
          distinct_id: "distinct-id-mock",
          superProp1: "value1", // include super properties
          superProp2: "value2",
        }),
      })
    );
  });

  it("should trigger the flush on the flush call", async () => {
    oursprivacyMain.flush(token);
    expect(oursprivacyMain.core.flush).toHaveBeenCalledWith(token);
  });

  it("setLoggingEnabled should work as expected", async () => {
    oursprivacyMain.setLoggingEnabled(token, true);
    expect(oursprivacyMain.config.setLoggingEnabled).toHaveBeenCalledWith(
      token,
      true
    );
    OursPrivacyConfig.getInstance().getLoggingEnabled.mockReturnValueOnce(true);
    await oursprivacyMain.track(token, "test-event");
    expect(console.log).toHaveBeenCalled();
  });

  it("timeEvent should work as expected", async () => {
    oursprivacyMain.timeEvent(token, "test-event");
    expect(
      oursprivacyMain.oursprivacyPersistent.updateTimeEvents
    ).toHaveBeenCalledWith(token, {"test-event": expect.any(Number)});
    expect(
      oursprivacyMain.oursprivacyPersistent.persistTimeEvents
    ).toHaveBeenCalledWith(token);
  });

  it("eventElapsedTime should work as expected", async () => {
    oursprivacyMain.timeEvent(token, "test-event");
    const elapsedTime = await oursprivacyMain.eventElapsedTime(
      token,
      "test-event"
    );
    expect(elapsedTime).toBeGreaterThan(0);
  });

  it("should update the identity properties on identify", async () => {
    jest.resetModules();
    const newDistinctId = "new-distinct-id";
    await oursprivacyMain.identify(token, newDistinctId);
    expect(
      oursprivacyMain.oursprivacyPersistent.updateDistinctId
    ).toHaveBeenCalledWith(token, newDistinctId);
    expect(oursprivacyMain.oursprivacyPersistent.updateUserId).toHaveBeenCalledWith(
      token,
      newDistinctId
    );
  });

  it("should not update the identity properties if the new distinctid is the save as before", async () => {
    const newDistinctId = "distinct-id-mock";
    await oursprivacyMain.identify(token, newDistinctId);
    expect(
      oursprivacyMain.oursprivacyPersistent.updateDistinctId
    ).toHaveBeenCalledTimes(0);
    expect(oursprivacyMain.oursprivacyPersistent.updateUserId).toHaveBeenCalledTimes(
      0
    );
  });

  it("should send correct payload on set profile properties", async () => {
    const properties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.set(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $set: {prop1: "value1", prop2: "value2"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on setOnce profile properties", async () => {
    const properties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.setOnce(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $set_once: {prop1: "value1", prop2: "value2"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on increment profile properties", async () => {
    const properties = {prop1: 3};

    await oursprivacyMain.increment(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $add: {prop1: 3},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on append profile properties", async () => {
    const properties = {prop1: "value1"};

    await oursprivacyMain.append(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $append: {prop1: "value1"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    await oursprivacyMain.append(token, "testProp", "testValue");

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $append: {testProp: "testValue"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on union profile properties", async () => {
    const properties = {prop1: "value1"};

    await oursprivacyMain.union(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $union: {prop1: "value1"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    await oursprivacyMain.union(token, "testProp", "testValue");

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $union: {testProp: "testValue"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on remove profile properties", async () => {
    const properties = {prop1: "value1"};

    await oursprivacyMain.remove(token, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $remove: {prop1: "value1"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    await oursprivacyMain.remove(token, "testProp", "testValue");

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $remove: {testProp: "testValue"},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on trackCharge", async () => {
    const properties = {prop1: "value1"};
    const charge = 100;

    await oursprivacyMain.trackCharge(token, charge, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $append: {
          $transactions: {
            $amount: 100,
            $time: expect.any(Number),
            prop1: "value1",
          },
        },
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on clearCharge", async () => {
    await oursprivacyMain.clearCharges(token);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $set: {
          $transactions: [],
        },
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on unset profile properties", async () => {
    const property = "prop1";

    await oursprivacyMain.unset(token, property);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $unset: [property],
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on delete profile", async () => {
    await oursprivacyMain.deleteUser(token);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $delete: "null",
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );
  });

  it("should send correct payload on trackWithGroups", async () => {
    const properties = {prop1: "value1"};
    const eventName = "event1";
    const groups = {company_id: 111};
    await oursprivacyMain.trackWithGroups(token, eventName, properties, groups);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        event: "event1",
        properties: expect.objectContaining({
          token: token,
          time: expect.any(Number),
          prop1: "value1",
          $device_id: "device-id-mock",
          $user_id: "user-id-mock",
          distinct_id: "distinct-id-mock",
          superProp1: "value1", // include super properties
          superProp2: "value2",
          company_id: 111,
        }),
      })
    );
  });

  it("should send correct payload on addGroup", async () => {
    await oursprivacyMain.addGroup(token, "company_id", 111);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $union: {company_id: [111]},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      company_id: [222, 111],
      superProp1: "value1",
      superProp2: "value2",
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("should send correct payload on setGroup", async () => {
    await oursprivacyMain.setGroup(token, "company_id", 333);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $set: {company_id: [333]},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      company_id: [333],
      superProp1: "value1",
      superProp2: "value2",
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("should send correct payload on removeGroup", async () => {
    await oursprivacyMain.addGroup(token, "company_id", 111);
    // The company id has been added
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      company_id: [222, 111],
      superProp1: "value1",
      superProp2: "value2",
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);

    await oursprivacyMain.removeGroup(token, "company_id", 111);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.USER,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $remove: {company_id: 111},
        $distinct_id: "distinct-id-mock",
        $device_id: "device-id-mock",
        $user_id: "user-id-mock",
      })
    );

    // The company id has been removed
    expect(
      oursprivacyMain.oursprivacyPersistent.updateSuperProperties
    ).toHaveBeenCalledWith(token, {
      company_id: [222],
      superProp1: "value1",
      superProp2: "value2",
    });
    expect(
      oursprivacyMain.oursprivacyPersistent.persistSuperProperties
    ).toHaveBeenCalledWith(token);
  });

  it("should send correct payload on deleteGroup", async () => {
    await oursprivacyMain.deleteGroup(token);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $delete: "null",
      })
    );
  });

  it("should send correct payload on group set", async () => {
    const properties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.groupSetProperties(token, "company_id", 444, properties);

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $group_id: 444,
        $group_key: "company_id",
        $set: {prop1: "value1", prop2: "value2"},
      })
    );
  });

  it("should send correct payload on group set once", async () => {
    const properties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.groupSetPropertyOnce(
      token,
      "company_id",
      444,
      properties
    );

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $group_id: 444,
        $group_key: "company_id",
        $set_once: {prop1: "value1", prop2: "value2"},
      })
    );
  });

  it("should send correct payload on groupUnsetProperty", async () => {
    await oursprivacyMain.groupUnsetProperty(token, "company_id", 444, "prop1");

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $group_id: 444,
        $group_key: "company_id",
        $unset: ["prop1"],
      })
    );
  });

  it("should send correct payload on groupRemovePropertyValue", async () => {
    await oursprivacyMain.groupRemovePropertyValue(
      token,
      "company_id",
      444,
      "prop1",
      "value1"
    );

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $group_id: 444,
        $group_key: "company_id",
        $remove: {prop1: "value1"},
      })
    );
  });

  it("should send correct payload on groupUnionProperty", async () => {
    await oursprivacyMain.groupUnionProperty(
      token,
      "company_id",
      444,
      "prop1",
      "value1"
    );

    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.GROUPS,
      expect.objectContaining({
        $token: token,
        $time: expect.any(Number),
        $group_id: 444,
        $group_key: "company_id",
        $union: {prop1: "value1"},
      })
    );
  });
});
