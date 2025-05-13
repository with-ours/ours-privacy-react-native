import React from 'react';
import { OursPrivacy } from 'oursprivacy-react-native';

const OursPrivacyContext = React.createContext();

export const useOursPrivacy = () => React.useContext(OursPrivacyContext);

export const OursPrivacyProvider = ({children}) => {
  const [oursprivacy, setOursPrivacy] = React.useState(null);

  React.useEffect(() => {
    const trackAutomaticEvents = true;
    const oursprivacyInstance = new OursPrivacy(`Your Project Token`, trackAutomaticEvents);
    oursprivacyInstance.init();
    setOursPrivacy(oursprivacyInstance);
  }, []);

  return <OursPrivacyContext.Provider value={oursprivacy}>{children}</OursPrivacyContext.Provider>;
};