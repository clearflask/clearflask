// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';

const isSrcVideo = (src: string): boolean => {
  return src.endsWith('.mp4')
    || src.endsWith('.ogv')
    || src.endsWith('.webm');
}

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'block',
    position: 'relative',
    height: 0,
    overflow: 'hidden',
    margin: 'auto',
  },
  imageAspectRatio: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    maxWidth: '100%',
    maxHeight: '100%',
    transform: 'translate(-50%,-50%)',
  },
});
export interface Props {
  alt?: string;
  img?: Img | Vid;
  className?: string;
  imgClassName?: string;
  src?: string;
  minHeight?: number;
  minWidth?: number;
  height?: number | string;
  width?: number | string;
  maxHeight?: number;
  maxWidth?: number;
  styleOuter?: React.CSSProperties;
  style?: React.CSSProperties;
  aspectRatio?: number;
  scale?: number;
  imgProps?: Object;
}
class ImgIso extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const aspectRatio = this.props.aspectRatio || this.props.img?.aspectRatio;
    const src = this.props.src || this.props.img?.src;
    const isVideo = !!src && isSrcVideo(src);
    const width = this.props.width !== undefined ? this.props.width : (this.props.img?.aspectRatio ? '100%' : undefined);
    const height = this.props.height;
    const maxWidth = this.props.maxWidth || this.props.img?.width;
    const maxHeight = this.props.maxHeight || this.props.img?.height;
    const scale = this.props.scale || 1;
    var media = isVideo ? (
      <video
        autoPlay
        muted // Some browsers will not autoply unmuted
        loop
        className={classNames(this.props.imgClassName, !!aspectRatio && this.props.classes.imageAspectRatio)}
        src={src}
        height={height}
        width={width}
        style={this.props.style}
        {...this.props.imgProps}
      />
    ) : (
      <img
        alt={this.props.alt || ''}
        className={classNames(this.props.imgClassName, !!aspectRatio && this.props.classes.imageAspectRatio)}
        src={src}
        height={height}
        width={width}
        style={this.props.style}
        {...this.props.imgProps}
      />
    );
    if (aspectRatio) media = (
      <div
        className={this.props.className}
        style={{
          ...this.props.styleOuter,
        }}
      >
        <div
          className={this.props.classes.container}
          style={{
            paddingBottom: !!maxHeight
              ? `min(${maxHeight * scale}px, ${100 / aspectRatio}%)`
              : `${100 / aspectRatio}%`,
            minWidth: this.props.minWidth,
            minHeight: this.props.minHeight,
            maxWidth: maxWidth ? maxWidth * scale : undefined,
            maxHeight: maxHeight ? maxHeight * scale : undefined,
          }}
        >
          {media}
        </div>
      </div>
    );
    return media;
  }
}

export default withStyles(styles, { withTheme: true })(ImgIso);
