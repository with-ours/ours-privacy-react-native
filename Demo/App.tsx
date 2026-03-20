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

import {
  Colors,
  Header,
} from 'react-native/Libraries/NewAppScreen';

import { OURSPRIVACY_SERVER_URL, OURSPRIVACY_TOKEN } from '@env';
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
const oursprivacy = new OursPrivacy(OURSPRIVACY_TOKEN, false, false);

const initOptions = {
  default_event_properties: { demo_app: true },
  default_user_custom_properties: { test_user: true },
  ...(OURSPRIVACY_SERVER_URL ? { serverURL: OURSPRIVACY_SERVER_URL } : {}),
};

console.log(
  '[OursPrivacy] init server URL:',
  OURSPRIVACY_SERVER_URL || 'https://cdn.oursprivacy.com',
);

oursprivacy.init(false, initOptions);

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
