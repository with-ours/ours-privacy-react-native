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

import { OursPrivacy } from 'ours-privacy-react-native';
console.log(NativeModules);
if (__DEV__) {
  require("./reactotron");
}

type SectionProps = PropsWithChildren<{
  title: string;
}>;

let opInstance: OursPrivacy
async function getOursPrivacy() {
  if (!opInstance) {
    opInstance = await OursPrivacy.init("e93676a05e4c1dbed98cd2cd3fc03b206c289921af313192296d9dbbf0bfff00", false, false)
    opInstance.setServerURL("https://dev-api.oursprivacy.com/api/v1")
  }
  return opInstance
}

async function track(event: string) {

  try {
    console.log('Calling native module...');
    var result  = (await getOursPrivacy()).track(event)
    console.log('Native result:', result);
  } catch (err) {
    console.error('Error calling native module:', err);
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
