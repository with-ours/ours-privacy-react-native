import React from 'react';
import {Button, SafeAreaView} from 'react-native';
import {OursPrivacy} from 'oursprivacy-react-native';

const trackAutomaticEvents = true;
const oursprivacy = new OursPrivacy('Your Project Token', trackAutomaticEvents);
oursprivacy.init();

// *************************************
// Example for Function Component
// *************************************

const SampleApp = () => {
  return (
    <SafeAreaView>
      <Button
        title="Select Premium Plan"
        onPress={() => oursprivacy.track('Plan Selected', {Plan: 'Premium'})}
      />
    </SafeAreaView>
  );
};

export default SampleApp;

// *************************************
// Example for Class Component
// *************************************

// class SampleApp extends Component {
//   render() {
//     return (
//       <SafeAreaView>
//         <Button
//           title="Select Premium Plan"
//           onPress={() => oursprivacy.track("Plan Selected", {"Plan": "Premium"})}
//         />
//       </SafeAreaView>
//     );
//   }
// }

// export default SampleApp;
