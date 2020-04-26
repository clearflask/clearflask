import { Paper, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from "../../api/admin";
import DataMock from '../../api/dataMock';
import { StateSettings } from '../../api/server';
import Templater from '../../common/config/configTemplater';
import Promised from '../../common/Promised';
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
  demosContainer: {
    position: 'relative',
  },
  demo: {
    padding: theme.spacing(2),
    width: '100%',
    boxShadow: '0 10px 16px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19)',
    overflow: 'auto',
  },
});

interface Props {
  demos: DemoItem[];
  demoHeight?: number;
  demoSpacing?: number;
}
interface State {
  hoveringDemo?: number;
}
class Demo extends Component<Props & Exclude<BlockProps, "demo" | "controls"> & WithStyles<typeof styles, true> & WithWidthProps, State> {
  state: State = {};
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
              <div style={{
                transform: `scale(${scale})`,
                transformOrigin: '0 0',
                width: `${100 / scale}%`,
                height: '100%',
                marginBottom: `${(scale - 1) * 100}%`,
              }}>
                {d}
              </div>
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

        const demoCount = demos.length;
        var overlap = true;
        var height = this.props.demoHeight || 300
        var spacing = this.props.demoSpacing || 100;
        switch (this.props.width) {
          case "xs":
            overlap = false;
            break;
          case "sm":
            spacing = 150
            break;
          case "md":
            spacing = 50
            break;
          default:
            break;
        }
        const { classes, ...blockProps } = this.props;
        return (
          <Block
            {...blockProps}
            controls={controls.length > 0 ? (
              <div className={this.props.classes.controlsContainer}>
                {controls}
              </div>
            ) : undefined}
            demo={(
              <div className={this.props.classes.demosContainer} style={{
                margin: overlap ? spacing * (demoCount - 1) / 2 : 0,
                height: overlap ? height : undefined,
              }}>
                {demos.map((demo, demoNumber) => (
                  <Paper
                    key={demoNumber}
                    variant='outlined'
                    className={this.props.classes.demo}
                    onMouseOver={this.state.hoveringDemo !== demoNumber ? () => this.setState({ hoveringDemo: demoNumber }) : undefined}
                    style={{
                      height: height,
                      marginBottom: overlap ? 0 : 40,
                      position: overlap ? 'absolute' : 'static',
                      left: overlap ? spacing * ((demoCount - 1) / 2 - demoNumber) : 0,
                      top: overlap ? -spacing * ((demoCount - 1) / 2 - demoNumber) : 0,
                      zIndex: this.state.hoveringDemo === demoNumber ? 1100 : 1000 + demoNumber,
                    }}
                  >
                    {demo}
                  </Paper>
                ))}
              </div>
            )}
          />
        );
      }} />
    );
  }
}

export default withStyles(styles, { withTheme: true })(withWidth()(Demo));
