import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'block',
    position: 'relative',
    height: 0,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    maxWidth: 'inherit',
  },
});
export interface Props {
  alt: string;
  className?: string;
  src: string;
  height?: number;
  width?: number;
  style?: React.CSSProperties;
  aspectRatio?: number;
}
class ImgIso extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.className}>
        <div
          className={this.props.classes.container}
          style={{
            paddingBottom: this.props.aspectRatio ? `${100 / this.props.aspectRatio}%` : undefined,
          }}
        >
          <img
            alt={this.props.alt}
            className={this.props.classes.image}
            src={this.props.src}
            height={this.props.height}
            width={this.props.width}
            style={this.props.style}
          />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ImgIso);
