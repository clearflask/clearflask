import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { Dialog, withMobileDialog, DialogActions, DialogContent, Button } from '@material-ui/core';
import LogIn, { Props as LogInProps } from './LogIn';
import { InjectedProps } from '@material-ui/core/withMobileDialog';
import { WithWidth } from '@material-ui/core/withWidth';
type WithMobileDialogProps = InjectedProps & Partial<WithWidth>;

const styles = (theme:Theme) => createStyles({
});

interface Props extends LogInProps {
  open?:boolean;
  onClose:()=>void;
}

class LogInDialog extends Component<Props&WithStyles<typeof styles, true>&WithMobileDialogProps> {
  render() {
    return (
      <Dialog
        fullScreen={this.props.fullScreen}
        open={!!this.props.open}
        onClose={this.props.onClose}
      >
        <DialogContent>
          <LogIn {...this.props} />
        </DialogContent>
        {this.props.fullScreen && (
          <DialogActions>
            <Button onClick={this.props.onClose.bind(this)}>
              Cancel
            </Button>
          </DialogActions>
        )}
      </Dialog>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withMobileDialog<Props&WithStyles<typeof styles, true>>()(LogInDialog));
