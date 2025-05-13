import Foundation
import OursPrivacy

class AutomaticProperties {
    static var peopleProperties: Dictionary<String, OursPrivacyType> = [:];

    static func setAutomaticProperties(_ properties: [String: Any]) {
        for (key,value) in properties {
            peopleProperties[key] = OursPrivacyTypeHandler.oursprivacyTypeValue(value)
        }
    }
}
