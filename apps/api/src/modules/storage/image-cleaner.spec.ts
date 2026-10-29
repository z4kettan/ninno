import sharp from 'sharp';
import { cleanImage } from './image-cleaner';

/** A photo the way a phone camera writes it: EXIF with GPS, camera model and an orientation tag. */
function phonePhoto(width: number, height: number, orientation = 1): Promise<Buffer> {
  return (
    sharp({
      create: { width, height, channels: 3, background: { r: 40, g: 120, b: 90 } },
    })
      .withExif({
        IFD0: { Make: 'TestPhone', Model: 'Camera 9' },
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '9/1 58/1 0/1',
          GPSLongitudeRef: 'E',
          GPSLongitude: '76/1 17/1 0/1',
        },
      })
      // sharp ignores Orientation inside withExif; this sets the tag.
      .withMetadata({ orientation })
      .jpeg()
      .toBuffer()
  );
}

/** The GPSInfo pointer tag (0x8825), in either TIFF byte order. */
function hasGpsBlock(exif: Buffer): boolean {
  return exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));
}

describe('cleanImage', () => {
  it('removes all metadata, including location', async () => {
    const input = await phonePhoto(800, 600);
    const exif = (await sharp(input).metadata()).exif;
    expect(exif && hasGpsBlock(exif)).toBe(true);
    expect(input.includes('TestPhone')).toBe(true);

    const output = await cleanImage(input);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.xmp).toBeUndefined();
    expect(output.includes('TestPhone')).toBe(false);
  });

  it('caps the long side at 2560px and keeps the aspect ratio', async () => {
    const output = await cleanImage(await phonePhoto(4000, 3000));
    const { width, height } = await sharp(output).metadata();
    expect(width).toBe(2560);
    expect(height).toBe(1920);
  });

  it('never enlarges a small image', async () => {
    const { width, height } = await sharp(await cleanImage(await phonePhoto(640, 480))).metadata();
    expect([width, height]).toEqual([640, 480]);
  });

  it('keeps a rotated phone photo upright once the orientation tag is gone', async () => {
    // Orientation 6: stored landscape, displayed portrait.
    const input = await phonePhoto(800, 600, 6);
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const output = await cleanImage(input);
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([600, 800]);
    expect(meta.orientation).toBeUndefined();
  });

  it('converts PNG to JPEG', async () => {
    const png = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    expect((await sharp(await cleanImage(png)).metadata()).format).toBe('jpeg');
  });

  it('marks ID images with the watermark', async () => {
    const input = await phonePhoto(800, 500);
    const plain = await sharp(await cleanImage(input)).stats();
    const marked = await sharp(
      await cleanImage(input, { watermark: 'For Kayal House <KYC> only' }),
    ).stats();
    // A flat colour has no variation; the watermark text adds some.
    expect(plain.channels[0].stdev).toBeLessThan(1);
    expect(marked.channels[0].stdev).toBeGreaterThan(3);
  });

  it('refuses something that is not an image', async () => {
    await expect(cleanImage(Buffer.from('%PDF-1.7 not an image'))).rejects.toThrow();
  });
});
