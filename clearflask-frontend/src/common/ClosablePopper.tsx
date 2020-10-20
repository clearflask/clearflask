import { Fade, IconButton, ModalManager, Paper, Popover, PopoverProps, Popper, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import CloseIcon from '@material-ui/icons/Close';

const styles = (theme: Theme) => createStyles({
  closeButton: {
    position: 'absolute',
    top: -24,
    right: -24,
    maxWidth: 24,
    maxHeight: 24,
  },
  closeIcon: {
    maxWidth: 12,
    maxHeight: 12,
  },
  paper: {
    boxShadow: '-7px 4px 42px 8px rgba(0,0,0,.3)',
    overflow: 'auto',
  },
});
interface Props extends PopperProps {
  onClose: () => void;
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();

  render() {
    const { classes, onClose, ...popoverProps } = this.props;

    return (
      <React.Fragment>
        <Popper
          open={!!this.props.open}
          placement='right-start'
          anchorEl={() => this.anchorRef.current!}
          modifiers={{
            flip: {
              enabled: true,
            },
            preventOverflow: {
              enabled: true,
              boundariesElement: 'viewport',
            },
          }}
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Paper className={this.props.classes.paper}>
                <IconButton className={this.props.classes.closeButton} aria-label="Close" onClick={() => this.props.onClose()}>
                  <CloseIcon className={this.props.classes.closeIcon} />
                </IconButton>
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
