/**
 * Shared XHR upload helper. We use XHR (not fetch) because only XHR reports upload
 * progress events, which drive the post-capture progress bar.
 *
 * Failures reject with `UploadHttpError` so callers can tell retryable transport
 * problems (status 0 = network, 5xx, 408/429) from hard failures (quota, auth) and
 * read the provider's error body.
 */
export class UploadHttpError extends Error {
  /** HTTP status; 0 means the request never completed (network drop, sleep). */
  readonly status: number;
  /** Raw response body, for provider-specific error parsing. */
  readonly responseText: string;

  constructor(status: number, responseText: string, message: string) {
    super(message);
    this.name = "UploadHttpError";
    this.status = status;
    this.responseText = responseText;
  }

  get retryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

export interface XhrUploadOptions {
  url: string;
  method?: "PUT" | "POST";
  body: Blob;
  headers?: Record<string, string>;
  onProgress?: (fraction: number) => void;
}

export interface XhrResult {
  status: number;
  responseText: string;
}

export function xhrUpload(opts: XhrUploadOptions): Promise<XhrResult> {
  const { url, method = "PUT", body, headers = {}, onProgress } = opts;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve({ status: xhr.status, responseText: xhr.responseText });
      } else {
        reject(
          new UploadHttpError(
            xhr.status,
            xhr.responseText ?? "",
            `Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`,
          ),
        );
      }
    };
    xhr.onerror = () => reject(new UploadHttpError(0, "", "Network error during upload."));
    xhr.onabort = () => reject(new UploadHttpError(0, "", "The upload was interrupted."));
    xhr.ontimeout = () => reject(new UploadHttpError(0, "", "The upload timed out."));
    xhr.send(body);
  });
}
