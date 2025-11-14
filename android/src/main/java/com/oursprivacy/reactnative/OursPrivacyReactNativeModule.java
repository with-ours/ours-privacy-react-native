package com.oursprivacy.reactnative;

import com.oursprivacy.android.opmetrics.OursPrivacyAPI;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Dynamic;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Map;
import java.util.Arrays;

public class OursPrivacyReactNativeModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext mReactContext;

    public OursPrivacyReactNativeModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.mReactContext = reactContext;
    }

    @Override
    public String getName() {
        return "OursPrivacyReactNative";
    }


    @ReactMethod
    public void initialize(String token, boolean trackAutomaticEvents, boolean optOutTrackingDefault, ReadableMap metadata, String serverURL, Promise promise) throws JSONException {
        JSONObject oursprivacyProperties = ReactNativeHelper.reactToJSON(metadata);
        AutomaticProperties.setAutomaticProperties(oursprivacyProperties);
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, optOutTrackingDefault, oursprivacyProperties, null, trackAutomaticEvents);
        instance.setServerURL(serverURL);
        promise.resolve(null);
    }

    @ReactMethod
    public void setServerURL(final String token, final String serverURL, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.setServerURL(serverURL);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void setUseIpAddressForGeolocation(final String token, boolean useIpAddressForGeolocation, Promise promise)
            throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.setUseIpAddressForGeolocation(useIpAddressForGeolocation);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void setFlushBatchSize(final String token, Integer flushBatchSize, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.setFlushBatchSize(flushBatchSize);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void setLoggingEnabled(final String token, boolean enableLogging, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.setEnableLogging(enableLogging);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void hasOptedOutTracking(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            promise.resolve(instance.hasOptedOutTracking());
        }
    }

    @ReactMethod
    public void optInTracking(final String token, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.optInTracking();
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void optOutTracking(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.optOutTracking();
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void identify(final String token, final String distinctId, ReadableMap userProperties, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.identify(distinctId, userProperties);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void getDistinctId(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            promise.resolve(instance.getDistinctId());
        }
    }

    @ReactMethod
    public void getDeviceId(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            promise.resolve(instance.getAnonymousId());
        }
    }

    @ReactMethod
    public void track(final String token, final String eventName, ReadableMap properties, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            JSONObject eventProperties = ReactNativeHelper.reactToJSON(properties);
            AutomaticProperties.appendLibraryProperties(eventProperties);
            instance.track(eventName, eventProperties);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void registerSuperProperties(final String token, ReadableMap properties, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            JSONObject superProperties = ReactNativeHelper.reactToJSON(properties);
            instance.registerSuperProperties(superProperties);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void registerSuperPropertiesOnce(final String token, ReadableMap properties, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            JSONObject superProperties = ReactNativeHelper.reactToJSON(properties);
            instance.registerSuperPropertiesOnce(superProperties);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void unregisterSuperProperty(final String token, String superPropertyName, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.unregisterSuperProperty(superPropertyName);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void getSuperProperties(final String token, Promise promise) throws JSONException {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            promise.resolve(ReactNativeHelper.convertJsonToMap(instance.getSuperProperties()));
        }
    }

    @ReactMethod
    public void clearSuperProperties(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.clearSuperProperties();
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void alias(final String token, String alias, String original, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.alias(alias, original);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void reset(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.reset();
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void flush(final String token, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.flush();
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void timeEvent(final String token, final String eventName, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            instance.timeEvent(eventName);
            promise.resolve(null);
        }
    }

    @ReactMethod
    public void eventElapsedTime(final String token, final String eventName, Promise promise) {
        OursPrivacyAPI instance = OursPrivacyAPI.getInstance(this.mReactContext, token, true);
        if (instance == null) {
            promise.reject("Instance Error", "Failed to get OursPrivacy instance");
            return;
        }
        synchronized (instance) {
            promise.resolve(instance.eventElapsedTime(eventName));
        }
    }
}
