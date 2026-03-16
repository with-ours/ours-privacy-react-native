import { OursPrivacyNetwork } from "oursprivacy-react-native/javascript/oursprivacy-network";
import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  fetchMock.resetMocks();
});

describe("OursPrivacyNetwork", () => {
  const mockToken = "test-token";
  const mockEndpoint = "/ingest";
  const mockServerURL = "https://cdn.oursprivacy.com";
  const mockData = [
    {
      event: "Purchase",
      visitor_id: "uuid-123",
      distinct_id: "per-event-uuid",
      eventProperties: { price: 99 },
      userProperties: null,
      defaultProperties: { device_type: "mobile", os_name: "iOS", version: "1.1.0" },
    },
  ];

  it("sends a successful request", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true, visitor_id: "abc" }), { status: 200 });

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${mockServerURL}${mockEndpoint}`,
      expect.anything()
    );
  });

  it("sends JSON body with token, is_manually_set_id, and data", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 });

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
      isManuallySetId: false,
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(options.body);
    expect(body.token).toBe(mockToken);
    expect(body.is_manually_set_id).toBe(false);
    expect(body.data).toEqual(mockData);
  });

  it("sets is_manually_set_id: true when provided", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 });

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
      isManuallySetId: true,
    });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.is_manually_set_id).toBe(true);
  });

  it("does not include ?ip= query param in the URL", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), { status: 200 });

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("?ip=");
    expect(url).toBe(`${mockServerURL}${mockEndpoint}`);
  });

  it("retries on failure and succeeds", async () => {
    fetchMock.mockResponses(
      [JSON.stringify({}), { status: 500 }],
      [JSON.stringify({ success: true }), { status: 200 }]
    );

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails with an HTTP error and does not retry for client errors", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({}), { status: 400 });

    await expect(
      OursPrivacyNetwork.sendRequest({
        token: mockToken,
        endpoint: mockEndpoint,
        data: mockData,
        serverURL: mockServerURL,
      })
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
