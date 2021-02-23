import { ClickAwayListener, Fade, IconButton, Paper, Popper, PopperPlacementType, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { TransitionProps } from '@material-ui/core/transitions';
import CloseIcon from '@material-ui/icons/Close';
import classNames from 'classnames';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  closeButton: {
    position: 'absolute',
    zIndex: -1, // Keep shadow behind popper
    top: -24,
    right: -24,
    maxWidth: 36,
    maxHeight: 36,
    color: theme.palette.primary.dark,
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
  disableCloseButton?: boolean;
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
      paperClassName,
      zIndex,
      onClose,
      anchorElGetter,
      disableCloseButton,
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
      <React.Fragment>
        <Popper
          style={{
            ...(zIndex === undefined ? {} : {
              zIndex: zIndex,
            }),
          }}
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
          className={classNames(classes.popper, popperProps.className)}
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
                  {!disableCloseButton && (
                    <IconButton
                      classes={{
                        label: classes.closeButtonLabel,
                        root: classes.closeButton,
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
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopper);
