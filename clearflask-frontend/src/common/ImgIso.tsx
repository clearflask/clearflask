import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'block',
    position: 'relative',
    height: 0,
    overflow: 'hidden',
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
  alt: string;
  className?: string;
  src: string;
  height?: number | string;
  width?: number | string;
  maxHeight?: number | string;
  maxWidth?: number | string;
  styleOuter?: React.CSSProperties;
  style?: React.CSSProperties;
  aspectRatio?: number;
}
class ImgIso extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var img = (
      <img
        alt={this.props.alt}
        className={classNames(!!this.props.aspectRatio && this.props.classes.imageAspectRatio)}
        src={this.props.src}
        height={this.props.height}
        width={this.props.width}
        style={this.props.style}
      />
    );
    if (this.props.aspectRatio) img = (
      <div
        className={this.props.className}
        style={{
          ...this.props.styleOuter,
          maxWidth: this.props.maxWidth,
          maxHeight: this.props.maxHeight,
        }}
      >
        <div
          className={this.props.classes.container}
          style={{
            paddingBottom: `${100 / this.props.aspectRatio}%`,
          }}
        >
          {img}
        </div>
      </div>
    );
    return img;
  }
}

export default withStyles(styles, { withTheme: true })(ImgIso);
