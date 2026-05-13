/**
 * Ours Privacy React Native SDK Demo
 */

import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  Button,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

// react-native/Libraries/NewAppScreen was removed in RN 0.85. Inline a minimal
// equivalent so the QA harness keeps the same shape without pulling a new dep.
const Colors = {
  white: '#FFF',
  black: '#000',
  light: '#DAE1E7',
  lighter: '#F3F3F3',
  dark: '#444',
  darker: '#222',
};
function Header() {
  return (
    <View style={{paddingVertical: 20}}>
      <Text style={{fontSize: 24, fontWeight: '700', textAlign: 'center'}}>
        OursPrivacy Demo
      </Text>
    </View>
  );
}

import { OURSPRIVACY_SERVER_URL, OURSPRIVACY_TOKEN, E2E_AUTOFIRE } from '@env';
import { OursPrivacy } from '@oursprivacy/react-native';

type SectionProps = PropsWithChildren<{ title: string }>;

function Section({ children, title }: SectionProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionContainer}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? Colors.white : Colors.black }]}>
        {title}
      </Text>
      <Text style={[styles.sectionDescription, { color: isDarkMode ? Colors.light : Colors.dark }]}>
        {children}
      </Text>
    </View>
  );
}

// Initialize SDK once using instance pattern
const oursprivacy = new OursPrivacy(OURSPRIVACY_TOKEN, false);

// Test initialURL init option: parse a simulated deep link at init time
const SIMULATED_COLD_START_URL =
  'myapp://open?utm_source=google&utm_medium=cpc&utm_campaign=spring_2026&gclid=test_gclid_123&aleid=test_aleid_456';

const initOptions = {
  default_event_properties: { demo_app: true },
  default_user_custom_properties: { test_user: true },
  initialURL: SIMULATED_COLD_START_URL,
  ...(OURSPRIVACY_SERVER_URL ? { serverURL: OURSPRIVACY_SERVER_URL } : {}),
};

console.log(
  '[OursPrivacy] init server URL:',
  OURSPRIVACY_SERVER_URL || 'https://cdn.oursprivacy.com',
);

