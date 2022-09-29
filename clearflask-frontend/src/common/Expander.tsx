// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { IconButton } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import BackIcon from '@material-ui/icons/ArrowBack';
import React, { Component } from 'react';
import { Motion } from 'react-motion';
import muiSpring from './muiSpring';

const sizeOfBackButton = 44;

const styles = (theme: Theme) => createStyles({
  screen: {
    background: theme.palette.background.default,
  },
  backButton: {
    maxHeight: sizeOfBackButton,
    position: 'absolute',
    transform: 'translate(0%, -100%)',
  }
});
interface Props extends WithStyles<typeof styles, true> {
  expand: boolean;
  onBackButtonPress?: () => void;
  onRest?: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
}
class Expander extends Component<Props> {
  readonly contentRef: React.RefObject<HTMLDivElement> = React.createRef();
  prevExpandValue: boolean;

  parentRect: DOMRect | ClientRect | undefined;
  contentRect: DOMRect | ClientRect | undefined;

  constructor(props: Props) {
    super(props);
    this.prevExpandValue = props.expand;
  }

  render() {
    const expandChanged = this.prevExpandValue !== this.props.expand;
    this.prevExpandValue = this.props.expand;

    if (expandChanged) {
      if (this.props.expand) {
        this.parentRect = this.contentRef.current && this.contentRef.current.offsetParent && this.contentRef.current.offsetParent.getBoundingClientRect() || undefined;
        this.contentRect = this.contentRef.current && this.contentRef.current.getBoundingClientRect() || undefined;

        this.props.onExpand && this.props.onExpand();
      } else {
        this.props.onCollapse && this.props.onCollapse();
      }
    }

    return (
      <Motion style={{
        top: muiSpring(this.props.expand && this.parentRect && this.contentRect
          ? this.parentRect.top - this.contentRect.top : 0, 0.001),
        left: muiSpring(this.props.expand && this.parentRect && this.contentRect
          ? this.parentRect.left - this.contentRect.left : 0, 0.001),
        minWidth: muiSpring(this.props.expand && this.parentRect
          ? this.parentRect.right - this.parentRect.left : 0, 10),
        minHeight: muiSpring(this.props.expand && this.parentRect
          ? this.parentRect.bottom - this.parentRect.top : 0, 10),
        opacity: muiSpring(this.props.expand ? 1 : 0, 0.01),
      }}>
        {motion => {
          const isFullyDetached = motion.opacity > 0.99;
          const isFullyAttached = motion.opacity < 0.01;
          return (
            <div>
              {/* content */}
              <div ref={this.contentRef} style={{
                top: isFullyAttached ? undefined : (this.contentRect?.top || 0) - (this.parentRect?.top || 0),
                left: isFullyAttached ? undefined : (this.contentRect?.left || 0) - (this.parentRect?.left || 0),
                position: isFullyAttached ? undefined : 'absolute',
              }}>
                <div style={{
                  position: isFullyAttached ? undefined : 'relative',
                  zIndex: !isFullyAttached ? 600 : undefined,
                  width: this.contentRect ? Math.max(this.contentRect.width, motion.minWidth) : undefined,
                  overflow: !isFullyAttached && !isFullyDetached ? 'hidden' : undefined,
                  height: this.contentRect ? Math.max(this.contentRect.height, motion.minHeight) : undefined,
                  top: motion.top,
                  left: motion.left,
                  minWidth: motion.minWidth,
                }}>
                  {!!this.props.onBackButtonPress && isFullyDetached && (
                    <IconButton
                      className={this.props.classes.backButton}
                      aria-label='Back'
                      onClick={this.props.onBackButtonPress.bind(this)}
                    >
                      <BackIcon fontSize='small' />
                    </IconButton>
                  )}
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

export default withStyles(styles, { withTheme: true })(Expander);
