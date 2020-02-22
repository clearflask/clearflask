import React, { Component } from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { History, Location } from 'history';
import ServerAdmin, { ReduxStateAdmin } from '../../api/serverAdmin';
import { connect, Provider } from 'react-redux';
import * as Admin from '../../api/admin';
import IdeaExplorer from '../../app/comps/IdeaExplorer';
import { Project } from '../../api/serverAdmin';
import SelectionPicker, {Label} from '../../app/comps/SelectionPicker';
import { Bag } from '../../common/util/bag';
import UserSelection from './UserSelection';

const styles = (theme:Theme) => createStyles({
});

interface ConnectProps {
  projects:Project[];
}
interface State {
  selectedProjectLabel?:Label;
}

class PostsPage extends Component<ConnectProps&WithStyles<typeof styles, true>, State> {
  constructor(props) {
    super(props);
    if(props.isLoggedIn && !props.configsStatus) {
      ServerAdmin.get().dispatchAdmin().then(d => d.configGetAllAdmin());
    }
    this.state = {};
  }

  render() {
    if(this.props.projects.length <= 0) {
      return 'No projects available';
    }
    const hasOnlyOneProject = this.props.projects.length === 1;
    var selectedProjectLabel, selectedProject;
    if(!!this.state.selectedProjectLabel) {
      selectedProjectLabel = this.state.selectedProjectLabel;
      selectedProject = this.props.projects.find(p => p.projectId === this.state.selectedProjectLabel!.value)!;
    } else {
      selectedProjectLabel = {label: this.props.projects[0].editor.getConfig().name, value: this.props.projects[0].projectId};
      selectedProject = this.props.projects[0];
    }
    const authorUserIdBag:Bag<string> = new Bag();
    return (
      <React.Fragment>
        {!hasOnlyOneProject && (
          <SelectionPicker
            value={[selectedProjectLabel]}
            options={this.props.projects.map(p => ({label: p.editor.getConfig().name, value: p.projectId}))}
            isMulti={false}
            bare={false}
            onValueChange={(labels, action) => labels.length === 1 && this.setState({selectedProjectLabel: labels[0]})}
          />
        )}
        <Provider key={selectedProjectLabel.value} store={selectedProject.server.getStore()}>
          <IdeaExplorer
            server={selectedProject.server}
            explorer={{
              allowSearch: true,
              allowCreate: true,
              panel: {
                search: {},
                display: {},
              },
            }}
          />
        </Provider>
      </React.Fragment>
    );
  }
}

export default connect<ConnectProps,{},{},ReduxStateAdmin>((state) => {
  const connectProps:ConnectProps = {
    projects: state.configs.configs.configs && Object.values(state.configs.configs.configs)
      .map(c => ServerAdmin.get().getProject(c)) || [],
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(PostsPage));
