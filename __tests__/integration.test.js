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

// Captures the AppState 'change' handler the SDK registers so the test
// can simulate the app moving to background.
const installAppStateCapture = () => {
  const RN = require("react-native");
  const captured = {handler: null, removed: false};
  RN.AppState.addEventListener = jest.fn((event, handler) => {
    if (event === "change") captured.handler = handler;
    return {remove: jest.fn(() => { captured.removed = true; })};
  });
  return captured;
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
    const op = new OursPrivacy();

    await op.init("test-token", {
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-123",
      defaultEventProperties: {platform: "mobile"},
      defaultUserCustomProperties: {plan: "pro"},
      defaultUserConsentProperties: {marketing: true},
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
    const op = new OursPrivacy();

    await op.init("test-token", {
      serverURL: "https://api-eu.oursprivacy.com",
      visitorId: "preset-visitor-123",
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
    const op = new OursPrivacy();

    // Step 1: Init with initialURL — should fire $deep_link_opened and set attribution
    await op.init("test-token", {
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

  it("3-arg track: top-level user props, custom_properties + consent merge, null when empty", async () => {
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy();

    await op.init("test-token", {
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-123",
      defaultUserCustomProperties: {test_user: true},
    });

    // S1: 2-arg backwards compat — default custom only on the wire
    op.track("two_arg_compat", {scenario: 1});
    // S2: 3-arg with top-level user props (email + externalId)
    op.track("three_arg_top_level", {scenario: 2}, {email: "qa@example.com", externalId: "qa-1"});
    // S3: 3-arg with per-call customProperties — merges on top of default {test_user:true}
    op.track("three_arg_custom_merge", {scenario: 3}, {customProperties: {tier: "gold"}});
    // S4: 3-arg with per-call consent — no default consent, should appear verbatim
    op.track("three_arg_consent", {scenario: 4}, {consent: {marketing: true}});

    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const byName = Object.fromEntries(body.data.map((e) => [e.event, e]));

    // S1: backwards compat — default custom_properties only
    expect(byName.two_arg_compat.userProperties).toEqual({
      custom_properties: {test_user: true},
    });

    // S2: top-level keys spread, default custom_properties merged, no consent key
    expect(byName.three_arg_top_level.userProperties).toEqual({
      email: "qa@example.com",
      external_id: "qa-1",
      custom_properties: {test_user: true},
    });
    expect(byName.three_arg_top_level.userProperties.consent).toBeUndefined();

    // S3: custom_properties merged (default + per-call)
    expect(byName.three_arg_custom_merge.userProperties.custom_properties).toEqual({
      test_user: true,
      tier: "gold",
    });

    // S4: consent appears, default custom_properties still merged
    expect(byName.three_arg_consent.userProperties.consent).toEqual({marketing: true});
    expect(byName.three_arg_consent.userProperties.custom_properties).toEqual({test_user: true});

    // S5: separate instance with no defaults and no per-call user props → null
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});
    const op2 = new OursPrivacy();
    await op2.init("test-token-2", {
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-456",
    });
    op2.track("no_user_props_anywhere", {scenario: 5});
    await flushAsyncWork();
    op2.flush();
    await waitForFetchCalls(1);
    const body2 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const s5 = body2.data.find((e) => e.event === "no_user_props_anywhere");
    expect(s5.userProperties).toBeNull();
  });

  it("flushes queued events when the app moves to background", async () => {
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});

    const appState = installAppStateCapture();

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy();

    await op.init("test-token", {
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-bg",
    });

    op.track("Backgrounded Event", {step: 1});
    await flushAsyncWork();

    expect(appState.handler).toEqual(expect.any(Function));
    expect(fetchMock.mock.calls).toHaveLength(0);

    // Simulate the OS pushing the app to background.
    appState.handler("background");

    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe("https://api.oursprivacy.com/ingest");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event).toBe("Backgrounded Event");
  });

  it("does not flush on transitions that are not background/inactive", async () => {
    fetchMock.mockResponse(JSON.stringify({success: true}), {status: 200});

    const appState = installAppStateCapture();

    const {OursPrivacy} = require("oursprivacy-react-native");
    const op = new OursPrivacy();

    await op.init("test-token", {
      serverURL: "https://api.oursprivacy.com",
      visitorId: "preset-visitor-bg2",
    });

    op.track("Foreground Only", {step: 1});
    await flushAsyncWork();

    appState.handler("active");
    await flushAsyncWork();

    expect(fetchMock.mock.calls).toHaveLength(0);
  });
});
