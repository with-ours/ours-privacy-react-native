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
  const mockEndpoint = "/track";
  const mockServerURL = "https://api.oursprivacy.com";
  const mockData = { event: "testEvent" };
  const useIPAddressForGeoLocation = true;

  it("sends a successful request", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({}), { status: 200 });

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
      useIPAddressForGeoLocation,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(mockServerURL + mockEndpoint),
      expect.anything()
    );
  });

  it("retries on failure and succeeds", async () => {
    fetchMock.mockResponses(
      [JSON.stringify({}), { status: 500 }],
      [JSON.stringify({}), { status: 200 }]
    );

    await OursPrivacyNetwork.sendRequest({
      token: mockToken,
      endpoint: mockEndpoint,
      data: mockData,
      serverURL: mockServerURL,
      useIPAddressForGeoLocation,
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
        useIPAddressForGeoLocation,
      })
    ).rejects.toThrow();
    // Assert fetch was called exactly once, indicating no retry was attempted
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
