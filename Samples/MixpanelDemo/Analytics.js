import {OursPrivacy} from 'oursprivacy-react-native';
import {token as OursPrivacyToken, trackAutomaticEvents} from './app.json';


export class OursPrivacyManager {
    static sharedInstance = OursPrivacyManager.sharedInstance || new OursPrivacyManager();

    constructor() {
        this.oursprivacy = new OursPrivacy(OursPrivacyToken, trackAutomaticEvents);
        this.oursprivacy.init();
        this.oursprivacy.setLoggingEnabled(true);
    }
}

export const OursPrivacyInstance = OursPrivacyManager.sharedInstance.oursprivacy;
