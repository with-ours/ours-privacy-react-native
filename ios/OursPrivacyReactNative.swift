import Foundation
import UIKit

@objc(OursPrivacyReactNative)
open class OursPrivacyReactNative: NSObject, RCTBridgeModule {
    public static func moduleName() -> String! {
        return "OursPrivacyReactNative"
    }


    @objc public static func requiresMainQueueSetup() -> Bool {
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
    func identify(_ token: String, distinctId: String, userProperties: [String: Any]?,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) -> Void {
        let instance = OursPrivacyReactNative.getOursPrivacyInstance(token)
        instance?.identify(distinctId: distinctId, userProperties: userProperties) {
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

    open class func getOursPrivacyInstance(_ token: String) -> OursPrivacyInstance? {
        if token.isEmpty {
            return nil
        }
        return OursPrivacy.getInstance(name: token)
    }

}
