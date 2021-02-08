
export interface ImageSizer {
  getHeigth(url: string): number | null;
  getWidth(url: string): number | null;
  getDimensions(url: string): { height: number, width: number } | null;
}

export interface Dimensions {
  height: number;
  width: number;
}

export const IMAGE_SIZER_DATA_KEY = '__SSR_IMAGE_SIZER_DATA__';

export class ImageSizerClient {
  cache: { [imagePath: string]: Dimensions | null };

  constructor(cache = {}) {
    this.cache = cache;
  }

  getHeigth(url: string): number | null {
    return this.getDimensions(url)?.height || null;
  }

  getWidth(url: string): number | null {
    return this.getDimensions(url)?.width || null;
  }

  getDimensions(url: string): Dimensions | null {
    return this.cache[url] || null;
  }
}
