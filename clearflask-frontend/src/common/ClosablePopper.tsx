import { ClickAwayListener, Fade, IconButton, Paper, Popper, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
  innerClassName?: string;
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
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();
  readonly arrowRef = React.createRef<HTMLSpanElement>();
  boundsLast;

  render() {
    const { classes, onClose, ...popperProps } = this.props;

    const anchorElGetter = this.props.anchorElGetter ? () => {
      const bounds = this.props.anchorElGetter && this.props.anchorElGetter();
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
          placement='right-start'
          anchorEl={this.props.anchorEl !== undefined
            ? this.props.anchorEl
            : () => {
              if (anchorElGetter) {
                const bounds = anchorElGetter();
                return {
                  clientHeight: bounds.height,
                  clientWidth: bounds.width,
                  getBoundingClientRect: () => {
                    const boundsInner = anchorElGetter();
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
          className={classNames(this.props.classes.popper, popperProps.className)}
          modifiers={{
            preventOverflow: {
              enabled: true,
            },
            ...(this.props.arrow ? {
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
              onClickAway={() => {
                if (this.props.clickAway) {
                  this.props.onClose();
                }
              }}
              {...this.props.clickAwayProps}
            >
              <Fade {...props.TransitionProps}>
                <Paper className={this.props.classes.paper}>
                  {this.props.arrow && (
                    <span x-arrow='true' className={this.props.classes.arrow} ref={this.arrowRef} />
                  )}
                  {!this.props.disableCloseButton && (
                    <IconButton
                      classes={{
                        label: this.props.classes.closeButtonLabel,
                        root: this.props.classes.closeButton,
                      }}
                      aria-label="Close"
                      onClick={() => this.props.onClose()}
                    >
                      <CloseIcon className={this.props.classes.closeIcon} fontSize='inherit' />
                    </IconButton>
                  )}
                  {this.props.children}
                </Paper>
              </Fade>
            </ClickAwayListener>
          )}
        </Popper>
        <div ref={this.anchorRef} />
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopper);
