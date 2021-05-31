import { Theme } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import { CSSProperties } from '@material-ui/core/styles/withStyles';

export enum Orientation {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
  Both = 'both',
}
export enum Side {
  Center = 'center',
  Left = 'left',
  Right = 'right',
}
export interface ContentScrollProps {
  theme: Theme;
  orientation: Orientation;
  side?: Side;
  backgroundColor?: string;
}

export const contentScrollApplyStyles = (props: ContentScrollProps): Record<string, string | CSSProperties> => {
  const theme = props.theme;
  const side = props.side || Side.Center;
  const orientation = props.orientation || Orientation.Horizontal;
  const backgroundColor = props.backgroundColor || theme.palette.background.default;
  const backgrounds: string[] = [];
  const applyBackground = (applyOrientation: Orientation.Horizontal | Orientation.Vertical) => {
    var startHor;
    var startVer;
    var endHor;
    var endVer;
    var radialMultiplier;
    var ellipseShape;
    var coverSize = orientation === Orientation.Both ? 90 : 50;
    var radialSize = orientation === Orientation.Both ? 15 : 15;
    var fadeValue = orientation === Orientation.Both ? 0.05 : 0.2;
    switch (side) {
      default:
      case 'center':
        radialMultiplier = 1;
        break;
      case 'left':
        radialMultiplier = 2;
        break;
      case 'right':
        radialMultiplier = 2;
        break;
    }
    if (applyOrientation === Orientation.Vertical) {
      ellipseShape = `${coverSize}% ${radialSize / radialMultiplier}px`;
      startVer = 'top';
      endVer = 'bottom';
      switch (side) {
        default:
        case 'center':
          startHor = endHor = 'center';
          break;
        case 'left':
          startHor = endHor = 'right';
          break;
        case 'right':
          startHor = endHor = 'center';
          break;
      }
    } else {
      ellipseShape = `${radialSize / radialMultiplier}px ${coverSize}%`;
      startHor = 'left';
      endHor = 'right';
      switch (side) {
        default:
        case 'center':
          startVer = endVer = 'center';
          break;
        case 'left':
          startVer = endVer = 'top';
          break;
        case 'right':
          startVer = endVer = 'bottom';
          break;
      }
    }
    backgrounds.push(
      `radial-gradient(ellipse ${ellipseShape} at ${startHor} ${startVer}, ${backgroundColor} ${100 * radialMultiplier}%, rgba(0,0,0,0) ${200 * radialMultiplier}%)`,
      `radial-gradient(ellipse ${ellipseShape} at ${endHor} ${endVer}, ${backgroundColor} ${100 * radialMultiplier}%, rgba(0,0,0,0) ${200 * radialMultiplier}%)`,
      `radial-gradient(ellipse ${ellipseShape} at ${startHor} ${startVer}, ${fade(theme.palette.common.black, fadeValue)} 0px, rgba(0,0,0,0) ${100 * radialMultiplier}%)`,
      `radial-gradient(ellipse ${ellipseShape} at ${endHor} ${endVer}, ${fade(theme.palette.common.black, fadeValue)} 0px, rgba(0,0,0,0) ${100 * radialMultiplier}%)`,
    );
  };

  switch (orientation) {
    default:
    case Orientation.Both:
      applyBackground(Orientation.Horizontal);
      applyBackground(Orientation.Vertical);
      break;
    case Orientation.Vertical:
    case Orientation.Horizontal:
      applyBackground(orientation);
      break;
  }
  return {
    backgroundColor,
    background: backgrounds.join(','),
    overflowY: orientation !== Orientation.Horizontal ? 'scroll' : 'hidden',
    overflowX: orientation !== Orientation.Vertical ? 'scroll' : 'hidden',
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
