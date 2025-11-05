import React from 'react';
import { SafeAreaView } from "react-native";
import { OursPrivacyProvider }  from './Analytics';
import { SampleScreen } from './Screens/SampleScreen';


const App = () => {
  return (
    <SafeAreaView>
      <OursPrivacyProvider>
        <SampleScreen />
      </OursPrivacyProvider>
    </SafeAreaView>
  )
}

export default App;