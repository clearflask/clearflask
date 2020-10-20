import { IconButton, ModalManager, Popover, PopoverProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import CloseIcon from '@material-ui/icons/Close';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    maxWidth: 24,
    maxHeight: 24,
  },
  closeIcon: {
    maxWidth: 12,
    maxHeight: 12,
  },
});
interface Props extends PopoverProps {
  spacing?: number;
  onClose: () => void;
  unlockScroll?: boolean;
  suppressCloseButton?: boolean;
}
class ClosablePopover extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const { classes, spacing, unlockScroll, onClose, ...popoverProps } = this.props;
    return (
      <Popover
        disableAutoFocus={this.props.unlockScroll}
        disableEnforceFocus={this.props.unlockScroll}
        disableRestoreFocus={this.props.unlockScroll}
        disableEscapeKeyDown={this.props.unlockScroll}
        disableBackdropClick={this.props.unlockScroll}
        hideBackdrop={this.props.unlockScroll}
        disableScrollLock={this.props.unlockScroll}
        manager={this.props.unlockScroll ? new ModalManager() : undefined}
        style={this.props.unlockScroll ? {
          position: 'relative!important' as 'absolute',
        } : undefined}
        onClose={onClose}
        {...popoverProps}
      >
        <IconButton className={this.props.classes.closeButton} aria-label="Close" onClick={() => this.props.onClose()}>
          <CloseIcon className={this.props.classes.closeIcon} fontSize='inherit' />
        </IconButton>
        {this.props.children}
      </Popover>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ClosablePopover);
