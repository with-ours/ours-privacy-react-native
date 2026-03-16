import {OursPrivacyType} from "oursprivacy-react-native/javascript/oursprivacy-constants";

jest.mock("oursprivacy-react-native/javascript/oursprivacy-core", () => ({
  OursPrivacyCore: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    startProcessingQueue: jest.fn(),
    addToOursPrivacyQueue: jest.fn(),
    flush: jest.fn(),
  })),
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-queue", () => ({
  OursPrivacyQueueManager: {
    initialize: jest.fn(),
    enqueue: jest.fn(),
    getQueue: jest.fn().mockReturnValue([]),
    spliceQueue: jest.fn(),
    clearQueue: jest.fn().mockResolvedValue(undefined),
  },
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
      setLoggingEnabled: jest.fn(),
      getLoggingEnabled: jest.fn().mockReturnValue(true),
      setServerURL: jest.fn(),
      setIsManuallySetId: jest.fn(),
    }),
  },
}));

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
    const options = {default_event_properties: {superProp1: "value1", superProp2: "value2"}};
    const serverURL = "https://api.oursprivacy.com";

    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      options,
      serverURL
    );

    expect(oursprivacyMain.core.initialize).toHaveBeenCalledWith(token);
  });

  it("should override persistent visitor_id when visitor_id is provided in options", async () => {
    await oursprivacyMain.initialize(token, false, false, { visitor_id: "preset-visitor-123" }, "https://cdn.oursprivacy.com");
    expect(oursprivacyMain.oursprivacyPersistent.updateDeviceId).toHaveBeenCalledWith(token, "preset-visitor-123");
    expect(oursprivacyMain.oursprivacyPersistent.updateDistinctId).toHaveBeenCalledWith(token, "preset-visitor-123");
    expect(oursprivacyMain.oursprivacyPersistent.persistDeviceId).toHaveBeenCalledWith(token);
    expect(oursprivacyMain.oursprivacyPersistent.persistDistinctId).toHaveBeenCalledWith(token);
  });

  it("should preserve init options when starting opted out", async () => {
    await oursprivacyMain.initialize(
      token,
      false,
      true,
      {
        visitor_id: "preset-visitor-123",
        default_event_properties: {platform: "mobile"},
        default_user_custom_properties: {plan: "pro"},
        default_user_consent_properties: {marketing: true},
      },
      "https://api.oursprivacy.com"
    );

    expect(oursprivacyMain.config.setServerURL).toHaveBeenCalledWith(
      token,
      "https://api.oursprivacy.com"
    );
    expect(oursprivacyMain.oursprivacyPersistent.updateOptedOut).toHaveBeenCalledWith(
      token,
      true
    );
    expect(oursprivacyMain.oursprivacyPersistent.updateDeviceId).toHaveBeenCalledWith(
      token,
      "preset-visitor-123"
    );
    expect(oursprivacyMain._defaultEventProperties[token]).toEqual({platform: "mobile"});
    expect(oursprivacyMain._defaultUserCustomProperties[token]).toEqual({plan: "pro"});
    expect(oursprivacyMain._defaultUserConsentProperties[token]).toEqual({marketing: true});
  });

  it("should not track if initialize with optOutTrackingDefault being true", async () => {
    const trackAutomaticEvents = false;
    const optOutTrackingDefault = true;
    const options = {};
    const serverURL = "https://api.oursprivacy.com";

    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      options,
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
    const options = {};
    const serverURL = "https://api.oursprivacy.com";

    await oursprivacyMain.initialize(
      token,
      trackAutomaticEvents,
      optOutTrackingDefault,
      options,
      serverURL
    );
    oursprivacyMain.setLoggingEnabled(token, true);
    const eventName = "Test Event";
    const eventProperties = {prop1: "value1", prop2: "value2"};

    await oursprivacyMain.track(token, eventName, eventProperties);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalled();
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
        visitor_id: "device-id-mock",
        distinct_id: expect.any(String),
        eventProperties: expect.objectContaining({
          prop1: "value1",
          prop2: "value2",
        }),
        defaultProperties: expect.objectContaining({
          device_type: "mobile",
          os_name: expect.any(String),
          version: expect.any(String),
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

  it("hasOptedOutTracking should read the persisted opt-out flag", () => {
    oursprivacyMain.oursprivacyPersistent.getOptedOut.mockReturnValue(true);
    expect(oursprivacyMain.hasOptedOutTracking(token)).toBe(true);
    expect(oursprivacyMain.oursprivacyPersistent.getOptedOut).toHaveBeenCalledWith(token);
  });

  it("optOutTracking should clear queued events before resetting identity", async () => {
    await oursprivacyMain.optOutTracking(token);

    expect(OursPrivacyQueueManager.clearQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS
    );
    expect(oursprivacyMain.oursprivacyPersistent.reset).toHaveBeenCalledWith(token);
  });

  it("setFlushOnBackground should be a safe no-op in JavaScript mode", () => {
    expect(() => oursprivacyMain.setFlushOnBackground(token, false)).not.toThrow();
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

  it("should send correct $identify payload on identify", async () => {
    const newDistinctId = "new-distinct-id";
    await oursprivacyMain.identify(token, newDistinctId);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        event: "$identify",
        visitor_id: "device-id-mock",
        distinct_id: expect.any(String),
        eventProperties: null,
        userProperties: expect.objectContaining({
          external_id: newDistinctId,
        }),
        defaultProperties: expect.objectContaining({
          device_type: "mobile",
        }),
      })
    );
  });

  it("updateDefaultEventProperties should merge into event payload", async () => {
    oursprivacyMain.updateDefaultEventProperties(token, {tier: "pro"});
    await oursprivacyMain.track(token, "Test Event", {});
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        eventProperties: expect.objectContaining({tier: "pro"}),
      })
    );
  });

  it("updateDefaultUserCustomProperties should appear in userProperties", async () => {
    oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "enterprise"});
    await oursprivacyMain.track(token, "Test Event", {});
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        userProperties: expect.objectContaining({
          custom_properties: expect.objectContaining({plan: "enterprise"}),
        }),
      })
    );
  });

  it("updateDefaultUserConsentProperties should appear in userProperties", async () => {
    oursprivacyMain.updateDefaultUserConsentProperties(token, {marketing: true});
    await oursprivacyMain.track(token, "Test Event", {});
    expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS,
      expect.objectContaining({
        userProperties: expect.objectContaining({
          consent: expect.objectContaining({marketing: true}),
        }),
      })
    );
  });

  it("getVisitorId should return the device id", () => {
    const visitorId = oursprivacyMain.getVisitorId(token);
    expect(visitorId).toBe("device-id-mock");
  });

  it("reset should clear default property maps", async () => {
    oursprivacyMain.updateDefaultEventProperties(token, {foo: "bar"});
    oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
    oursprivacyMain.updateDefaultUserConsentProperties(token, {marketing: true});
    await oursprivacyMain.reset(token);
    expect(oursprivacyMain._defaultEventProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserCustomProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserConsentProperties[token]).toEqual({});
  });
});
