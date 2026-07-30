import {OursPrivacyType} from "oursprivacy-react-native/javascript/oursprivacy-constants";
import packageJson from "../package.json";

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
          getVisitorId: jest.fn().mockReturnValue("visitor-id-mock"),
          getOptedOut: jest.fn(),
          getQueue: jest.fn(),
          saveQueue: jest.fn(),
          loadQueue: jest.fn(),
          loadVisitorId: jest.fn(),
          updateVisitorId: jest.fn(),
          persistVisitorId: jest.fn(),
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
    const options = {
      serverURL: "https://api.oursprivacy.com",
      defaultEventProperties: {superProp1: "value1", superProp2: "value2"},
    };

    await oursprivacyMain.initialize(token, options);

    expect(oursprivacyMain.core.initialize).toHaveBeenCalledWith(token);
  });

  it("should override persistent visitor_id when visitorId is provided in options", async () => {
    await oursprivacyMain.initialize(token, {
      visitorId: "preset-visitor-123",
      serverURL: "https://cdn.oursprivacy.com",
    });
    expect(oursprivacyMain.oursprivacyPersistent.updateVisitorId).toHaveBeenCalledWith(token, "preset-visitor-123");
    expect(oursprivacyMain.oursprivacyPersistent.persistVisitorId).toHaveBeenCalledWith(token);
  });

  it("should preserve init options when starting opted out", async () => {
    await oursprivacyMain.initialize(token, {
      optOutTrackingByDefault: true,
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-123",
      defaultEventProperties: {platform: "mobile"},
      defaultUserCustomProperties: {plan: "pro"},
      defaultUserConsentProperties: {marketing: true},
    });

    expect(oursprivacyMain.config.setServerURL).toHaveBeenCalledWith(
      token,
      "https://api.oursprivacy.com"
    );
    expect(oursprivacyMain.oursprivacyPersistent.updateOptedOut).toHaveBeenCalledWith(
      token,
      true
    );
    expect(oursprivacyMain.oursprivacyPersistent.updateVisitorId).toHaveBeenCalledWith(
      token,
      "preset-visitor-123"
    );
    expect(oursprivacyMain._defaultEventProperties[token]).toEqual({platform: "mobile"});
    expect(oursprivacyMain._defaultUserCustomProperties[token]).toEqual({plan: "pro"});
    expect(oursprivacyMain._defaultUserConsentProperties[token]).toEqual({marketing: true});
  });

  it("should not track if initialize with optOutTrackingByDefault being true", async () => {
    await oursprivacyMain.initialize(token, {
      optOutTrackingByDefault: true,
      serverURL: "https://api.oursprivacy.com",
    });

    const eventName = "Test Event";
    const eventProperties = {prop1: "value1", prop2: "value2"};

    expect(
      oursprivacyMain.oursprivacyPersistent.updateOptedOut
    ).toHaveBeenCalledWith(token, true);

    oursprivacyMain.oursprivacyPersistent.getOptedOut.mockReturnValue(true);
    await oursprivacyMain.track(token, eventName, eventProperties);
    expect(oursprivacyMain.core.addToOursPrivacyQueue).not.toHaveBeenCalled();
  });

  it("should not fire $deep_link_opened or store attribution when opted out", async () => {
    oursprivacyMain.oursprivacyPersistent.getOptedOut.mockReturnValue(true);
    await oursprivacyMain.initialize(token, {
      optOutTrackingByDefault: true,
      serverURL: "https://cdn.oursprivacy.com",
      initialURL: "myapp://open?utm_source=google&gclid=abc&ours_visitor_id=web-123",
    });
    expect(oursprivacyMain.core.addToOursPrivacyQueue).not.toHaveBeenCalled();
    expect(oursprivacyMain._attributionDefaultProperties[token] || {}).toEqual({});
    expect(oursprivacyMain.oursprivacyPersistent.updateVisitorId).not.toHaveBeenCalledWith(token, "web-123");
  });

  it("should track if initialize with optOutTrackingByDefault being false", async () => {
    await oursprivacyMain.initialize(token, {serverURL: "https://api.oursprivacy.com"});
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
        visitor_id: "visitor-id-mock",
        distinct_id: expect.any(String),
        eventProperties: expect.objectContaining({
          prop1: "value1",
          prop2: "value2",
        }),
        defaultProperties: expect.objectContaining({
          device_type: "mobile",
          os_name: expect.any(String),
          version: expect.stringMatching(/^react-native@/),
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

  it("optOutTracking should clear queued events without rotating visitor identity", async () => {
    await oursprivacyMain.optOutTracking(token);

    expect(OursPrivacyQueueManager.clearQueue).toHaveBeenCalledWith(
      token,
      OursPrivacyType.EVENTS
    );
    expect(oursprivacyMain.oursprivacyPersistent.reset).toHaveBeenCalledWith(
      token,
      {preserveVisitorId: true}
    );
  });

  it("optOutTracking should clear attribution and all default properties", async () => {
    await oursprivacyMain.trackDeepLink(token, "myapp://open?utm_source=google&gclid=abc");
    oursprivacyMain.updateDefaultEventProperties(token, {custom: "val"});
    oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
    oursprivacyMain.updateDefaultUserConsentProperties(token, {marketing: true});

    await oursprivacyMain.optOutTracking(token);

    expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultEventProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserCustomProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserConsentProperties[token]).toEqual({});
    const dp = oursprivacyMain.getDefaultProperties(token);
    expect(dp.utm_source).toBeUndefined();
  });

  it("setFlushOnBackground should be a safe no-op in JavaScript mode", () => {
    expect(() => oursprivacyMain.setFlushOnBackground(token, false)).not.toThrow();
  });

  describe("identify", () => {
    it("sends $identify with external_id on the wire when caller passes externalId", async () => {
      const externalId = "new-external-id";
      await oursprivacyMain.identify(token, {externalId});
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$identify",
          userProperties: expect.objectContaining({
            external_id: externalId,
          }),
        })
      );
    });

    it("sends the full $identify payload shape", async () => {
      await oursprivacyMain.identify(token, {externalId: "new-distinct-id"});
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$identify",
          visitor_id: "visitor-id-mock",
          distinct_id: expect.any(String),
          eventProperties: null,
          userProperties: expect.objectContaining({
            external_id: "new-distinct-id",
          }),
          defaultProperties: expect.objectContaining({
            device_type: "mobile",
          }),
        })
      );
    });

    it("merges per-call customProperties on top of default customProperties (was broken before)", async () => {
      oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro", tier: "silver"});
      await oursprivacyMain.identify(token, {
        externalId: "u-1",
        customProperties: {tier: "gold"},
      });
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$identify",
          userProperties: expect.objectContaining({
            external_id: "u-1",
            custom_properties: {plan: "pro", tier: "gold"},
          }),
        })
      );
    });

    it("preserves per-call customProperties even when no defaults are set (fixes the broken guard)", async () => {
      await oursprivacyMain.identify(token, {
        externalId: "u-2",
        customProperties: {tier: "gold"},
      });
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$identify",
          userProperties: expect.objectContaining({
            external_id: "u-2",
            custom_properties: {tier: "gold"},
          }),
        })
      );
    });

    it("preserves per-call consent even when no defaults are set", async () => {
      await oursprivacyMain.identify(token, {
        externalId: "u-3",
        consent: {marketing: true},
      });
      const call = oursprivacyMain.core.addToOursPrivacyQueue.mock.calls[0];
      expect(call[2].userProperties).toEqual({
        external_id: "u-3",
        consent: {marketing: true},
      });
    });

    it("translates camelCase typed fields to snake_case on the wire", async () => {
      await oursprivacyMain.identify(token, {
        email: "u@x.com",
        externalId: "u-4",
        phoneNumber: "+15555555555",
        firstName: "Ada",
        lastName: "Lovelace",
        dateOfBirth: "1815-12-10",
        companyName: "Babbage Ltd",
        jobTitle: "Mathematician",
        gender: "female",
        city: "London",
        state: "England",
        zip: "NW1",
        country: "GB",
        ip: "203.0.113.1",
      });
      const call = oursprivacyMain.core.addToOursPrivacyQueue.mock.calls[0];
      expect(call[2].userProperties).toEqual({
        email: "u@x.com",
        external_id: "u-4",
        phone_number: "+15555555555",
        first_name: "Ada",
        last_name: "Lovelace",
        date_of_birth: "1815-12-10",
        company_name: "Babbage Ltd",
        job_title: "Mathematician",
        gender: "female",
        city: "London",
        state: "England",
        zip: "NW1",
        country: "GB",
        ip: "203.0.113.1",
      });
    });

    it("omits consent when neither defaults nor per-call carry consent", async () => {
      oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
      await oursprivacyMain.identify(token, {externalId: "u-5"});
      const call = oursprivacyMain.core.addToOursPrivacyQueue.mock.calls[0];
      expect(call[2].userProperties).toEqual({
        external_id: "u-5",
        custom_properties: {plan: "pro"},
      });
      expect(call[2].userProperties).not.toHaveProperty("consent");
    });
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

  describe("track with per-call userProperties (CDP parity)", () => {
    it("sends per-call userProperties on the wire when no defaults set", async () => {
      await oursprivacyMain.track(token, "Test Event", {}, {email: "u@x.com"});
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          userProperties: {email: "u@x.com"},
        })
      );
    });

    it("leaves userProperties null when neither defaults nor per-call user props are present", async () => {
      await oursprivacyMain.track(token, "Test Event", {prop1: "v"});
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          userProperties: null,
        })
      );
    });

    it("merges per-call customProperties (camelCase) on top of default custom properties → snake_case on wire", async () => {
      oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro", tier: "silver"});
      await oursprivacyMain.track(token, "Test Event", {}, {
        customProperties: {tier: "gold"},
      });
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          userProperties: expect.objectContaining({
            custom_properties: {plan: "pro", tier: "gold"},
          }),
        })
      );
    });

    it("merges per-call consent on top of default consent properties", async () => {
      oursprivacyMain.updateDefaultUserConsentProperties(token, {analytics: true, marketing: false});
      await oursprivacyMain.track(token, "Test Event", {}, {
        consent: {marketing: true},
      });
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          userProperties: expect.objectContaining({
            consent: {analytics: true, marketing: true},
          }),
        })
      );
    });

    it("spreads top-level per-call user props (e.g. email) onto userProperties alongside merged custom_properties", async () => {
      oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
      await oursprivacyMain.track(token, "Test Event", {}, {
        email: "u@x.com",
        customProperties: {tier: "gold"},
      });
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          userProperties: {
            email: "u@x.com",
            custom_properties: {plan: "pro", tier: "gold"},
          },
        })
      );
    });

    it("omits consent when neither defaults nor per-call user props carry consent", async () => {
      oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
      await oursprivacyMain.track(token, "Test Event", {}, {email: "u@x.com"});
      const call = oursprivacyMain.core.addToOursPrivacyQueue.mock.calls[0];
      const payload = call[2];
      expect(payload.userProperties).toEqual({
        email: "u@x.com",
        custom_properties: {plan: "pro"},
      });
      expect(payload.userProperties).not.toHaveProperty("consent");
    });
  });

  it("getVisitorId should return the visitor id", () => {
    const visitorId = oursprivacyMain.getVisitorId(token);
    expect(visitorId).toBe("visitor-id-mock");
  });

  it("reset should clear default property maps", async () => {
    oursprivacyMain.updateDefaultEventProperties(token, {foo: "bar"});
    oursprivacyMain.updateDefaultUserCustomProperties(token, {plan: "pro"});
    oursprivacyMain.updateDefaultUserConsentProperties(token, {marketing: true});
    await oursprivacyMain.reset(token);
    expect(oursprivacyMain.oursprivacyPersistent.reset).toHaveBeenCalledWith(token);
    expect(oursprivacyMain.config.setIsManuallySetId).toHaveBeenCalledWith(
      token,
      false
    );
    expect(oursprivacyMain._defaultEventProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserCustomProperties[token]).toEqual({});
    expect(oursprivacyMain._defaultUserConsentProperties[token]).toEqual({});
  });

  it("getDefaultProperties should include device_type and merge attribution", async () => {
    const props = oursprivacyMain.getDefaultProperties(token);
    expect(props.device_type).toBe("mobile");
    await oursprivacyMain.trackDeepLink(token, "myapp://open?utm_source=test");
    const propsAfter = oursprivacyMain.getDefaultProperties(token);
    expect(propsAfter.utm_source).toBe("test");
  });

  it("getDefaultProperties should report version as react-native@<semver>", () => {
    const props = oursprivacyMain.getDefaultProperties(token);
    expect(props.version).toBe(`react-native@${packageJson.version}`);
  });

  describe("trackDeepLink", () => {
    it("should parse UTM params into defaultProperties (not eventProperties)", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_source=google&utm_medium=cpc&utm_campaign=spring"
      );
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual(
        expect.objectContaining({
          utm_source: "google",
          utm_medium: "cpc",
          utm_campaign: "spring",
        })
      );
      const dp = oursprivacyMain.getDefaultProperties(token);
      expect(dp.utm_source).toBe("google");
      expect(dp.utm_medium).toBe("cpc");
    });

    it("should parse click IDs into defaultProperties", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?gclid=abc123&fbclid=def456"
      );
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual(
        expect.objectContaining({
          gclid: "abc123",
          fbclid: "def456",
        })
      );
    });

    it("should parse AppLovin params (aleid, alart) into defaultProperties", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?aleid=click_123&alart=user_456"
      );
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual(
        expect.objectContaining({
          aleid: "click_123",
          alart: "user_456",
        })
      );
    });

    it("should fire a $deep_link_opened event with only URL in eventProperties", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_source=email&gclid=xyz"
      );
      const call = oursprivacyMain.core.addToOursPrivacyQueue.mock.calls.find(
        (c) => c[2].event === "$deep_link_opened"
      );
      expect(call).toBeTruthy();
      const eventData = call[2];
      expect(eventData.eventProperties).toEqual(
        expect.objectContaining({url: "myapp://open?utm_source=email&gclid=xyz"})
      );
      expect(eventData.eventProperties.utm_source).toBeUndefined();
      expect(eventData.eventProperties.gclid).toBeUndefined();
      expect(eventData.defaultProperties).toEqual(
        expect.objectContaining({
          utm_source: "email",
          gclid: "xyz",
        })
      );
    });

    it("should replace (not merge) attribution on subsequent deep links", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_campaign=spring&gclid=abc"
      );
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual({
        utm_campaign: "spring",
        gclid: "abc",
      });

      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_source=email"
      );
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual({
        utm_source: "email",
      });
      const dp = oursprivacyMain.getDefaultProperties(token);
      expect(dp.utm_campaign).toBeUndefined();
      expect(dp.gclid).toBeUndefined();
      expect(dp.utm_source).toBe("email");
    });

    it("should update visitor_id when ours_visitor_id is in the URL", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?ours_visitor_id=web-uuid-123&utm_source=email"
      );
      expect(
        oursprivacyMain.oursprivacyPersistent.updateVisitorId
      ).toHaveBeenCalledWith(token, "web-uuid-123");
      expect(oursprivacyMain.config.setIsManuallySetId).toHaveBeenCalledWith(
        token,
        true
      );
    });

    it("should not update visitor_id when ours_visitor_id is absent", async () => {
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_source=google"
      );
      expect(
        oursprivacyMain.oursprivacyPersistent.updateVisitorId
      ).not.toHaveBeenCalled();
    });

    it("should be a no-op for null/undefined/empty URL", async () => {
      await oursprivacyMain.trackDeepLink(token, null);
      await oursprivacyMain.trackDeepLink(token, undefined);
      await oursprivacyMain.trackDeepLink(token, "");
      expect(oursprivacyMain.core.addToOursPrivacyQueue).not.toHaveBeenCalled();
    });

    it("should be a complete no-op when opted out", async () => {
      oursprivacyMain.oursprivacyPersistent.getOptedOut.mockReturnValue(true);
      await oursprivacyMain.trackDeepLink(
        token,
        "myapp://open?utm_source=google&gclid=abc&ours_visitor_id=web-123"
      );
      expect(oursprivacyMain.core.addToOursPrivacyQueue).not.toHaveBeenCalled();
      expect(oursprivacyMain._attributionDefaultProperties[token] || {}).toEqual({});
      expect(oursprivacyMain.oursprivacyPersistent.updateVisitorId).not.toHaveBeenCalled();
      expect(oursprivacyMain.config.setIsManuallySetId).not.toHaveBeenCalled();
    });

    it("should handle URL with no attribution params", async () => {
      await oursprivacyMain.trackDeepLink(token, "myapp://open");
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$deep_link_opened",
          eventProperties: expect.objectContaining({
            url: "myapp://open",
          }),
        })
      );
    });
  });

  describe("setVisitorId", () => {
    it("should update visitor_id and set is_manually_set_id", async () => {
      await oursprivacyMain.setVisitorId(token, "new-visitor-id");
      expect(
        oursprivacyMain.oursprivacyPersistent.updateVisitorId
      ).toHaveBeenCalledWith(token, "new-visitor-id");
      expect(
        oursprivacyMain.oursprivacyPersistent.persistVisitorId
      ).toHaveBeenCalledWith(token);
      expect(oursprivacyMain.config.setIsManuallySetId).toHaveBeenCalledWith(
        token,
        true
      );
    });
  });

  describe("initialURL init option", () => {
    it("should parse deep link on init when initialURL is provided", async () => {
      await oursprivacyMain.initialize(token, {
        initialURL: "myapp://open?utm_source=google&aleid=click_abc",
        serverURL: "https://cdn.oursprivacy.com",
      });
      expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual(
        expect.objectContaining({
          utm_source: "google",
          aleid: "click_abc",
        })
      );
      expect(oursprivacyMain.core.addToOursPrivacyQueue).toHaveBeenCalledWith(
        token,
        OursPrivacyType.EVENTS,
        expect.objectContaining({
          event: "$deep_link_opened",
        })
      );
    });

    it("should handle both visitorId and initialURL in init options", async () => {
      await oursprivacyMain.initialize(token, {
        visitorId: "explicit-visitor-id",
        initialURL: "myapp://open?utm_source=google&ours_visitor_id=url-visitor-id",
        serverURL: "https://cdn.oursprivacy.com",
      });
      // visitorId option is applied first, then initialURL overrides with ours_visitor_id
      expect(
        oursprivacyMain.oursprivacyPersistent.updateVisitorId
      ).toHaveBeenCalledWith(token, "url-visitor-id");
    });
  });

  it("reset should clear attribution from defaultProperties", async () => {
    await oursprivacyMain.trackDeepLink(
      token,
      "myapp://open?utm_source=google&gclid=abc"
    );
    expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual(
      expect.objectContaining({utm_source: "google", gclid: "abc"})
    );
    await oursprivacyMain.reset(token);
    expect(oursprivacyMain._attributionDefaultProperties[token]).toEqual({});
    const dp = oursprivacyMain.getDefaultProperties(token);
    expect(dp.utm_source).toBeUndefined();
  });
});
