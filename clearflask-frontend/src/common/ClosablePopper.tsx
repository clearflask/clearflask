import { Fade, IconButton, Paper, Popper, PopperProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
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
    boxShadow: '-7px 4px 42px 16px rgba(0,0,0,.3)',
  },
  closeIcon: {
    fontSize: 26,
    borderRadius: 30,
  },
  paper: {
    boxShadow: '-7px 4px 42px 8px rgba(0,0,0,.3)',
    overflow: 'hidden',
  },
});
interface Props extends PopperProps {
  className?: string;
  onClose: () => void;
}
class ClosablePopper extends Component<Props & WithStyles<typeof styles, true>> {
  readonly anchorRef = React.createRef<HTMLDivElement>();

  render() {
    const { classes, onClose, ...popoverProps } = this.props;

    return (
      <React.Fragment>
        <Popper
          className={this.props.className}
          open={!!this.props.open}
          placement='right-start'
          anchorEl={() => this.anchorRef.current!}
          modifiers={{
            preventOverflow: {
              enabled: false,
            },
          }}
          transition
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps}>
              <Paper className={this.props.classes.paper}>
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
