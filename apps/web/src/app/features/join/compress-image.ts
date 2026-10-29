import { UPLOAD_RULES } from '@ninno/contracts';

export interface DecodedImage {
  width: number;
  height: number;
}

/** The browser parts compression needs, injectable so the size rules can be unit tested. */
export interface ImageCodec<T extends DecodedImage = DecodedImage> {
  /** Decodes with the EXIF orientation applied. */
  decode(file: Blob): Promise<T>;
  encode(image: T, width: number, height: number, quality: number): Promise<Blob>;
}

const QUALITIES = [0.85, 0.75, 0.65, 0.55];

/**
 * Shrinks a phone photo to a JPEG of at most ~1 MB with its long side at most 2560px,
 * stepping the quality down, then the size, until it fits. Cheap phones on 3G upload
 * a fraction of the original.
 */
export async function compressImage<T extends DecodedImage>(
  file: Blob,
  codec: ImageCodec<T>,
  { maxBytes = UPLOAD_RULES.targetBytes, maxSide = UPLOAD_RULES.maxImageSide } = {},
): Promise<Blob> {
  const image = await codec.decode(file);
  let scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  let last: Blob | null = null;
  for (let round = 0; round < 6; round++) {
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    for (const quality of QUALITIES) {
      last = await codec.encode(image, width, height, quality);
      if (last.size <= maxBytes) {
        return last;
      }
    }
    scale *= 0.75;
  }
  // Still large after every step: send the smallest attempt; the server limit is 5 MB.
  return last as Blob;
}

/** The real codec: createImageBitmap + canvas. */
export const browserCodec: ImageCodec<ImageBitmap> = {
  decode: (file) => createImageBitmap(file, { imageOrientation: 'from-image' }),
  encode: (image, width, height, quality) =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('canvas unavailable'));
        return;
      }
      // White behind transparent PNGs, as JPEG has no transparency.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('could not encode image'))),
        'image/jpeg',
        quality,
      );
    }),
};
