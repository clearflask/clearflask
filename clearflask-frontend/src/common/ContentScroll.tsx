import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import { CSSProperties } from '@material-ui/core/styles/withStyles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
});

export enum Side {
  Center = 'center',
  Left = 'left',
  Right = 'right',
}

interface Props {
  style?: React.CSSProperties,
  className?: string;
  isVertical?: boolean;
  side?: Side;
  backgroundColor?: string;
}

const radialSize = 15;

export const contentScrollApplyStyles = (theme: Theme, side: Side = Side.Center, isVertical: boolean = false, backgroundColor: string = theme.palette.background.default): CSSProperties => {
  var startHor;
  var startVer;
  var endHor;
  var endVer;
  var radialMultiplier;
  if (isVertical) {
    startVer = 'top';
    endVer = 'bottom';
    switch (side) {
      default:
      case 'center':
        startHor = endHor = 'center';
        radialMultiplier = 1;
        break;
      case 'left':
        startHor = endHor = 'right';
        radialMultiplier = 2;
        break;
      case 'right':
        startHor = endHor = 'center';
        radialMultiplier = 2;
        break;
    }
  } else {
    startHor = 'left';
    endHor = 'right';
    switch (side) {
      default:
      case 'center':
        startVer = endVer = 'center';
        radialMultiplier = 1;
        break;
      case 'left':
        startVer = endVer = 'top';
        radialMultiplier = 2;
        break;
      case 'right':
        startVer = endVer = 'bottom';
        radialMultiplier = 2;
        break;
    }
  }
  const ellipseShape = isVertical ? `50% ${radialSize / radialMultiplier}px` : `${radialSize / radialMultiplier}px 50%`;
  return {
    background: `radial-gradient(ellipse ${ellipseShape} at ${startHor} ${startVer}, ${backgroundColor} ${100 * radialMultiplier}%, rgba(0,0,0,0) ${200 * radialMultiplier}%),`
      + `radial-gradient(ellipse ${ellipseShape} at ${endHor} ${endVer}, ${backgroundColor} ${100 * radialMultiplier}%, rgba(0,0,0,0) ${200 * radialMultiplier}%),`
      + `radial-gradient(ellipse ${ellipseShape} at ${startHor} ${startVer}, ${fade(theme.palette.common.black, 0.2)} 0px, rgba(0,0,0,0) ${100 * radialMultiplier}%),`
      + `radial-gradient(ellipse ${ellipseShape} at ${endHor} ${endVer}, ${fade(theme.palette.common.black, 0.2)} 0px, rgba(0,0,0,0) ${100 * radialMultiplier}%)`,
    overflow: 'hidden',
    [isVertical ? 'overflowY' : 'overflowX']: 'scroll',
    backgroundAttachment: 'local, local, scroll, scroll',
    /* Hide scrollbars */
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', //IE 10+
    '&::-webkit-scrollbar': {
      width: 0,
      height: 0,
      background: 'transparent',
    },
  };
};

class ContentScroll extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.className} style={{
        ...(this.props.style || {}),
        ...(contentScrollApplyStyles(this.props.theme, this.props.side, this.props.isVertical, this.props.backgroundColor)),
      }}>
        {this.props.children}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ContentScroll);
