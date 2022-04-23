// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
interface Img {
    // the path of the file with baseDir removed and pathnamePrefix prepended.
    pathname: string;
    // the same as pathname unless base64 was specified and the file size was less than base64.maxSize.
    src: string;
    // when hash is enabled, this property contains the generated hash, undefined otherwise.
    hash?: string;
    // type of the media file, e.g. 'jpg', 'svg', 'mp4'
    type: string;
    // width in pixels of the media file
    width: number;
    // height in pixels of the media file
    height: number;
    // if the file is an svg, the content property will contain the raw svg file contents.
    content?: string;
    // calculated aspect ratio using width / height rounded to 3 decimal places.
    aspectRatio: number;
    // calculated ratio using height / width rounded to 3 decimal places.
    // (useful for ::after padding aspect ratio hack)
    heightToWidthRatio: number
}
interface Vid extends Img { }

// https://github.com/SidOfc/babel-plugin-transform-media-imports#configuration
declare module '*.mp4' { const vid: Vid; export default vid; }
declare module '*.ogv' { const vid: Vid; export default vid; }
declare module '*.webm' { const vid: Vid; export default vid; }
declare module '*.apng' { const img: Img; export default img; }
// https://github.com/image-size/image-size#supported-formats
declare module '*.svg' { const img: Img; export default img; }
declare module '*.bmp' { const img: Img; export default img; }
declare module '*.cur' { const img: Img; export default img; }
declare module '*.dds' { const img: Img; export default img; }
declare module '*.gif' { const img: Img; export default img; }
declare module '*.icns' { const img: Img; export default img; }
declare module '*.ico' { const img: Img; export default img; }
declare module '*.jpg' { const img: Img; export default img; }
declare module '*.jpeg' { const img: Img; export default img; }
declare module '*.ktx' { const img: Img; export default img; }
declare module '*.png' { const img: Img; export default img; }
declare module '*.psd' { const img: Img; export default img; }
declare module '*.tiff' { const img: Img; export default img; }
declare module '*.webp' { const img: Img; export default img; }
