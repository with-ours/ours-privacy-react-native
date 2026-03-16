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
});
