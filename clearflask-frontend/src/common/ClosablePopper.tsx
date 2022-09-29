// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { ClickAwayListener, Fade, IconButton, Paper, Popper, PopperPlacementType, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { ZIndex } from '@material-ui/core/styles/zIndex';
import { TransitionProps } from '@material-ui/core/transitions';
import CloseIcon from '@material-ui/icons/Close';
import classNames from 'classnames';
import { ReferenceObject } from 'popper.js';
import React, { Component } from 'react';

interface Bounds {
  height: number;
  width: number;
  top: number;
  left: number;
}
export type AnchorBoundsGetter = () => Bounds | undefined;
type MyDomRect = ReturnType<ReferenceObject['getBoundingClientRect']> & {
  // Not all compilers include these
  x: number;
  y: number;
  toJSON(): any;
};

const styles = (theme: Theme) => createStyles({
  hidden: {
    left: '-100% !important',
  },
  closeButton: {
    position: 'absolute',
    zIndex: -1, // Keep shadow behind popper
    maxWidth: 36,
    maxHeight: 36,
    color: theme.palette.primary.dark,
  },
  closeButtonTopRight: {
    top: -24,
    right: -24,
  },
  closeButtonTopLeft: {
    top: -24,
    left: -24,
  },
  closeButtonLabel: {
    width: 0,
    height: 0,
    boxShadow: `-7px 4px 42px 8px rgba(0,0,0,.2)`,
  },
  closeIcon: {
    fontSize: 26,
    borderRadius: 30,
  },
  paper: {
    boxShadow: `-7px 4px 42px 8px rgba(0,0,0,.2)`,
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    fontSize: 14,
    width: '3em',
    height: '3em',
    '&::before': {
      content: '""',
      margin: 'auto',
      display: 'block',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    },
  },
  popper: {
    zIndex: (props: Props) => props.zIndex === undefined
      ? theme.zIndex.modal + 1
      : (typeof props.zIndex === 'number'
        ? props.zIndex
        : props.zIndex(theme.zIndex)),
    '&[x-placement*="bottom"] $arrow': {
      top: 0,
      left: 0,
      marginTop: '-0.9em',
      width: '3em',
      height: '1em',
      '&::before': {
        borderWidth: '0 1em 1em 1em',
        borderColor: `transparent transparent ${theme.palette.background.paper} transparent`,
      },
    },
    '&[x-placement*="top"] $arrow': {
      bottom: 0,
      left: 0,
      marginBottom: '-0.9em',
      width: '3em',
      height: '1em',
      '&::before': {
        borderWidth: '1em 1em 0 1em',
        borderColor: `${theme.palette.background.paper} transparent transparent transparent`,
      },
    },
    '&[x-placement*="right"] $arrow': {
      left: 0,
      marginLeft: '-0.9em',
      height: '3em',
      width: '1em',
      '&::before': {
        borderWidth: '1em 1em 1em 0',
        borderColor: `transparent ${theme.palette.background.paper} transparent transparent`,
      },
    },
    '&[x-placement*="left"] $arrow': {
      right: 0,
      marginRight: '-0.9em',
      height: '3em',
      width: '1em',
      '&::before': {
        borderWidth: '1em 0 1em 1em',
        borderColor: `transparent transparent transparent ${theme.palette.background.paper}`,
      },
    },
  },
});
type AnchorOptions = {
  anchorType: 'native',
  anchor: PopperProps['anchorEl'],
} | {
  anchorType: 'ref',
  anchor: {
    current?: any;
  },
} | {
  anchorType: 'element',
  anchor: PopperProps['anchorEl'],
} | {
  anchorType: 'virtual',
  anchor: AnchorBoundsGetter | undefined;
} | {
  anchorType: 'in-place',
};
type Props = Omit<PopperProps, 'anchorEl'> & AnchorOptions & {
  paperClassName?: string;
  zIndex?: number | ((zIndexBreakpoints: ZIndex) => number);
  onClose: () => void;
  closeButtonPosition?: 'top-left' | 'top-right' | 'disable';
  clickAway?: boolean;
  clickAwayProps?: Partial<React.ComponentProps<typeof ClickAwayListener>>;
  arrow?: boolean;
  transitionCmpt?: (props: TransitionProps) => any;
  transitionProps?: any;
  placement?: PopperPlacementType;
  useBackdrop?: boolean;
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();
  readonly arrowRef = React.createRef<HTMLSpanElement>();
  boundsLast: Bounds | undefined;

  render() {
    const {
      children,
      classes,
      theme,
      paperClassName,
      zIndex,
      onClose,
      anchorType,
      closeButtonPosition,
      clickAway,
      clickAwayProps,
      arrow,
      transitionCmpt,
      transitionProps,
      placement,
      useBackdrop,
      ...popperProps
    } = this.props;

    const TransitionCmpt = transitionCmpt || Fade;

    var anchorEl: PopperProps['anchorEl'];
    if (this.props.anchorType === 'native') {
      anchorEl = this.props.anchor;
    } else {
      // Overly complicated way to ensure popper.js
      // always gets some kind of coordinates
      anchorEl = () => {
        var el: ReferenceObject | undefined | null;
        if (!el && this.props.anchorType === 'ref') {
          el = this.props.anchor.current;
        }
        if (!el && this.props.anchorType === 'element') {
          el = (typeof this.props.anchor === 'function')
            ? this.props.anchor()
            : this.props.anchor;
        }
        if (!el && this.props.anchorType === 'virtual') {
          const virtualAnchor = this.props.anchor;
          const bounds = virtualAnchor?.() || this.boundsLast;
          if (!!bounds) {
            this.boundsLast = bounds;
          }
          if (bounds) {
            el = {
              clientHeight: bounds.height,
              clientWidth: bounds.width,
              getBoundingClientRect: () => {
                const boundsInner = virtualAnchor?.() || this.boundsLast || bounds;
                this.boundsLast = boundsInner;
                const domRect: MyDomRect = {
                  height: boundsInner.height,
                  width: boundsInner.width,
                  top: boundsInner.top,
                  bottom: boundsInner.top + boundsInner.height,
                  left: boundsInner.left,
                  right: boundsInner.left + boundsInner.width,
                  x: boundsInner.width >= 0 ? boundsInner.left : (boundsInner.left - boundsInner.width),
                  y: boundsInner.height >= 0 ? boundsInner.top : (boundsInner.top - boundsInner.height),
                  toJSON: () => domRect,
                };
                return domRect;
              }
            }
          }
        }
        if (!el) {
          el = this.anchorRef.current;
        }
        if (!el) {
          const domRect: MyDomRect = {
            height: 0,
            width: 0,
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            x: 0,
            y: 0,
            toJSON: () => domRect,
          };
          el = {
            clientHeight: 0,
            clientWidth: 0,
            getBoundingClientRect: () => domRect,
          };
        }
        return el;
      };
    }

    return (
      <>
        <div ref={this.anchorRef} />
        <Popper
          placement={placement || 'right-start'}
          transition
          {...popperProps}
          anchorEl={anchorEl}
          className={classNames(
            classes.popper,
            popperProps.className,
            !popperProps.open && classes.hidden,
          )}
          modifiers={{
            ...(arrow ? {
              arrow: {
                enabled: true,
                element: this.arrowRef.current || '[x-arrow]',
              },
            } : {}),
            ...(popperProps.modifiers || {}),
          }}
        >
          {props => (
            <ClickAwayListener
              mouseEvent='onMouseDown'
              onClickAway={() => clickAway && onClose()}
              {...clickAwayProps}
            >
              <TransitionCmpt
                {...props.TransitionProps}
                {...transitionProps}
              >
                <Paper className={classNames(paperClassName, classes.paper)}>
                  {arrow && (
                    <span x-arrow='true' className={classes.arrow} ref={this.arrowRef} />
                  )}
                  {closeButtonPosition !== 'disable' && (
                    <IconButton
                      classes={{
                        label: classes.closeButtonLabel,
                        root: classNames(
                          classes.closeButton,
                          (closeButtonPosition === 'top-right' || !closeButtonPosition) && classes.closeButtonTopRight,
                          closeButtonPosition === 'top-left' && classes.closeButtonTopLeft,
                        ),
                      }}
                      aria-label="Close"
                      onClick={() => onClose()}
                    >
                      <CloseIcon className={classes.closeIcon} fontSize='inherit' />
                    </IconButton>
                  )}
                  {children}
                </Paper>
              </TransitionCmpt>
            </ClickAwayListener>
          )}
        </Popper>
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopper);
