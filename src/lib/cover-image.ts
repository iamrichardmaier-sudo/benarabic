/** Longest edge of a stored cover, in pixels. */
const MAX_EDGE = 480;
const QUALITY = 0.82;

/**
 * Turn a picture the reader chose into something small enough to keep on the
 * row beside the text.
 *
 * Phone pictures are several megabytes and a cover is shown at thumbnail size,
 * so the original is scaled down and re-encoded rather than stored whole. It
 * stays a data URL: the reader's own copy of their own picture, in their own
 * row, rather than a file uploaded anywhere.
 */
export function readAsCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // No canvas (an old browser, a locked-down webview): keep the
          // original rather than failing the save outright.
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', QUALITY));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
