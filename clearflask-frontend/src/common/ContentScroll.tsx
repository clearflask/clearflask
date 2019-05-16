import React from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';

const styles = (theme:Theme) => createStyles({
});

interface Props {
  style?:React.CSSProperties,
  className?:string;
  isVertical?:boolean;
  isPaper?:boolean;
}

class ContentScroll extends React.Component<Props&WithStyles<typeof styles, true>> {
  readonly radialSize = '12px';

  render() {
    const backgroundColor = this.props.isPaper ? this.props.theme.palette.background.paper : this.props.theme.palette.background.default;
    const ellipseShape = this.props.isVertical ? '50% ' + this.radialSize : this.radialSize + ' 50%';
    return (
      <div className={this.props.className} style={{
        ...(this.props.style || {}),
        background: `radial-gradient(ellipse ${ellipseShape} at ${this.props.isVertical ? 'top' : 'left'}, ${backgroundColor} 100%, rgba(0,0,0,0) 200%),`
          +`radial-gradient(ellipse ${ellipseShape} at ${this.props.isVertical ? 'bottom' : 'right'}, ${backgroundColor} 100%, rgba(0,0,0,0) 200%),`
          +`radial-gradient(ellipse ${ellipseShape} at ${this.props.isVertical ? 'top' : 'left'}, ${fade(this.props.theme.palette.common.black, 0.125)} 0px, rgba(0,0,0,0) 100%),`
          +`radial-gradient(ellipse ${ellipseShape} at ${this.props.isVertical ? 'bottom' : 'right'}, ${fade(this.props.theme.palette.common.black, 0.125)} 0px, rgba(0,0,0,0) 100%)`,
        [this.props.isVertical ? 'overflowY' : 'overflowX']: 'scroll',
        backgroundAttachment: 'local, local, scroll, scroll',
      }}>
        {this.props.children}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ContentScroll);
