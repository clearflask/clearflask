import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../../../api/server';

const styles = (theme: Theme) => createStyles({
  row: {
    margin: theme.spacing(2),
  }
});

interface Props {
  server: Server;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
}
class ProjectSettings extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <React.Fragment>
        <Button
          disabled={this.state.isSubmitting}
          style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
          onClick={() => this.setState({ deleteDialogOpen: true })}
        >Delete</Button>
        <Dialog
          open={!!this.state.deleteDialogOpen}
          onClose={() => this.setState({ deleteDialogOpen: false })}
        >
          <DialogTitle>Delete project</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to permanently delete this project including all content?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <Button
              disabled={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                this.props.server.dispatchAdmin().then(d => d.projectDeleteAdmin({
                  projectId: this.props.server.getProjectId(),
                }))
                  .then(() => {
                    this.setState({
                      isSubmitting: false,
                      deleteDialogOpen: false,
                    });
                  })
                  .catch(e => this.setState({ isSubmitting: false }));
              }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ProjectSettings);
