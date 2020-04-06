import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from "../../api/admin";
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
  mock?: (mocker: DataMock, config: Admin.ConfigAdmin) => Promise<any>;
  controls?: (project: Project) => React.ReactNode;
  demo?: (project: Project) => React.ReactNode;
  scale?: number;
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
      <Promised promise={this.projectPromise} render={project => {
        var demo = this.props.demo
          ? this.props.demo(project)
          : (
            <DemoApp
              server={project.server}
              intialSubPath={this.props.initialSubPath}
            />
          );
        if (this.props.scale !== undefined) {
          demo = (
            <div style={{
              transform: `scale(${this.props.scale})`,
              transformOrigin: '0 0',
              width: `${100 / this.props.scale}%`,
              marginBottom: `${(this.props.scale - 1) * 100}%`,
            }}>
              {demo}
            </div>
          );
        }
        return (
          <Block
            title={this.props.title}
            description={this.props.description}
            mirror={this.props.mirror}
            controls={this.props.controls && this.props.controls(project)}
            demo={demo}
          />
        );
      }} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Demo);
