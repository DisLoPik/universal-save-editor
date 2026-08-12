export function buildExportFileName(originalFileName: string): string {
  const dot = originalFileName.lastIndexOf('.');
  if (dot <= 0) return `${originalFileName}_edited`;
  return `${originalFileName.slice(0, dot)}_edited${originalFileName.slice(dot)}`;
}

export function buildBackupFileName(originalFileName: string): string {
  const dot = originalFileName.lastIndexOf('.');
  if (dot <= 0) return `${originalFileName}_original`;
  return `${originalFileName.slice(0, dot)}_original${originalFileName.slice(dot)}`;
}

/** Triggers a browser download of `bytes` without ever touching a server. */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  // Cast needed because Uint8Array's buffer is typed ArrayBufferLike (which
  // includes SharedArrayBuffer), while BlobPart requires an ArrayBuffer-backed view.
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
