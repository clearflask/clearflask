import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from "../../api/admin";
import DataMock from '../../api/dataMock';
import { StateSettings } from '../../api/server';
import Templater from '../../common/config/configTemplater';
import Promised from '../../common/Promised';
import Scale from '../../common/Scale';
import Stack, { Props as StackProps } from '../../common/Stack';
import notEmpty from '../../common/util/arrayUtil';
import DemoApp, { deleteProject, getProject, Project } from '../DemoApp';
import Block, { Props as BlockProps } from './Block';

interface DemoItem {
  template?: (templater: Templater) => void;
  mock?: (mocker: DataMock, config: Admin.ConfigAdmin) => Promise<any>;
  settings?: StateSettings;
  scale?: number;
  initialSubPath?: (string | ((project: Project) => string));
  render?: (project: Project) => React.ReactNode;
  controls?: (project: Project) => React.ReactNode;
}

const styles = (theme: Theme) => createStyles({
  controlsContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
});

interface Props {
  demos: DemoItem[];
  demoHeight?: number;
  demoSpacing?: number;
  stackProps?: Omit<StackProps, 'contents'>;
}
class Demo extends Component<Props & Omit<BlockProps, 'demo' | 'controls'> & WithStyles<typeof styles, true>> {
  demoProjectId?: string;
  readonly projectPromises: Promise<Array<Project>>;

  constructor(props) {
    super(props);
    this.projectPromises = Promise.all(props.demos.map(i => getProject(i.template, i.mock, undefined, i.settings)));
  }

  componentWillUnmount() {
    this.projectPromises.then(pps => pps.forEach(p => deleteProject(p.server.getProjectId())));
  }

  render() {
    return (
      <Promised promise={this.projectPromises} render={projects => {
        var demos = projects.map((project, demoIndex) => {
          const demoProps = this.props.demos[demoIndex];
          const renderer = demoProps.render;
          var d = renderer
            ? renderer(project)
            : (
              <DemoApp
                server={project.server}
                intialSubPath={typeof demoProps.initialSubPath === 'string'
                  ? demoProps.initialSubPath
                  : (demoProps.initialSubPath ? demoProps.initialSubPath(project) : undefined)}
                settings={this.props.demos[demoIndex].settings}
              />
            )
          const scale = this.props.demos[demoIndex].scale;
          if (scale !== undefined) {
            d = (
              <Scale scale={scale}>
                {d}
              </Scale>
            );
          }
          return d;
        });

        var controls = this.props.demos.map((d, demoIndex) => {
          if (!d.controls) return undefined;
          return (
            <div key={demoIndex}>
              {d.controls(projects[demoIndex])}
            </div>
          );
        }).filter(notEmpty);

        return (
          <Block
            suppressShadow
            {...this.props as BlockProps}
            controls={controls.length > 0 ? (
              <div className={this.props.classes.controlsContainer}>
                {controls}
              </div>
            ) : undefined}
            demo={(
              <Stack contents={demos} {...this.props.stackProps} />
            )}
          />
        );
      }} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(Demo);
