import sizeOf from 'image-size';
import path from 'path';
import { Dimensions } from '../common/imageSizerClient';
import connectConfig from './config';

export class ImageSizerCollector {
  cache: { [imagePath: string]: Dimensions | null } = {};

  getHeigth(url: string): number | null {
    return this.getDimensions(url)?.height || null;
  }

  getWidth(url: string): number | null {
    return this.getDimensions(url)?.width || null;
  }

  getDimensions(url: string): Dimensions | null {
    if (!url.startsWith('/')) return null;

    const cacheEntry = this.cache[url];
    if (cacheEntry !== undefined) return cacheEntry;

    var dimensions: Dimensions | null = null;
    try {
      const size = sizeOf(path.join(connectConfig.distPath, url));
      if (size?.width && size?.height) dimensions = {
        width: size.width,
        height: size.height,
      };
    } catch (e) {
      console.warn(`Failed to get image size for ${url}`);
    }

    this.cache[url] = dimensions;

    return dimensions;
  }

  getCache() {
    return this.cache;
  }
}
