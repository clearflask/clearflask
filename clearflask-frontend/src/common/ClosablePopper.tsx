// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { ClickAwayListener, Fade, IconButton, Paper, Popper, PopperPlacementType, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { TransitionProps } from '@material-ui/core/transitions';
import CloseIcon from '@material-ui/icons/Close';
import classNames from 'classnames';
import React, { Component } from 'react';

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
    boxShadow: `-7px 4px 42px 8px rgba(0,0,0,.1)`,
  },
  closeIcon: {
    fontSize: 26,
    borderRadius: 30,
  },
  paper: {
    boxShadow: `-7px 4px 42px 8px rgba(0,0,0,.1)`,
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    fontSize: 7,
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
    zIndex: (props: Props) => props.zIndex !== undefined ? props.zIndex : theme.zIndex.modal + 1,
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
interface Props extends PopperProps {
  paperClassName?: string;
  zIndex?: number;
  onClose: () => void;
  /** Convenience method instead of anchorEl */
  anchorElGetter?: () => undefined | {
    top: number;
    bottom: number;
    left: number;
    right: number;
    height: number;
    width: number;
  };
  closeButtonPosition?: 'top-left' | 'top-right' | 'disable';
  clickAway?: boolean;
  clickAwayProps?: Partial<React.ComponentProps<typeof ClickAwayListener>>;
  arrow?: boolean;
  transitionCmpt?: (props: TransitionProps) => any;
  transitionProps?: any;
  placement?: PopperPlacementType;
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();
  readonly arrowRef = React.createRef<HTMLSpanElement>();
  boundsLast;

  render() {
    const {
      children,
      classes,
      theme,
      paperClassName,
      zIndex,
      onClose,
      anchorElGetter,
      closeButtonPosition,
      clickAway,
      clickAwayProps,
      arrow,
      transitionCmpt,
      transitionProps,
      placement,
      ...popperProps
    } = this.props;

    const TransitionCmpt = transitionCmpt || Fade;

    const anchorElGetterWrapped = anchorElGetter ? () => {
      const bounds = anchorElGetter && anchorElGetter();
      if (!!bounds) {
        this.boundsLast = bounds;
      }
      if (!this.boundsLast) {
        this.boundsLast = this.anchorRef.current!.getBoundingClientRect();
      }
      return this.boundsLast;
    } : undefined;

    return (
      <>
        <Popper
          placement={placement || 'right-start'}
          anchorEl={this.props.anchorEl !== undefined
            ? this.props.anchorEl
            : () => {
              if (anchorElGetterWrapped) {
                const bounds = anchorElGetterWrapped();
                return {
                  clientHeight: bounds.height,
                  clientWidth: bounds.width,
                  getBoundingClientRect: () => {
                    const boundsInner = anchorElGetterWrapped();
                    return {
                      height: boundsInner.height,
                      width: boundsInner.width,
                      top: boundsInner.top,
                      bottom: boundsInner.bottom,
                      left: boundsInner.left,
                      right: boundsInner.right,
                    };
                  }
                }
              } else {
                return this.anchorRef.current!;
              }
            }}
          transition
          {...popperProps}
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
              onClickAway={() => {
                if (clickAway) {
                  onClose();
                }
              }}
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
        <div ref={this.anchorRef} />
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopper);
