#import <Foundation/Foundation.h>
#import "React/RCTBridgeModule.h"

@interface RCT_EXTERN_MODULE(OursPrivacyReactNative, NSObject)

// MARK: - OursPrivacy Instance

RCT_EXTERN_METHOD(initialize:(NSString *)token trackAutomaticEvents:(BOOL)trackAutomaticEvents optOutTrackingByDefault:(BOOL)optOutTrackingByDefault properties:(NSDictionary *)properties serverURL:(NSString *)serverURL resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// Mark: - Settings
RCT_EXTERN_METHOD(setServerURL:(NSString *)token serverURL:(NSString *)serverURL resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setLoggingEnabled:(NSString *)token loggingEnabled:(BOOL)loggingEnabled resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setFlushOnBackground:(NSString *)token flushOnBackground:(BOOL)flushOnBackground resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setUseIpAddressForGeolocation:(NSString *)token useIpAddressForGeolocation:(BOOL)useIpAddressForGeolocation resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setFlushBatchSize:(NSString *)token flushBatchSize:(NSInteger)flushBatchSize resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Opting Users Out of Tracking

RCT_EXTERN_METHOD(optOutTracking:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(hasOptedOutTracking:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(optInTracking:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Track Events

RCT_EXTERN_METHOD(track:(NSString *)token event:(NSString *)event properties:(NSDictionary *)properties resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Timing Events

RCT_EXTERN_METHOD(timeEvent:(NSString *)token event:(NSString *)event resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(eventElapsedTime:(NSString *)token event:(NSString *)event resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Managing User Identity

RCT_EXTERN_METHOD(identify:(NSString *)token distinctId:(NSString *)distinctId userProperties:(NSDictionary *)userProperties resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(alias:(NSString *)token alias:(NSString *)alias distinctId:(NSString *)distinctId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(flush:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reset:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDistinctId:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDeviceId:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

// MARK: - Super Properties

RCT_EXTERN_METHOD(registerSuperProperties:(NSString *)token properties:(NSDictionary *)properties resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(registerSuperPropertiesOnce:(NSString *)token properties:(NSDictionary *)properties resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getSuperProperties:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(unregisterSuperProperty:(NSString *)token propertyName:(NSString *)propertyName resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearSuperProperties:(NSString *)token resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
