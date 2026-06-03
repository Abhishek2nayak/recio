// Provider interface + registry.
//
// A storage provider is the seam that keeps MyLoom storage-independent: the rest
// of the app only ever talks to this interface, never to a specific cloud SDK.
// To add Dropbox / OneDrive / S3 later, implement the same shape and register it.
//
// Required shape:
//   id            string
//   label         string
//   async connect()                -> { email, name } | throws
//   async disconnect()             -> void
//   async getAccount()             -> { email, name } | null   (no network if cached)
//   async isConnected()            -> boolean
//   async ensureFolder(name)       -> folderId
//   async uploadFile(opts)         -> { fileId, viewUrl }
//        opts = { blob, name, mimeType, folderId?, onProgress?(0..1) }
//   async setSharing(fileId, access) -> { viewUrl }   access: "anyone" | "restricted"

const registry = new Map();

export function registerProvider(provider) {
  registry.set(provider.id, provider);
}

export function getProvider(id) {
  const p = registry.get(id);
  if (!p) throw new Error(`Unknown storage provider: ${id}`);
  return p;
}

export function listProviders() {
  return [...registry.values()].map((p) => ({ id: p.id, label: p.label }));
}
