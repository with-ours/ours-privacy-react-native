import {OursPrivacy} from "oursprivacy-react-native";
import OursPrivacyMain from "oursprivacy-react-native/javascript/oursprivacy-main";

// OursPrivacy always uses JS mode. Mock OursPrivacyMain so index.test.js
// verifies the wrapper delegates correctly without executing JS SDK internals.
jest.mock("oursprivacy-react-native/javascript/oursprivacy-main", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      setServerURL: jest.fn(),
      setLoggingEnabled: jest.fn(),
      setFlushOnBackground: jest.fn(),
      setFlushBatchSize: jest.fn(),
      hasOptedOutTracking: jest.fn().mockResolvedValue(false),
      optInTracking: jest.fn(),
      optOutTracking: jest.fn(),
      identify: jest.fn().mockResolvedValue(undefined),
      track: jest.fn(),
      reset: jest.fn(),
      flush: jest.fn(),
      getVisitorId: jest.fn().mockReturnValue("mock-visitor-id"),
      updateDefaultEventProperties: jest.fn(),
      updateDefaultUserCustomProperties: jest.fn(),
      updateDefaultUserConsentProperties: jest.fn(),
    })),
}));

beforeEach(() => {
  OursPrivacyMain.mockClear();
});

const newInitialized = async (token = "token", options = {}) => {
  const op = new OursPrivacy();
  await op.init(token, options);
  return op;
};

test(`init forwards token and options to the impl initialize()`, async () => {
  const op = await newInitialized("token");
  expect(op.oursprivacyImpl.initialize).toHaveBeenCalledWith("token", {});
});

test(`init passes options through verbatim (camelCase)`, async () => {
  const opts = {
    trackAutomaticEvents: false,
    optOutTrackingByDefault: true,
    defaultEventProperties: {prop: "value"},
    visitorId: "preset-visitor-123",
  };
  const op = await newInitialized("token", opts);
  expect(op.oursprivacyImpl.initialize).toHaveBeenCalledWith("token", opts);
});

test(`init passes the storage adapter to the OursPrivacyMain constructor`, async () => {
  const storage = {getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn()};
  await newInitialized("token", {storage});
  expect(OursPrivacyMain).toHaveBeenCalledWith("token", storage);
});

test(`init omits storage when not provided`, async () => {
  await newInitialized("token");
  expect(OursPrivacyMain).toHaveBeenCalledWith("token", undefined);
});

test(`init throws when token is missing or blank`, async () => {
  await expect(new OursPrivacy().init("")).rejects.toThrow();
  await expect(new OursPrivacy().init("   ")).rejects.toThrow();
  await expect(new OursPrivacy().init(undefined)).rejects.toThrow();
});

test(`methods throw if called before init()`, () => {
  const op = new OursPrivacy();
  expect(() => op.track("e")).toThrow(/init/);
  expect(() => op.reset()).toThrow(/init/);
  expect(() => op.flush()).toThrow(/init/);
  expect(() => op.getVisitorId()).toThrow(/init/);
});

test(`identify before init() throws`, async () => {
  const op = new OursPrivacy();
  expect(() => op.identify({email: "a@b.com"})).toThrow(/init/);
});

test(`it calls setServerURL`, async () => {
  const op = await newInitialized();
  op.setServerURL("https://api-eu.oursprivacy.com");
  expect(op.oursprivacyImpl.setServerURL).toHaveBeenCalledWith(
    "token",
    "https://api-eu.oursprivacy.com"
  );
});

test(`it calls setLoggingEnabled`, async () => {
  const op = await newInitialized();
  op.setLoggingEnabled(true);
  expect(op.oursprivacyImpl.setLoggingEnabled).toHaveBeenCalledWith("token", true);
});

test(`it calls setFlushBatchSize`, async () => {
  const op = await newInitialized();
  op.setFlushBatchSize(20);
  expect(op.oursprivacyImpl.setFlushBatchSize).toHaveBeenCalledWith("token", 20);
});

test(`it calls hasOptedOutTracking`, async () => {
  const op = await newInitialized();
  op.hasOptedOutTracking();
  expect(op.oursprivacyImpl.hasOptedOutTracking).toHaveBeenCalledWith("token");
});

test(`it calls optInTracking`, async () => {
  const op = await newInitialized();
  op.optInTracking();
  expect(op.oursprivacyImpl.optInTracking).toHaveBeenCalledWith("token");
});

test(`it calls optOutTracking`, async () => {
  const op = await newInitialized();
  op.optOutTracking();
  expect(op.oursprivacyImpl.optOutTracking).toHaveBeenCalledWith("token");
});

test(`identify forwards userProperties (no positional id arg)`, async () => {
  const op = await newInitialized();
  await op.identify({email: "user@example.com", externalId: "123"});
  expect(op.oursprivacyImpl.identify).toHaveBeenCalledWith(
    "token",
    {email: "user@example.com", externalId: "123"}
  );
});

test(`identify with no userProperties is allowed`, async () => {
  const op = await newInitialized();
  await op.identify();
  expect(op.oursprivacyImpl.identify).toHaveBeenCalledWith("token", undefined);
});

test(`it calls track`, async () => {
  const op = await newInitialized();
  op.track("event name", {"Cool Property": "Property Value"});
  expect(op.oursprivacyImpl.track).toHaveBeenCalledWith(
    "token",
    "event name",
    {"Cool Property": "Property Value"},
    undefined
  );
});

test(`track forwards camelCase userProperties`, async () => {
  const op = await newInitialized();
  op.track(
    "event name",
    {"Cool Property": "Property Value"},
    {email: "user@example.com", customProperties: {plan: "pro"}}
  );
  expect(op.oursprivacyImpl.track).toHaveBeenCalledWith(
    "token",
    "event name",
    {"Cool Property": "Property Value"},
    {email: "user@example.com", customProperties: {plan: "pro"}}
  );
});

test(`it calls reset`, async () => {
  const op = await newInitialized();
  op.reset();
  expect(op.oursprivacyImpl.reset).toHaveBeenCalledWith("token");
});

test(`it calls getVisitorId`, async () => {
  const op = await newInitialized();
  const id = op.getVisitorId();
  expect(op.oursprivacyImpl.getVisitorId).toHaveBeenCalledWith("token");
  expect(id).toBe("mock-visitor-id");
});

test(`it calls updateDefaultEventProperties`, async () => {
  const op = await newInitialized();
  op.updateDefaultEventProperties({tier: "pro"});
  expect(op.oursprivacyImpl.updateDefaultEventProperties).toHaveBeenCalledWith(
    "token",
    {tier: "pro"}
  );
});

test(`it calls updateDefaultUserCustomProperties`, async () => {
  const op = await newInitialized();
  op.updateDefaultUserCustomProperties({plan: "enterprise"});
  expect(op.oursprivacyImpl.updateDefaultUserCustomProperties).toHaveBeenCalledWith(
    "token",
    {plan: "enterprise"}
  );
});

test(`it calls updateDefaultUserConsentProperties`, async () => {
  const op = await newInitialized();
  op.updateDefaultUserConsentProperties({marketing: true});
  expect(op.oursprivacyImpl.updateDefaultUserConsentProperties).toHaveBeenCalledWith(
    "token",
    {marketing: true}
  );
});
