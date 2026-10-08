import { OursPrivacyLogger } from './oursprivacy-logger';

export class OursPrivacyHttpError extends Error {
  constructor(message, errorCode) {
    super(message);
    this.code = errorCode;
  }
}

class OursPrivacyRequestCancelledError extends Error {
  constructor() {
    super('Request cancelled after tracking opt-out');
  }
}

export const OursPrivacyNetwork = (() => {
  const activeRequests = new Map();

  const cancelRequests = (token) => {
    for (const controller of activeRequests.get(token) || []) {
      controller.abort();
    }
  };

  const waitForRetry = (duration, signal) =>
    new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new OursPrivacyRequestCancelledError());
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, duration);
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new OursPrivacyRequestCancelledError());
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

  const sendRequest = async ({
    token,
    endpoint,
    data,
    serverURL,
    isManuallySetId = false,
    retryCount = 0,
  }) => {
    const url = `${serverURL}${endpoint}`;
    const controller = new AbortController();
    let requests = activeRequests.get(token);
    if (!requests) {
      requests = new Set();
      activeRequests.set(token, requests);
    }
    requests.add(controller);

    const attempt = async (count) => {
      if (controller.signal.aborted) {
        throw new OursPrivacyRequestCancelledError();
      }
      OursPrivacyLogger.log(token, `Sending request to: ${url}`);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            is_manually_set_id: isManuallySetId,
            data,
          }),
          signal: controller.signal,
        });

        let responseBody;
        try {
          responseBody = await response.json();
        } catch (_) {
          responseBody = {};
        }
        if (controller.signal.aborted) {
          throw new OursPrivacyRequestCancelledError();
        }
        if (!response.ok) {
          throw new OursPrivacyHttpError(
            `HTTP error! status: ${response.status}`,
            response.status,
          );
        }
        OursPrivacyLogger.log(
          token,
          `OursPrivacy batch sent successfully, endpoint: ${endpoint}`,
        );
        return responseBody;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new OursPrivacyRequestCancelledError();
        }
        if (error.code === 400) {
          throw new OursPrivacyHttpError(
            `HTTP error! status: ${error.code}`,
            error.code,
          );
        }
        OursPrivacyLogger.warn(
          token,
          `API request to ${url} has failed with reason: ${error.message}`,
        );
        const maxRetries = 5;
        const backoff = Math.min(2 ** count * 2000, 60000);
        if (count < maxRetries) {
          OursPrivacyLogger.log(
            token,
            `Retrying in ${backoff / 1000} seconds...`,
          );
          await waitForRetry(backoff, controller.signal);
          return attempt(count + 1);
        }
        OursPrivacyLogger.warn(token, 'Max retries reached. Giving up.');
        throw new OursPrivacyHttpError(
          `HTTP error! status: ${error.code}`,
          error.code,
        );
      }
    };

    try {
      return await attempt(retryCount || 0);
    } finally {
      requests.delete(controller);
      if (requests.size === 0) activeRequests.delete(token);
    }
  };

  return { sendRequest, cancelRequests };
})();
