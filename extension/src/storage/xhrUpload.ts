/**
 * Shared XHR upload helper. We use XHR (not fetch) because only XHR reports upload
 * progress events, which drive the post-capture progress bar.
 */
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
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(body);
  });
}
