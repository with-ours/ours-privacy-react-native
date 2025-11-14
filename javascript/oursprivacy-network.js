import {OursPrivacyLogger} from "./oursprivacy-logger";

export class OursPrivacyHttpError extends Error {
  constructor(message, errorCode) {
    super(message);
    this.code = errorCode;
  }
}

export const OursPrivacyNetwork = (() => {
  const sendRequest = async ({
    token,
    endpoint,
    data,
    serverURL,
    useIPAddressForGeoLocation,
    retryCount = 0,
  }) => {
    retryCount = retryCount || 0;
    const url = `${serverURL}${endpoint}?ip=${+useIPAddressForGeoLocation}`;
    OursPrivacyLogger.log(token, `Sending request to: ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(JSON.stringify(data))}`,
      });

      const responseBody = await response.json();
      if (response.status !== 200) {
        throw new OursPrivacyHttpError(
          `HTTP error! status: ${response.status}`,
          response.status
        );
      }

      const message =
        responseBody === 0
          ? `${url} api rejected some items`
          : `OursPrivacy batch sent successfully, endpoint: ${endpoint}, data: ${JSON.stringify(
              data
            )}`;

      OursPrivacyLogger.log(token, message);
    } catch (error) {
      if (error.code === 400) {
        // This indicates that the data was invalid and we should not retry
        throw new OursPrivacyHttpError(
          `HTTP error! status: ${error.code}`,
          error.code
        );
      }
      OursPrivacyLogger.warn(
        token,
        `API request to ${url} has failed with reason: ${error.message}`
      );
      const maxRetries = 5;
      const backoff = Math.min(2 ** retryCount * 2000, 60000); // Exponential backoff
      if (retryCount < maxRetries) {
        OursPrivacyLogger.log(token, `Retrying in ${backoff / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return sendRequest({
          token,
          endpoint,
          data,
          serverURL,
          useIPAddressForGeoLocation,
          retryCount: retryCount + 1,
        });
      } else {
        OursPrivacyLogger.warn(token, `Max retries reached. Giving up.`);
        throw new OursPrivacyHttpError(
          `HTTP error! status: ${error.code}`,
          error.code
        );
      }
    }
  };

  return {
    sendRequest,
  };
})();
