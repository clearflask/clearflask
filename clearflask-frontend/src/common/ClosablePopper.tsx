import { Fade, IconButton, Paper, Popper, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import { ReferenceObject } from 'popper.js';
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
    boxShadow: (props: Props) => `-7px 4px 42px 8px rgba(0,0,0,.${props.lightShadow ? 1 : 3})`,
  },
  closeIcon: {
    fontSize: 26,
    borderRadius: 30,
  },
  paper: {
    boxShadow: (props: Props) => `-7px 4px 42px 8px rgba(0,0,0,.${props.lightShadow ? 1 : 3})`,
    overflow: 'hidden',
  },
});
interface Props extends PopperProps {
  innerClassName?: string;
  onClose: () => void;
  anchorEl?: null | ReferenceObject;
  lightShadow?: boolean;
  disableCloseButton?: boolean;
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();

  render() {
    const { classes, onClose, ...popperProps } = this.props;

    return (
      <React.Fragment>
        <Popper
          placement='right-start'
          anchorEl={this.props.anchorEl !== undefined
            ? this.props.anchorEl
            : () => this.anchorRef.current!}
          modifiers={{
            preventOverflow: {
              enabled: false,
            },
            ...(popperProps.modifiers || {}),
          }}
          transition
          {...popperProps}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Paper className={this.props.classes.paper}>
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
          )}
        </Popper>
        <div ref={this.anchorRef} />
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopper);
