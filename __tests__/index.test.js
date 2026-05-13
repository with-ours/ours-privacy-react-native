import {OursPrivacy} from "oursprivacy-react-native";

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

test(`it initializes with correct defaults`, async () => {
  const op = new OursPrivacy("token", false);
  await op.init();
  expect(op.oursprivacyImpl.initialize).toHaveBeenCalledWith(
    "token",
    false,
    false,
    {},
    "https://cdn.oursprivacy.com"
  );
});

test(`it passes optOut and options to initialize`, async () => {
  const op = new OursPrivacy("token", false);
  await op.init(true, {default_event_properties: {prop: "value"}});
  expect(op.oursprivacyImpl.initialize).toHaveBeenCalledWith(
    "token",
    false,
    true,
    {default_event_properties: {prop: "value"}},
    "https://cdn.oursprivacy.com"
  );
});

test(`it passes visitor_id option through to initialize`, async () => {
  const op = new OursPrivacy("token", false);
  await op.init(false, {visitor_id: "preset-visitor-123"});
  expect(op.oursprivacyImpl.initialize).toHaveBeenCalledWith(
    "token",
    false,
    false,
    {visitor_id: "preset-visitor-123"},
    "https://cdn.oursprivacy.com"
  );
});

test(`it calls setServerURL`, async () => {
  const op = new OursPrivacy("token", false);
  op.setServerURL("https://api-eu.oursprivacy.com");
  expect(op.oursprivacyImpl.setServerURL).toHaveBeenCalledWith(
    "token",
    "https://api-eu.oursprivacy.com"
  );
});

test(`it calls setLoggingEnabled`, async () => {
  const op = new OursPrivacy("token", false);
  op.setLoggingEnabled(true);
  expect(op.oursprivacyImpl.setLoggingEnabled).toHaveBeenCalledWith("token", true);
});

test(`it calls setFlushBatchSize`, async () => {
  const op = new OursPrivacy("token", false);
  op.setFlushBatchSize(20);
  expect(op.oursprivacyImpl.setFlushBatchSize).toHaveBeenCalledWith("token", 20);
});

test(`it calls hasOptedOutTracking`, async () => {
  const op = new OursPrivacy("token", false);
  op.hasOptedOutTracking();
  expect(op.oursprivacyImpl.hasOptedOutTracking).toHaveBeenCalledWith("token");
});

test(`it calls optInTracking`, async () => {
  const op = new OursPrivacy("token", false);
  op.optInTracking();
  expect(op.oursprivacyImpl.optInTracking).toHaveBeenCalledWith("token");
});

test(`it calls optOutTracking`, async () => {
  const op = new OursPrivacy("token", false);
  op.optOutTracking();
  expect(op.oursprivacyImpl.optOutTracking).toHaveBeenCalledWith("token");
});

test(`it calls identify with id`, async () => {
  const op = new OursPrivacy("token", false);
  await op.identify("user@example.com");
  expect(op.oursprivacyImpl.identify).toHaveBeenCalledWith(
    "token",
    "user@example.com",
    undefined
  );
});

test(`it calls identify with id and userProperties`, async () => {
  const op = new OursPrivacy("token", false);
  await op.identify("user@example.com", {email: "user@example.com", external_id: "123"});
  expect(op.oursprivacyImpl.identify).toHaveBeenCalledWith(
    "token",
    "user@example.com",
    {email: "user@example.com", external_id: "123"}
  );
});

test(`it calls track`, async () => {
  const op = new OursPrivacy("token", false);
  op.track("event name", {"Cool Property": "Property Value"});
  expect(op.oursprivacyImpl.track).toHaveBeenCalledWith(
    "token",
    "event name",
    {"Cool Property": "Property Value"},
    undefined
  );
});

test(`it calls track with userProperties`, async () => {
  const op = new OursPrivacy("token", false);
  op.track(
    "event name",
    {"Cool Property": "Property Value"},
    {email: "user@example.com", custom_properties: {plan: "pro"}}
  );
  expect(op.oursprivacyImpl.track).toHaveBeenCalledWith(
    "token",
    "event name",
    {"Cool Property": "Property Value"},
    {email: "user@example.com", custom_properties: {plan: "pro"}}
  );
});

test(`it calls reset`, async () => {
  const op = new OursPrivacy("token", false);
  op.reset();
  expect(op.oursprivacyImpl.reset).toHaveBeenCalledWith("token");
});

test(`it calls getVisitorId`, async () => {
  const op = new OursPrivacy("token", false);
  const id = op.getVisitorId();
  expect(op.oursprivacyImpl.getVisitorId).toHaveBeenCalledWith("token");
  expect(id).toBe("mock-visitor-id");
});

test(`it calls updateDefaultEventProperties`, async () => {
  const op = new OursPrivacy("token", false);
  op.updateDefaultEventProperties({tier: "pro"});
  expect(op.oursprivacyImpl.updateDefaultEventProperties).toHaveBeenCalledWith(
    "token",
    {tier: "pro"}
  );
});

test(`it calls updateDefaultUserCustomProperties`, async () => {
  const op = new OursPrivacy("token", false);
  op.updateDefaultUserCustomProperties({plan: "enterprise"});
  expect(op.oursprivacyImpl.updateDefaultUserCustomProperties).toHaveBeenCalledWith(
    "token",
    {plan: "enterprise"}
  );
});

test(`it calls updateDefaultUserConsentProperties`, async () => {
  const op = new OursPrivacy("token", false);
  op.updateDefaultUserConsentProperties({marketing: true});
  expect(op.oursprivacyImpl.updateDefaultUserConsentProperties).toHaveBeenCalledWith(
    "token",
    {marketing: true}
  );
});
