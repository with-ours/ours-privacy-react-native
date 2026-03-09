import {OursPrivacyType} from "./oursprivacy-constants";

export class SessionMetadata {
  constructor(trackingQueue) {
    this.eventsCounter = 0;
    this.peopleCounter = 0;
    this.sessionID = SessionMetadata.randomId();
    this.sessionStartEpoch = Math.round(Date.now() / 1000);
    this.trackingQueue = trackingQueue;
  }

  static randomId() {
    return (
      Math.floor(Math.random() * (1 << 30)).toString(16) +
      Math.floor(Math.random() * (1 << 30)).toString(16)
    ).padStart(16, "0");
  }

  toDict(type) {
    const dict = {
      $op_metadata: {
        $op_event_id: SessionMetadata.randomId(),
        $op_session_id: this.sessionID,
        $op_session_seq_id:
          type === OursPrivacyType.EVENTS
            ? this.eventsCounter
            : this.peopleCounter,
        $op_session_start_sec: this.sessionStartEpoch,
      },
    };
    if (type === OursPrivacyType.EVENTS) {
      this.eventsCounter += 1;
    } else {
      this.peopleCounter += 1;
    }
    return dict;
  }
}