oursprivacy.init(false, initOptions).then(async () => {
  if (E2E_AUTOFIRE !== 'true') return;

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  console.log('[E2E] auto-fire sequence starting');

  // Phase 1: Basic track
  await delay(500);
  oursprivacy.track('button_pressed', { button: 'e2e_auto' });
  console.log('[E2E] tracked button_pressed');

  // Phase 2: Identify
  oursprivacy.identify('e2e-user@example.com', {
    email: 'e2e-user@example.com',
    external_id: 'e2e-user-123',
    custom_properties: { plan: 'e2e' },
  });
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] identified + flushed');

  // Phase 3: Update defaults then track
  oursprivacy.updateDefaultEventProperties({ last_action: 'update_defaults' });
  oursprivacy.updateDefaultUserConsentProperties({ marketing: true });
  oursprivacy.track('defaults_updated');
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] defaults updated + tracked + flushed');

  // Phase 4: Opt-out — events below must NOT appear in captures
  oursprivacy.optOutTracking();
  oursprivacy.track('should_not_appear', { leaked: true });
  oursprivacy.flush();
  await delay(500);
  console.log('[E2E] opted out + attempted track (should be suppressed)');

  // Phase 5: Opt-in — should fire $opt_in, suppressed event must not appear
  oursprivacy.optInTracking();
  oursprivacy.track('after_opt_in');
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] opted in + tracked after_opt_in + flushed');

  // Phase 6: Deep link (warm start)
  await oursprivacy.trackDeepLink(
    'myapp://products/456?utm_source=applovin&utm_medium=display&aleid=warm_aleid_789&alart=warm_alart_abc&ours_visitor_id=e2e-web-visitor-id'
  );
  oursprivacy.track('post_deep_link');
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] deep link + post_deep_link tracked + flushed');

  // Phase 7: Set visitor ID manually
  await oursprivacy.setVisitorId('e2e-manual-visitor-id');
  oursprivacy.track('after_set_visitor_id');
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] set visitor ID + tracked + flushed');

  // Phase 8: Reset — reset() is async internally, need delay before tracking
  oursprivacy.reset();
  await delay(500);
  oursprivacy.track('after_reset');
  oursprivacy.flush();
  await delay(1500);
  console.log('[E2E] reset + tracked after_reset + flushed');

  console.log('[E2E] auto-fire sequence complete');
});

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = { backgroundColor: isDarkMode ? Colors.darker : Colors.lighter };
  const safePadding = '5%';

  const handleTrack = () => {
    console.log('[OursPrivacy] visitor_id:', oursprivacy.getVisitorId());
    oursprivacy.track('button_pressed', { button: 'Track Event' });
    oursprivacy.flush();
    console.log('[OursPrivacy] tracked + flushed');
  };

  const handleIdentify = () => {
    oursprivacy.identify('demo-user@example.com', {
      email: 'demo-user@example.com',
      external_id: 'demo-user-123',
      custom_properties: { plan: 'demo' },
    });
    oursprivacy.flush();
    console.log('[OursPrivacy] identified + flushed');
  };

  const handleUpdateDefaults = () => {
    oursprivacy.updateDefaultEventProperties({ last_action: 'update_defaults' });
    oursprivacy.updateDefaultUserConsentProperties({ marketing: true, analytics: true });
    oursprivacy.track('defaults_updated');
    oursprivacy.flush();
    console.log('[OursPrivacy] defaults updated + tracked + flushed');
  };

  const handleOptOut = () => {
    oursprivacy.optOutTracking();
    console.log('[OursPrivacy] opted out');
  };

  const handleOptIn = () => {
    oursprivacy.optInTracking();
    oursprivacy.flush();
    console.log('[OursPrivacy] opted in + flushed ($opt_in event sent)');
  };

  const handleTrackDeepLink = async () => {
    // Simulate a warm-start deep link with different attribution (replaces init's attribution)
    const url =
      'myapp://products/456?utm_source=applovin&utm_medium=display&aleid=warm_aleid_789&alart=warm_alart_abc&ours_visitor_id=web-visitor-uuid-from-deep-link';
    console.log('[OursPrivacy] trackDeepLink:', url);
    await oursprivacy.trackDeepLink(url);
    oursprivacy.flush();
    console.log('[OursPrivacy] deep link tracked + flushed. visitor_id:', oursprivacy.getVisitorId());
  };

  const handleSetVisitorId = async () => {
    const newId = 'manually-set-visitor-id-' + Date.now();
    console.log('[OursPrivacy] setVisitorId:', newId);
    await oursprivacy.setVisitorId(newId);
    oursprivacy.track('after_set_visitor_id', { new_visitor_id: newId });
    oursprivacy.flush();
    console.log('[OursPrivacy] visitor_id set + tracked + flushed. visitor_id:', oursprivacy.getVisitorId());
  };

  const handleTrackAfterAttribution = () => {
    // This should include attribution from the most recent deep link in defaultProperties
    console.log('[OursPrivacy] tracking after attribution...');
    oursprivacy.track('post_attribution_event', { source: 'manual_test' });
    oursprivacy.flush();
    console.log('[OursPrivacy] post-attribution event tracked + flushed');
  };

  const handleReset = () => {
    oursprivacy.reset();
    console.log('[OursPrivacy] reset. new visitor_id:', oursprivacy.getVisitorId());
  };

  return (
    <View style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView style={backgroundStyle}>
        <View style={{ paddingRight: safePadding }}>
          <Header />
        </View>
        <View style={{
          backgroundColor: isDarkMode ? Colors.black : Colors.white,
          paddingHorizontal: safePadding,
          paddingBottom: safePadding,
          gap: 12,
        }}>
          <Section title="Track Event">
            Calls track('button_pressed') + flush(). Check console for visitor_id.
          </Section>
          <Button onPress={handleTrack} title="Track Event" color="#841584" />

          <Section title="Identify">
            Calls identify with email, external_id, and custom_properties.
          </Section>
          <Button onPress={handleIdentify} title="Identify User" color="#1a73e8" />

          <Section title="Update Default Properties">
            Updates default event + consent properties, then tracks an event.
          </Section>
          <Button onPress={handleUpdateDefaults} title="Update Defaults + Track" color="#0f9d58" />

          <Section title="Deep Link Attribution">
            Tests trackDeepLink() with UTMs, click IDs, and ours_visitor_id.
          </Section>
          <Button onPress={handleTrackDeepLink} title="Track Deep Link (warm start)" color="#6200ee" />
          <Button onPress={handleTrackAfterAttribution} title="Track After Attribution" color="#6200ee" />
          <Button onPress={handleSetVisitorId} title="Set Visitor ID Manually" color="#03dac5" />

          <Section title="Privacy Controls">
            Opt out stops all tracking. Opt in resumes and sends $opt_in event.
          </Section>
          <Button onPress={handleOptOut} title="Opt Out" color="#ea4335" />
          <Button onPress={handleOptIn} title="Opt In" color="#0f9d58" />

          <Section title="Reset">
            Clears identity and default properties. Generates new visitor_id.
          </Section>
          <Button onPress={handleReset} title="Reset" color="#f4a637" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 16,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
  },
});

export default App;
