import { OursPrivacyType } from "oursprivacy-react-native/javascript/oursprivacy-constants";

jest.mock("oursprivacy-react-native/javascript/oursprivacy-queue", () => ({
  OursPrivacyQueueManager: {
    initialize: jest.fn(),
    enqueue: jest.fn(),
    getQueue: jest.fn(),
    spliceQueue: jest.fn(),
    clearQueue: jest.fn(),
  },
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-persistent", () => ({
  OursPrivacyPersistent: {
    getInstance: jest.fn().mockReturnValue({
      getOptedOut: jest.fn(),
    }),
  },
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-network", () => ({
  OursPrivacyNetwork: {
    sendRequest: jest.fn(),
  },
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-config", () => ({
  OursPrivacyConfig: {
    getInstance: jest.fn().mockReturnValue({
      getFlushInterval: jest.fn().mockReturnValue(1000),
      getFlushBatchSize: jest.fn().mockReturnValue(50),
      getServerURL: jest.fn(),
      getUseIpAddressForGeolocation: jest.fn(),
    }),
  },
}));

jest.mock("oursprivacy-react-native/javascript/oursprivacy-logger", () => ({
  OursPrivacyLogger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

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
  OursPrivacyNetwork,
} = require("oursprivacy-react-native/javascript/oursprivacy-network");

describe("OursPrivacyQueueManager", () => {
  let oursprivacyPersistent;
  const token = "test-token";
  const type = OursPrivacyType.EVENTS;
  const data = { event: "testEvent" };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValue(false);
      OursPrivacyQueueManager.getQueue.mockReturnValue([]);
    });
  });

  it("initializes the OursPrivacy queue for events", async () => {
    await OursPrivacyCore().initialize(token);
    expect(OursPrivacyQueueManager.initialize).toHaveBeenCalledWith(
      token,
      expect.any(String)
    );
  });

  it("adds data to the OursPrivacy queue if not opted out and data is valid", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledWith(
      token,
      type,
      expect.any(Object)
    );
  });

  it("do not add data to the OursPrivacy queue if opted out", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(true);
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledTimes(0);
  });

  it("do not add data to the OursPrivacy queue if data is not valid", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    // mock JSON.stringify to throw an error
    jest.spyOn(JSON, "stringify").mockImplementationOnce(() => {
      throw new Error("mock error");
    });
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledTimes(0);
  });

  it("flushes the queue", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    OursPrivacyQueueManager.getQueue.mockImplementation((token, type) => {
      return [data];
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalled();
  });

  it("do not flush the queue if opted out", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(true);
    OursPrivacyQueueManager.getQueue.mockImplementation((token, type) => {
      return [data];
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalledTimes(0);
  });

  it("not flushes the queue if there is no data", async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    OursPrivacyQueueManager.getQueue.mockImplementation((token, type) => {
      return [];
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalledTimes(0);
  });
});
