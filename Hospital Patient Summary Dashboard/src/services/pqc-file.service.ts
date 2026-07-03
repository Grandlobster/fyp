/**
 * pqc-file.service.ts
 *
 * Thin client-side wrapper for the two BFF routes exposed by server.mjs.
 * Drop this in  src/services/pqc-file.service.ts  (or wherever DataService
 * lives) and call it from PatientFiles (or wherever you handle file
 * download in the Records section of App.tsx).
 *
 * Nothing in here touches gRPC, AES keys, or raw ciphertext — all of that
 * stays on the server.
 */

const SERVER_BASE = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fields come straight from the ABDM CareContext JSON your UI already has. */
export interface SecureFileRequestParams {
  abha_address: string;
  care_context_reference: string;
  study_uid: string;
  hospital_id: string;
  pacs_endpoint?: string;
  kme_endpoint?: string;
  qkd_node_id?: string;
}

export interface SecureFileHandle {
  transfer_id: string;
  status: 'READY' | 'PENDING' | 'FAILED';
  detail: string;
  /** Hex-encoded ML-KEM public key — informational only, safe to display. */
  mlkem_public_key_hex: string | null;
  signer_key_id: string | null;
}

// ---------------------------------------------------------------------------
// Step 1: request a transfer session
// ---------------------------------------------------------------------------

/**
 * Calls POST /api/files/request.
 * Returns a handle whose transfer_id you pass to downloadDecryptedFile().
 * Throws on network error or non-READY status.
 */
export async function requestSecureFile(
  params: SecureFileRequestParams,
): Promise<SecureFileHandle> {
  const res = await fetch(`${SERVER_BASE}/api/files/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Server returned ${res.status}`);
  }

  return res.json() as Promise<SecureFileHandle>;
}

// ---------------------------------------------------------------------------
// Step 2: stream, decrypt (server-side), and trigger a browser download
// ---------------------------------------------------------------------------

/**
 * Hits GET /api/files/stream/:transferId.
 * The server decrypts everything server-side and streams plaintext bytes.
 * This function fetches the full blob and triggers a Save-As dialog.
 *
 * @param transferId   — from SecureFileHandle.transfer_id
 * @param filename     — suggested filename for the Save-As dialog
 * @param onProgress   — optional callback receiving bytes received so far
 */
export async function downloadDecryptedFile(
  transferId: string,
  filename = 'medical-file.bin',
  onProgress?: (bytesReceived: number) => void,
): Promise<void> {
  const url = `${SERVER_BASE}/api/files/stream/${encodeURIComponent(transferId)}?filename=${encodeURIComponent(filename)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Stream returned ${res.status}`);
  }

  // Read the response as a stream so we can report progress
  const reader = res.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress?.(received);
  }

  // Assemble and trigger the browser's file-save dialog
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

// ---------------------------------------------------------------------------
// Convenience: request + download in one call
// ---------------------------------------------------------------------------

/**
 * Full two-step flow: request a session, then download the decrypted file.
 *
 * Example usage inside PatientFiles:
 *
 *   import { fetchAndDownloadFile } from '@/services/pqc-file.service';
 *
 *   await fetchAndDownloadFile(
 *     {
 *       abha_address:           abhaAddress,          // from App state
 *       care_context_reference: ctx.referenceNumber,  // from CareContext
 *       study_uid:              file.study_uid,
 *       hospital_id:            doctor.hospital_id,   // from login session
 *       pacs_endpoint:          file.pacs_endpoint,
 *       kme_endpoint:           file.kme_endpoint,
 *       qkd_node_id:            file.qkd_node_id,
 *     },
 *     file.filename ?? 'study.dcm',
 *     (bytes) => setDownloadProgress(bytes),
 *   );
 */
export async function fetchAndDownloadFile(
  params: SecureFileRequestParams,
  filename?: string,
  onProgress?: (bytesReceived: number) => void,
): Promise<void> {
  const handle = await requestSecureFile(params);
  await downloadDecryptedFile(handle.transfer_id, filename, onProgress);
}
