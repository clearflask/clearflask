import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import windowIso from './windowIso';

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
  ratio: {
    paddingBottom: (props: Props) => {
      if (!props.detectRatio || !windowIso.isSsr) return undefined;
      const dimensions = windowIso.imageSizer.getDimensions(props.src);
      if (!dimensions?.width || !dimensions?.height) return undefined;
      return `${100 / (dimensions.width / dimensions.height)}%`
    },
  },
});
export interface Props {
  alt: string;
  className?: string;
  src: string;
  height?: number;
  width?: number;
  detectSize?: boolean;
  detectRatio?: boolean;
  style?: React.CSSProperties;
}
class ImgIso extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    var height = this.props.height;
    var width = this.props.width;
    if (this.props.detectSize && windowIso.isSsr) {
      if (!height) height = windowIso.imageSizer.getHeigth(this.props.src) || undefined;
      if (!width) width = windowIso.imageSizer.getWidth(this.props.src) || undefined;
    }
    return (
      <div className={this.props.className}>
        <div className={classNames(
          this.props.classes.container,
          this.props.detectRatio && this.props.classes.ratio
        )}>
          <img
            alt={this.props.alt}
            className={this.props.classes.image}
            src={this.props.src}
            height={height}
            width={width}
            style={this.props.style}
          />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ImgIso);
