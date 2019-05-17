import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Motion } from 'react-motion';
import muiSpring from './muiSpring';

const styles = (theme:Theme) => createStyles({
  screen: {
    background: theme.palette.background.default,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  expand:boolean;
}

class RegularTab extends Component<Props> {
  readonly contentRef:React.RefObject<HTMLDivElement> = React.createRef();
  prevExpandValue:boolean;

  parentRect:DOMRect|ClientRect|undefined;
  contentRect:DOMRect|ClientRect|undefined;


  constructor(props:Props) {
    super(props);
    this.prevExpandValue = props.expand;
  }

  render() {
    const expandChanged = this.prevExpandValue !== this.props.expand;
    this.prevExpandValue = this.props.expand;

    if(expandChanged) {
      if(this.props.expand) {
        this.parentRect = this.contentRef.current && this.contentRef.current.offsetParent && this.contentRef.current.offsetParent.getBoundingClientRect() || undefined;
        this.contentRect = this.contentRef.current && this.contentRef.current.getBoundingClientRect() || undefined;
      }
    }

    return (
      <Motion style={{
        top: muiSpring(this.props.expand && this.parentRect && this.contentRect
          ? this.parentRect.top - this.contentRect.top : 0),
        left: muiSpring(this.props.expand && this.parentRect && this.contentRect
          ? this.parentRect.left - this.contentRect.left : 0),
        minWidth: muiSpring(this.props.expand && this.parentRect
          ? this.parentRect.right - this.parentRect.left : 0),
        minHeight: muiSpring(this.props.expand && this.parentRect
          ? this.parentRect.bottom - this.parentRect.top : 0),
        opacity: muiSpring(this.props.expand ? 1 : 0),
      }}>
        {motion => {
          const isFullyDetached = motion.opacity > 0.999;
          const isFullyAttached = motion.opacity < 0.001;
          return (
            <div>
              {/* content */}
              <div ref={this.contentRef} style={{
                position: isFullyAttached ? undefined : 'absolute',
              }}>
                <div style={{
                  position: isFullyAttached ? undefined : 'relative',
                  zIndex: !isFullyAttached ? 600 : undefined,
                  width: this.contentRect ? Math.max(this.contentRect.width, motion.minWidth) : undefined,
                  overflowY: !isFullyAttached && !isFullyDetached ? 'scroll' : undefined,
                  height: this.contentRect ? Math.max(this.contentRect.height, motion.minHeight) : undefined,
                  top: motion.top,
                  left: motion.left,
                  minWidth: motion.minWidth,
                }}>
                  {this.props.children}
                </div>
              </div>
              {/* filler */}
              <div style={{
                width: !isFullyAttached && this.parentRect && this.contentRect
                  ? this.contentRect.right - this.contentRect.left : 0,
                height: !isFullyAttached && this.parentRect && this.contentRect
                  ? this.contentRect.bottom - this.contentRect.top : 0,
              }}></div>
              {/* screen */}
              <div className={this.props.classes.screen} style={{
                visibility: isFullyAttached ? 'hidden' : undefined,
                opacity: motion.opacity,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 500,
                width: '100%',
                height: '100%',
              }}></div>
            </div>
          );
        }}
      </Motion>
    );
  }
}

export default withStyles(styles, { withTheme: true })(RegularTab);
