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
    isManuallySetId = false,
    retryCount = 0,
  }) => {
    retryCount = retryCount || 0;
    const url = `${serverURL}${endpoint}`;
    OursPrivacyLogger.log(token, `Sending request to: ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          is_manually_set_id: isManuallySetId,
          data,
        }),
      });

      let responseBody;
      try {
        responseBody = await response.json();
      } catch (_) {
        responseBody = {};
      }

      if (!response.ok) {
        throw new OursPrivacyHttpError(
          `HTTP error! status: ${response.status}`,
          response.status
        );
      }

      OursPrivacyLogger.log(
        token,
        `OursPrivacy batch sent successfully, endpoint: ${endpoint}`
      );

      return responseBody;
    } catch (error) {
      if (error.code === 400) {
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
      const backoff = Math.min(2 ** retryCount * 2000, 60000);
      if (retryCount < maxRetries) {
        OursPrivacyLogger.log(token, `Retrying in ${backoff / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return sendRequest({
          token,
          endpoint,
          data,
          serverURL,
          isManuallySetId,
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
