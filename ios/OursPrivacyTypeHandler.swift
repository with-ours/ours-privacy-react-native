 import Foundation

public class OursPrivacyTypeHandler {
    /**
     Converts given object to OursPrivacyType
     */
    static func oursprivacyTypeValue(_ object: Any) -> OursPrivacyType? {
        switch object {
        case let value as String:
            return value as OursPrivacyType

        case let value as NSNumber:
            if isBoolNumber(value) {
                return value.boolValue as OursPrivacyType
            } else if isInvalidNumber(value) {
                return String(describing: value) as OursPrivacyType
            } else {
                return value as OursPrivacyType
            }

        case let value as Int:
            return value as OursPrivacyType

        case let value as UInt:
            return value as OursPrivacyType

        case let value as Double:
            return value as OursPrivacyType

        case let value as Float:
            return value as OursPrivacyType

        case let value as Bool:
            return value as OursPrivacyType

        case let value as Date:
            return value as OursPrivacyType

        case let value as URL:
            return value

        case let value as NSNull:
            return value

        case let value as [Any]:
            return value.map { oursprivacyTypeValue($0) }

        case let value as [String: Any]:
            return value.mapValues { oursprivacyTypeValue($0) }

        case let value as OursPrivacyType:
            return value

        default:
            return nil
        }
    }

    private static func isBoolNumber(_ num: NSNumber) -> Bool
    {
        let boolID = CFBooleanGetTypeID()
        let numID = CFGetTypeID(num)
        return numID == boolID
    }

    private static func isInvalidNumber(_ num: NSNumber) -> Bool
    {
        return num.doubleValue.isInfinite || num.doubleValue.isNaN
    }

    /**
     Merge User added properties and Automatic properties
     */
    static func processProperties(properties: Dictionary<String, Any>? = nil, includeLibInfo: Bool = false) -> Dictionary<String, OursPrivacyType> {
        var mpProperties = Dictionary<String, OursPrivacyType>()
        for (key,value) in properties ?? [:] {
            mpProperties[key] = oursprivacyTypeValue(value)
        }
        if (includeLibInfo) {
            return mpProperties.merging(AutomaticProperties.peopleProperties) { (_, new) in new }
        }
        return mpProperties
    }
 }
