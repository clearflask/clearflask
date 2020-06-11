import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormHelperText, InputLabel } from '@material-ui/core';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../../../api/server';
import ServerAdmin from '../../../api/serverAdmin';
import * as ConfigEditor from '../../../common/config/configEditor';
import Property from './Property';

const styles = (theme: Theme) => createStyles({
  container: {
    marginTop: 46,
  }
});

interface Props {
  server: Server;
  pageClicked: (path: string, subPath?: ConfigEditor.Path) => void;
}
interface State {
  deleteDialogOpen?: boolean;
  isSubmitting?: boolean;
}
class ProjectSettings extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  unsubscribe?: () => void;

  componentDidMount() {
    this.unsubscribe = this.props.server.getStore().subscribe(() => this.forceUpdate());
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    const projectName = this.props.server.getStore().getState().conf.conf?.name || 'project';
    return (
      <div className={this.props.classes.container}>
        <InputLabel>Delete {projectName}</InputLabel>
        <FormHelperText style={{ minWidth: Property.inputMinWidth }}>Permanently deletes {projectName} and all user content.</FormHelperText>
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
            <DialogContentText>Are you sure you want to permanently delete {projectName} including all content?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ deleteDialogOpen: false })}>Cancel</Button>
            <Button
              disabled={this.state.isSubmitting}
              style={{ color: !this.state.isSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={() => {
                this.setState({ isSubmitting: true });
                ServerAdmin.get().dispatchAdmin().then(d => d.projectDeleteAdmin({
                  projectId: this.props.server.getProjectId(),
                }))
                  .then(() => {
                    ServerAdmin.get().removeProject(this.props.server.getProjectId());
                    this.setState({
                      isSubmitting: false,
                      deleteDialogOpen: false,
                    });
                    this.props.pageClicked('create');
                  })
                  .catch(e => this.setState({ isSubmitting: false }));
              }}>Delete</Button>
          </DialogActions>
        </Dialog>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ProjectSettings);
