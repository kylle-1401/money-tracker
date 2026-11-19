/** How a save ended: shared through the share sheet, downloaded, or cancelled by the user. */
export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Hands a file to the user without any server.
 *
 * On iPhone the share sheet (Web Share API with files) is the reliable way out of a
 * home-screen app: the user picks "Save to Files", AirDrop, email, etc. Elsewhere it
 * falls back to a normal download link.
 */
export async function saveFile(
  filename: string,
  content: string,
  type: string,
): Promise<SaveOutcome> {
  const file = new File([content], filename, { type });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (error) {
      // AbortError = the user closed the share sheet; that's a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Any other share failure: fall through to the download link.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Give the browser a moment to start the download before freeing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}
