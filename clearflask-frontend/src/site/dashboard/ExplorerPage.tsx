import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect, Provider } from 'react-redux';
import { Server } from '../../api/server';
import ServerAdmin, { Project, ReduxStateAdmin } from '../../api/serverAdmin';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import notEmpty from '../../common/util/arrayUtil';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  render: (server: Server) => React.ReactNode;
}
interface ConnectProps {
  projects: Project[];
}
interface State {
  selectedProjectLabel?: Label;
}

class ExplorerPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  constructor(props) {
    super(props);
    if (props.isLoggedIn && !props.configsStatus) {
      ServerAdmin.get().dispatchAdmin().then(d => d.configGetAllAndUserBindAllAdmin());
    }
    this.state = {};
  }

  render() {
    if (this.props.projects.length <= 0) {
      return 'No projects available';
    }
    const hasOnlyOneProject = this.props.projects.length === 1;
    var selectedProjectLabel, selectedProject;
    if (!!this.state.selectedProjectLabel) {
      selectedProjectLabel = this.state.selectedProjectLabel;
      selectedProject = this.props.projects.find(p => p.projectId === this.state.selectedProjectLabel!.value)!;
    } else {
      selectedProjectLabel = { label: this.props.projects[0].editor.getConfig().name, value: this.props.projects[0].projectId };
      selectedProject = this.props.projects[0];
    }
    return (
      <React.Fragment>
        {!hasOnlyOneProject && (
          <SelectionPicker
            value={[selectedProjectLabel]}
            options={this.props.projects.map(p => ({ label: p.editor.getConfig().name, value: p.projectId }))}
            isMulti={false}
            bare={false}
            onValueChange={(labels, action) => labels.length === 1 && this.setState({ selectedProjectLabel: labels[0] })}
          />
        )}
        <Provider key={selectedProjectLabel.value} store={selectedProject.server.getStore()}>
          {this.props.render(selectedProject.server)}
        </Provider>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state) => {
  const connectProps = {
    projects: state.configs.configs.byProjectId && Object.keys(state.configs.configs.byProjectId)
      .map(projectId => ServerAdmin.get().getOrCreateProject(
        state.configs.configs.byProjectId![projectId].config,
        state.configs.configs.byProjectId![projectId].user))
      .filter(notEmpty) || [],
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(ExplorerPage));
