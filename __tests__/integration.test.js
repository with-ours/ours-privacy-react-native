import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

const flushAsyncWork = async (turns = 5) => {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
};

const waitForFetchCalls = async (count, attempts = 20) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (fetchMock.mock.calls.length >= count) {
      return;
    }
    await flushAsyncWork(1);
  }
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(count);
};

describe("OursPrivacy integration flows", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.clearAllMocks();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("runs init -> track -> flush through the real JS stack", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({success: true}), {status: 200});

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy("test-token", false);

    await op.init(false, {
      serverURL: "https://api.oursprivacy.com",
      visitor_id: "preset-visitor-123",
      default_event_properties: {platform: "mobile"},
      default_user_custom_properties: {plan: "pro"},
      default_user_consent_properties: {marketing: true},
    });

    op.track("Purchase", {price: 99});
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe("https://api.oursprivacy.com/ingest");
    expect(body.token).toBe("test-token");
    expect(body.is_manually_set_id).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        event: "Purchase",
        visitor_id: "preset-visitor-123",
        distinct_id: "mock-uuid-v4",
        eventProperties: {
          platform: "mobile",
          price: 99,
        },
        userProperties: {
          custom_properties: {plan: "pro"},
          consent: {marketing: true},
        },
        defaultProperties: expect.objectContaining({
          device_type: "mobile",
          os_name: "iOS",
          version: expect.any(String),
        }),
      })
    );
  });

  it("drops pre-opt-out queued events across optOut -> optIn -> track -> flush", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({success: true}), {status: 200});

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy("test-token", false);

    await op.init(false, {
      serverURL: "https://api-eu.oursprivacy.com",
      visitor_id: "preset-visitor-123",
    });

    op.track("Before Opt Out", {step: 1});
    await flushAsyncWork();

    op.optOutTracking();
    await flushAsyncWork();
    expect(op.hasOptedOutTracking()).toBe(true);

    op.optInTracking();
    await flushAsyncWork();
    expect(op.hasOptedOutTracking()).toBe(false);

    op.track("After Opt In", {step: 2});
    await flushAsyncWork();

    op.flush();
    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    const eventNames = body.data.map((event) => event.event);

    expect(url).toBe("https://api-eu.oursprivacy.com/ingest");
    expect(eventNames).toEqual(["$opt_in", "After Opt In"]);
    expect(eventNames).not.toContain("Before Opt Out");
  });

  it("deep link attribution: initialURL → warm deep link → set visitor → opt cycle → reset", async () => {
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy("test-token", false);

    // Step 1: Init with initialURL — should fire $deep_link_opened and set attribution
    await op.init(false, {
      serverURL: "https://api.oursprivacy.com",
      initialURL: "myapp://open?utm_source=google&utm_medium=cpc&gclid=init_gclid&aleid=init_aleid",
    });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    let deepLinkEvent = body.data.find(e => e.event === "$deep_link_opened");
    expect(deepLinkEvent).toBeTruthy();
    // Attribution in defaultProperties, not eventProperties
    expect(deepLinkEvent.defaultProperties.utm_source).toBe("google");
    expect(deepLinkEvent.defaultProperties.gclid).toBe("init_gclid");
    expect(deepLinkEvent.defaultProperties.aleid).toBe("init_aleid");
    // Only URL in eventProperties
    expect(deepLinkEvent.eventProperties.url).toContain("myapp://open");
    expect(deepLinkEvent.eventProperties.utm_source).toBeUndefined();

    // Step 2: Track after init — attribution should persist in defaultProperties
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    op.track("after_init", {step: 2});
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    let trackEvent = body.data.find(e => e.event === "after_init");
    expect(trackEvent.defaultProperties.utm_source).toBe("google");
    expect(trackEvent.defaultProperties.gclid).toBe("init_gclid");
    const visitorIdAfterInit = trackEvent.visitor_id;

    // Step 3: Warm deep link — replaces attribution, stitches visitor ID
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    await op.trackDeepLink(
      "myapp://products/123?utm_source=applovin&aleid=warm_aleid&ours_visitor_id=web-uuid-123"
    );
    op.track("after_warm_link", {step: 3});
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    deepLinkEvent = body.data.find(e => e.event === "$deep_link_opened");
    trackEvent = body.data.find(e => e.event === "after_warm_link");
    // New attribution replaces old — gclid from init should be gone
    expect(deepLinkEvent.defaultProperties.utm_source).toBe("applovin");
    expect(deepLinkEvent.defaultProperties.aleid).toBe("warm_aleid");
    expect(deepLinkEvent.defaultProperties.gclid).toBeUndefined();
    // Visitor ID stitched from ours_visitor_id
    expect(trackEvent.visitor_id).toBe("web-uuid-123");
    expect(trackEvent.visitor_id).not.toBe(visitorIdAfterInit);
    // is_manually_set_id should be true
    expect(body.is_manually_set_id).toBe(true);

    // Step 4: setVisitorId manually
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    await op.setVisitorId("manual-visitor-id");
    op.track("after_set_visitor", {step: 4});
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find(e => e.event === "after_set_visitor");
    expect(trackEvent.visitor_id).toBe("manual-visitor-id");

    // Step 5: Opt out → deep link (should be complete no-op) → opt in
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    await op.optOutTracking();
    await flushAsyncWork(10);
    await op.trackDeepLink("myapp://open?utm_source=should_not_appear&gclid=nope");
    await flushAsyncWork(10);
    await op.optInTracking();
    await flushAsyncWork(10);
    op.track("after_opt_cycle", {step: 5});
    await flushAsyncWork(10);
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find(e => e.event === "after_opt_cycle");
    // Attribution from opted-out deep link should NOT be present
    expect(trackEvent.defaultProperties.utm_source).toBeUndefined();
    expect(trackEvent.defaultProperties.gclid).toBeUndefined();
    // The $deep_link_opened from the opted-out call should not exist
    const allEvents = body.data.map(e => e.event);
    expect(allEvents).toContain("$opt_in");
    expect(allEvents).not.toContain("$deep_link_opened");

    // Step 6: Reset — should clear everything
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    op.reset();
    await flushAsyncWork(10);
    op.track("after_reset", {step: 6});
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find(e => e.event === "after_reset");
    // No attribution after reset
    expect(trackEvent.defaultProperties.utm_source).toBeUndefined();
    expect(trackEvent.defaultProperties.aleid).toBeUndefined();
    // New visitor_id
    expect(trackEvent.visitor_id).not.toBe("manual-visitor-id");
    expect(trackEvent.visitor_id).not.toBe("web-uuid-123");
  });
});
