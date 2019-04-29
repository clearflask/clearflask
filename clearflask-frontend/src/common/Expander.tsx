import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Motion } from 'react-motion';
import muiSpring from './muiSpring';

const styles = (theme:Theme) => createStyles({
  screen: {
    background: theme.palette.background.default,
  },
  container: {
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
});

interface Props extends WithStyles<typeof styles> {
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

    return [
      <div ref={this.contentRef} style={{
        position: this.props.expand ? 'absolute' : 'static'
      }}>
        <Motion style={{
          top: muiSpring(this.props.expand && this.parentRect && this.contentRect
            ? this.parentRect.top - this.contentRect.top : 0),
          left: muiSpring(this.props.expand && this.parentRect && this.contentRect
            ? this.parentRect.left - this.contentRect.left : 0),
        }}>
          {motionStyle =>
            <div className={this.props.classes.container} style={{
              position: 'relative',
              zIndex: this.props.expand ? 600 : undefined,
              // TODO fix the transition
              width: this.props.expand && this.parentRect && this.contentRect ? this.parentRect.width : undefined,
              ...motionStyle,
            }}>
              {this.props.children}
            </div>
          }
        </Motion>
      </div>,
      // filler
      <div style={{
        width: this.props.expand && this.parentRect && this.contentRect
          ? this.contentRect.right - this.contentRect.left : 0,
        height: this.props.expand && this.parentRect && this.contentRect
          ? this.contentRect.bottom - this.contentRect.top : 0,
      }}></div>,
      // screen to hide previous page
      <Motion style={{
        opacity: muiSpring(this.props.expand ? 1 : 0),
      }}>
        {({opacity}) =>
          <div className={this.props.classes.screen} style={{
            visibility: opacity <= 0.001 ? 'hidden' : undefined,
            opacity: opacity,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 500,
            width: '100%',
            height: '100%',
          }}></div>
        }
      </Motion>
    ];
  }
}

export default withStyles(styles, { withTheme: true })(RegularTab);
