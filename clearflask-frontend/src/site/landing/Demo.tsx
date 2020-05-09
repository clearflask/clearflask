import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from "../../api/admin";
import DataMock from '../../api/dataMock';
import { StateSettings } from '../../api/server';
import Templater from '../../common/config/configTemplater';
import Promised from '../../common/Promised';
import Scale from '../../common/Scale';
import DemoApp, { deleteProject, getProject, Project } from '../DemoApp';
import Block, { Props as BlockProps } from './Block';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  initialSubPath?: string;
  template?: (templater: Templater) => void;
  mock?: (mocker: DataMock, config: Admin.ConfigAdmin) => Promise<any>;
  controls?: (project: Project) => React.ReactNode;
  demo?: (project: Project) => React.ReactNode;
  demoFixedHeight?: number;
  demoFixedWidth?: number;
  scale?: number;
  settings?: StateSettings;
}
class Demo extends Component<Props & Exclude<BlockProps, "demo" | "controls"> & WithStyles<typeof styles, true>> {
  demoProjectId?: string;
  readonly projectPromise: Promise<Project>;

  constructor(props) {
    super(props);
    this.projectPromise = getProject(props.template, props.mock, undefined, props.settings);
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
              settings={this.props.settings}
            />
          );
        if (this.props.scale !== undefined) {
          demo = (
            <Scale scale={this.props.scale} height={this.props.demoFixedHeight}>
              {demo}
            </Scale>
          );
        }
        demo = (
          <div style={{
            height: this.props.demoFixedHeight,
            width: this.props.demoFixedWidth,
            overflowX: 'hidden',
            overflowY: 'scroll',
          }}>
            {demo}
          </div>
        );
        const { classes, ...blockProps } = this.props;
        return (
          <Block
            {...blockProps}
            controls={this.props.controls && this.props.controls(project)}
            demo={demo}
          />
        );
      }} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Demo);
