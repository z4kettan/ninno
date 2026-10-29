import { UPLOAD_RULES } from '@ninno/contracts';
import sharp from 'sharp';

export interface CleanImageOptions {
  /** Diagonal text repeated across the image, e.g. "For Kayal House KYC only". */
  watermark?: string;
}

/** Refuses decompression bombs: no phone photo comes near 50 megapixels. */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Re-encodes an uploaded image so that only pixels survive: EXIF (including GPS),
 * ICC and XMP metadata are dropped, orientation is applied to the pixels, and the
 * long side is capped. Throws if the input is not a decodable JPEG or PNG.
 */
export async function cleanImage(input: Buffer, options: CleanImageOptions = {}): Promise<Buffer> {
  const { data, info } = await sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'error',
  })
    // Applies the EXIF orientation, so the picture stays upright once the tag is gone.
    .rotate()
    .resize({
      width: UPLOAD_RULES.maxImageSide,
      height: UPLOAD_RULES.maxImageSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer({ resolveWithObject: true });

  let image = sharp(data);
  if (options.watermark) {
    image = image.composite([
      { input: Buffer.from(watermarkSvg(options.watermark, info.width, info.height)) },
    ]);
  }
  // sharp writes no metadata unless asked to (keepMetadata / withMetadata), so none is copied.
  return image.flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

function escapeXml(text: string): string {
  return text.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );
}

/** Rows of rotated text covering the whole image, dark with a light outline so it shows on any ID. */
function watermarkSvg(text: string, width: number, height: number): string {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 18));
  const lineGap = fontSize * 4;
  const diagonal = Math.ceil(Math.hypot(width, height));
  const label = escapeXml(text);
  const rows: string[] = [];
  for (let y = -diagonal; y < diagonal; y += lineGap) {
    rows.push(
      `<text x="${-diagonal}" y="${y}">${`${label}     `.repeat(Math.ceil((diagonal * 2) / (fontSize * text.length * 0.6)) + 1)}</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <g transform="translate(${width / 2} ${height / 2}) rotate(-30)"
     font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
     fill="#000000" fill-opacity="0.2" stroke="#ffffff" stroke-opacity="0.2" stroke-width="1">
    ${rows.join('\n    ')}
  </g>
</svg>`;
}
