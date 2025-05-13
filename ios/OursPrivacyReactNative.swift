import Foundation
import OursPrivacy
import UIKit

@objc(OursPrivacyReactNative)
open class OursPrivacyReactNative: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - OursPrivacy Instance

    @objc
    func initialize(_ token: String,
                    trackAutomaticEvents: Bool,
                    optOutTrackingByDefault: Bool = false,
                    properties: [String: Any],
                    serverURL: String,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let autoProps = properties // copy
        AutomaticProperties.setAutomaticProperties(autoProps)
        let propsProcessed = OursPrivacyTypeHandler.processProperties(properties: autoProps)
        OursPrivacy.initialize(token: token, trackAutomaticEvents: trackAutomaticEvents, flushInterval: Constants.DEFAULT_FLUSH_INTERVAL,
                            instanceName: token, optOutTrackingByDefault: optOutTrackingByDefault,
                            superProperties: propsProcessed,
                            serverURL: serverURL)
        resolve(true)
    }

    @objc
    func setServerURL(_ token: String,
                    serverURL: String,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.serverURL = serverURL
        resolve(nil)
    }

    @objc
    func setLoggingEnabled(_ token: String,
                    loggingEnabled: Bool,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.loggingEnabled = loggingEnabled
        resolve(nil)
    }

    @objc
    func setFlushOnBackground(_ token: String,
                    flushOnBackground: Bool,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.flushOnBackground = flushOnBackground
        resolve(nil)
    }

    @objc
    func setFlushBatchSize(_ token: String,
                    flushBatchSize: Int,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.flushBatchSize = flushBatchSize
        resolve(nil)
    }

    @objc
    func setUseIpAddressForGeolocation(_ token: String,
                    useIpAddressForGeolocation: Bool,
                    resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.useIPAddressForGeoLocation = useIpAddressForGeolocation
        resolve(nil)
    }

    // MARK: - Opting Users Out of Tracking

    @objc
    func optOutTracking(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                        rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.optOutTracking()
        resolve(nil)
    }

    @objc
    func hasOptedOutTracking(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                             rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        resolve(instance?.hasOptedOutTracking())
    }

    @objc
    func optInTracking(_ token: String,
                       resolver resolve: RCTPromiseResolveBlock,
                       rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.optInTracking()
        resolve(nil)
    }

    // MARK: - Track Events

    @objc
    func track(_ token: String, event: String?,
               properties: [String: Any]? = nil,
               resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        let mpProperties = OursPrivacyTypeHandler.processProperties(properties: properties)
        instance?.track(event: event, properties: mpProperties)
        resolve(nil)
    }

    // MARK: - Timing Events

    @objc
    func timeEvent(_ token: String, event: String,
                   resolver resolve: RCTPromiseResolveBlock,
                   rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.time(event: event)
        resolve(nil)
    }

    @objc
    func eventElapsedTime(_ token: String, event: String,
                          resolver resolve: RCTPromiseResolveBlock,
                          rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        resolve(instance?.eventElapsedTime(event: event))
    }

    // MARK: - Managing User Identity

    @objc
    func identify(_ token: String, distinctId: String,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.identify(distinctId: distinctId) {
            resolve(nil)
        }
    }

    @objc
    func alias(_ token: String, alias: String,
               distinctId: String,
               resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.createAlias(alias, distinctId: distinctId)
        resolve(nil)
    }

    @objc
    func flush(_ token: String, resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.flush()
        resolve(nil)
    }

    @objc
    func reset(_ token: String, resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.reset()
        resolve(nil)
    }

    @objc
    func getDistinctId(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                       rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        resolve(instance?.distinctId)
    }

    @objc
    func getDeviceId(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                       rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        resolve(instance?.anonymousId)
    }

    // MARK: - Super Properties

    @objc
    func registerSuperProperties(_ token: String, properties: [String: Any],
                                 resolver resolve: RCTPromiseResolveBlock,
                                 rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.registerSuperProperties(OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func registerSuperPropertiesOnce(_ token: String, properties: [String: Any],
                                     resolver resolve: RCTPromiseResolveBlock,
                                     rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.registerSuperPropertiesOnce(OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func getSuperProperties(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                            rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        resolve(instance?.currentSuperProperties())
    }

    @objc
    func unregisterSuperProperty(_ token: String, propertyName: String,
                                 resolver resolve: RCTPromiseResolveBlock,
                                 rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.unregisterSuperProperty(propertyName)
        resolve(nil)
    }

    @objc
    func clearSuperProperties(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                              rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.clearSuperProperties()
        resolve(nil)
    }

    // MARK: - People

    @objc
    func set(_ token: String, properties: [String: Any],
             resolver resolve: RCTPromiseResolveBlock,
             rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.set(properties: OursPrivacyTypeHandler.processProperties(properties: properties, includeLibInfo: true))
        resolve(nil)
    }

    @objc
    func setOnce(_ token: String, properties: [String: Any],
                 resolver resolve: RCTPromiseResolveBlock,
                 rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.setOnce(properties: OursPrivacyTypeHandler.processProperties(properties: properties, includeLibInfo: true))
        resolve(nil)
    }

    @objc
    func unset(_ token: String, propertyName: String,
               resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.unset(properties: [propertyName])
        resolve(nil)
    }

    @objc
    func increment(_ token: String, properties: [String: Any],
                   resolver resolve: RCTPromiseResolveBlock,
                   rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.increment(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func append(_ token: String, properties: [String: Any],
                resolver resolve: RCTPromiseResolveBlock,
                rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.append(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func remove(_ token: String, properties: [String: Any],
                resolver resolve: RCTPromiseResolveBlock,
                rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.remove(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func union(_ token: String, properties: [String: Any],
               resolver resolve: RCTPromiseResolveBlock,
               rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.union(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func trackCharge(_ token: String, amount: Double,
                     properties: [String: Any]? = nil,
                     resolver resolve: RCTPromiseResolveBlock,
                     rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.trackCharge(amount: amount, properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func clearCharges(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                      rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.clearCharges()
        resolve(nil)
    }

    @objc
    func deleteUser(_ token: String, resolver resolve: RCTPromiseResolveBlock,
                    rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.people.deleteUser()
        resolve(nil)
    }

    // MARK: - Group
    @objc
    func trackWithGroups(_ token: String, event: String, properties: [String: Any]? = nil,
                         groups: [String: Any]? = nil,
                         resolver resolve: RCTPromiseResolveBlock,
                         rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        let mpProperties = OursPrivacyTypeHandler.processProperties(properties: properties)
        var mpGroups = Dictionary<String, OursPrivacyType>()
        for (key,value) in groups ?? [:] {
            mpGroups[key] = OursPrivacyTypeHandler.oursprivacyTypeValue(value)
        }
        instance?.trackWithGroups(event: event, properties: mpProperties, groups: mpGroups)
        resolve(nil)
    }

    @objc
    func setGroup(_ token: String, groupKey: String, groupID: Any,
                  resolver resolve: RCTPromiseResolveBlock,
                  rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        if groupID is Array<Any> {
            instance?.setGroup(groupKey: groupKey, groupIDs:OursPrivacyTypeHandler.oursprivacyTypeValue(groupID)! as! [OursPrivacyType])
        } else {
            instance?.setGroup(groupKey: groupKey, groupID:OursPrivacyTypeHandler.oursprivacyTypeValue(groupID)!)
        }
        resolve(nil)
    }

    @objc
    func addGroup(_ token: String, groupKey: String, groupID: Any,
                  resolver resolve: RCTPromiseResolveBlock,
                  rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.addGroup(groupKey: groupKey, groupID: OursPrivacyTypeHandler.oursprivacyTypeValue(groupID)!)
        resolve(nil)
    }

    @objc
    func removeGroup(_ token: String, groupKey: String, groupID: Any,
                     resolver resolve: RCTPromiseResolveBlock,
                     rejecter reject: RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.removeGroup(groupKey: groupKey, groupID: OursPrivacyTypeHandler.oursprivacyTypeValue(groupID)!)
        resolve(nil)
    }

    func oursprivacyGroup(_ token: String, groupKey: String, groupID: Any) -> Group? {
        guard let instance = OursPrivacyReactNative.getOursPrivacyInstance(token) else {
            return nil
        }

        guard let oursprivacyTypeGroupID = OursPrivacyTypeHandler.oursprivacyTypeValue(groupID) else {
            return nil
        }

        return instance.getGroup(groupKey: groupKey, groupID: oursprivacyTypeGroupID)
    }

    @objc
    func deleteGroup(_ token: String, groupKey: String, groupID: Any,
                     resolver resolve: RCTPromiseResolveBlock,
                     rejecter reject: RCTPromiseRejectBlock) -> Void {
        let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID)
        group?.deleteGroup()
        resolve(nil)
    }

    @objc
    func groupSetProperties(_ token: String, groupKey: String, groupID: Any,
                            properties: [String: Any],
                            resolver resolve: RCTPromiseResolveBlock,
                            rejecter reject: RCTPromiseRejectBlock) -> Void {
        let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID)
        group?.set(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func groupSetPropertyOnce(_ token: String, groupKey: String, groupID: Any,
                              properties: [String: Any],
                              resolver resolve: RCTPromiseResolveBlock,
                              rejecter reject: RCTPromiseRejectBlock) -> Void {
        let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID)
        group?.setOnce(properties: OursPrivacyTypeHandler.processProperties(properties: properties))
        resolve(nil)
    }

    @objc
    func groupUnsetProperty(_ token: String, groupKey: String, groupID: Any,
                            propertyName: String,
                            resolver resolve: RCTPromiseResolveBlock,
                            rejecter reject: RCTPromiseRejectBlock) -> Void {
        if let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID) {
            group.unset(property: propertyName)
        }
        resolve(nil)
    }

    @objc
    func groupRemovePropertyValue(_ token: String, groupKey: String, groupID: Any,
                                  name: String,
                                  value: Any,
                                  resolver resolve: RCTPromiseResolveBlock,
                                  rejecter reject: RCTPromiseRejectBlock) -> Void {
        if let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID) {
            guard let oursprivacyTypeValue = OursPrivacyTypeHandler.oursprivacyTypeValue(value) else {
                resolve(nil)
                return
            }
            group.remove(key: name, value: oursprivacyTypeValue)
        }
        resolve(nil)
    }

    @objc
    func groupUnionProperty(_ token: String, groupKey: String, groupID: Any,
                            name: String,
                            values: [Any],
                            resolver resolve: RCTPromiseResolveBlock,
                            rejecter reject: RCTPromiseRejectBlock) -> Void {
        if let group = oursprivacyGroup(token, groupKey: groupKey, groupID: groupID) {
            group.union(key: name, values: values.map() { OursPrivacyTypeHandler.oursprivacyTypeValue($0)! })
        }
        resolve(nil)
    }

    open class func getOursPrivacyInstance(_ token: String) -> OursPrivacyInstance? {
        if token.isEmpty {
            return nil
        }
        return OursPrivacy.getInstance(name: token)
    }

}
