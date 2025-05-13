import {OursPrivacyConfig} from "oursprivacy-react-native/javascript/oursprivacy-config";

export class OursPrivacyLogger {
  static _shouldLog(token) {
    return OursPrivacyConfig.getInstance().getLoggingEnabled(token);
  }

  static _prependPrefix(args) {
    return ["[OursPrivacy]", ...args];
  }

  static log(token, ...args) {
    if (OursPrivacyLogger._shouldLog(token)) {
      console.log(...OursPrivacyLogger._prependPrefix(args));
    }
  }

  static info(token, ...args) {
    if (OursPrivacyLogger._shouldLog(token)) {
      console.info(...OursPrivacyLogger._prependPrefix(args));
    }
  }

  static warn(token, ...args) {
    if (OursPrivacyLogger._shouldLog(token)) {
      console.warn(...OursPrivacyLogger._prependPrefix(args));
    }
  }

  static error(token, ...args) {
    if (OursPrivacyLogger._shouldLog(token)) {
      console.error(...OursPrivacyLogger._prependPrefix(args));
    }
  }
}
