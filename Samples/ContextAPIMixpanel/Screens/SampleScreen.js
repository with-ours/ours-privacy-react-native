import React from 'react';
import { Button, SafeAreaView } from "react-native";
import { useOursPrivacy } from '../Analytics';

export const SampleScreen = () => {
  const oursprivacy = useOursPrivacy();
  return (
    <SafeAreaView>
      <Button
        title="Select Premium Plan"
        onPress={() => {
          oursprivacy.track("Plan Selected", {"Plan": "Premium"});
        }}
      />
    </SafeAreaView>
  );
}
