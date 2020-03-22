import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import DataMock from '../../api/dataMock';
import Templater from '../../common/config/configTemplater';
import Promised from '../../common/Promised';
import DemoApp, { deleteProject, getProject, Project } from '../DemoApp';
import Block from './Block';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  mirror?: boolean;
  title: string;
  description: string;
  initialSubPath?: string;
  template?: (templater: Templater) => void;
  mock?: (mocker: DataMock) => Promise<any>;
  controls?: (project: Project) => React.ReactNode;
  demo?: (project: Project) => React.ReactNode;
}
class Demo extends Component<Props & WithStyles<typeof styles, true>> {
  demoProjectId?: string;
  readonly projectPromise: Promise<Project>;

  constructor(props) {
    super(props);
    this.projectPromise = getProject(props.template, props.mock);
  }

  componentWillUnmount() {
    this.projectPromise.then(project => deleteProject(project.server.getProjectId()));
  }

  render() {
    return (
      <Promised promise={this.projectPromise} render={project => (
        <Block
          title={this.props.title}
          description={this.props.description}
          mirror={this.props.mirror}
          controls={this.props.controls && this.props.controls(project)}
          demo={this.props.demo
            ? this.props.demo(project)
            : (
              <DemoApp
                server={project.server}
                intialSubPath={this.props.initialSubPath}
              />
            )}
        />
      )} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Demo);
