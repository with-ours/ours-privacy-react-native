/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import type {PropsWithChildren} from 'react';
import {
  Button,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

import { OURSPRIVACY_TOKEN } from '@env';
import { OursPrivacy } from '@oursprivacy/react-native';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

let opInstance: OursPrivacy
async function getOursPrivacy() {
  if (!opInstance) {
    opInstance = await OursPrivacy.init(OURSPRIVACY_TOKEN, false, false)
    opInstance.setLoggingEnabled(true)
  }
  return opInstance
}

async function track(event: string) {
  try {
    const op = await getOursPrivacy();
    const distinctId = await op.getDistinctId();
    const deviceId = await op.getDeviceId();
    console.log('[OursPrivacy] distinctId:', distinctId);
    console.log('[OursPrivacy] deviceId:', deviceId);
    await op.identify(distinctId);
    const props = { distinctId };
    console.log('[OursPrivacy] track:', event, 'props:', JSON.stringify(props));
    op.track(event, props);
    op.flush();
    console.log('[OursPrivacy] flushed');
  } catch (err) {
    console.error('[OursPrivacy] Error:', err);
  }
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  const safePadding = '5%';

  return (
    <View style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        style={backgroundStyle}>
        <View style={{paddingRight: safePadding}}>
          <Header/>
        </View>
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
            paddingHorizontal: safePadding,
            paddingBottom: safePadding,
          }}>
            <Button
              onPress={() => track("Green")}
              title="Track Green"
              color="#841584"
              accessibilityLabel="Track Green Test"
            />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
