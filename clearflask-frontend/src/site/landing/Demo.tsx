// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Admin from "../../api/admin";
import DataMock from '../../api/dataMock';
import { StateSettings } from '../../api/server';
import Loading from '../../app/utils/Loading';
import Templater from '../../common/config/configTemplater';
import Promised from '../../common/Promised';
import Scale from '../../common/Scale';
import DemoApp, { deleteProject, getProject, Project } from '../DemoApp';
import Block, { Props as BlockProps } from './Block';

const styles = (theme: Theme) => createStyles({
  insetFadeContainer: {
    position: 'relative',
  },
  insetFade: {
    pointerEvents: 'none',
    boxShadow: 'inset 0px 0px 13px 7px rgb(255, 255, 255, 1)',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
});
interface Props {
  initialSubPath?: string;
  template?: (templater: Templater) => void;
  mock?: (mocker: DataMock, config: Admin.ConfigAdmin) => Promise<any>;
  controls?: (project: Project) => React.ReactNode;
  demo?: (project: Project) => React.ReactNode;
  demoPreventInteraction?: boolean
  demoProject?: Promise<Project>;
  demoScrollYOnClick?: boolean;
  scale?: number;
  settings?: StateSettings;
  containerPortal?: boolean;
  demoInsetFade?: boolean;
}
class Demo extends Component<Props & Exclude<BlockProps, "demo" | "controls"> & WithStyles<typeof styles, true>> {
  demoProjectId?: string;
  readonly projectPromise: Promise<Project>;
  readonly containerRef = React.createRef<any>();
  readonly settings: StateSettings;

  constructor(props) {
    super(props);
    this.settings = {
      ...(props.containerPortal ? { demoPortalContainer: this.containerRef } : {}),
      suppressSetTitle: true,
      ...props.settings,
    };
    this.projectPromise = props.demoProject || getProject(props.template, props.mock, this.settings);
  }

  componentWillUnmount() {
    this.projectPromise.then(project => deleteProject(project.server.getProjectId()));
  }

  render() {
    const { classes, ...blockProps } = this.props;

    var demoPromised = (
      <Promised promise={this.projectPromise} renderLoading={() => (
        <div key='loading' style={{
          width: this.props.demoFixedWidth,
          height: this.props.demoFixedHeight,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Loading />
        </div>
      )} render={project => {
        var demo = this.props.demo
          ? this.props.demo(project)
          : (
            <DemoApp
              server={project.server}
              intialSubPath={this.props.initialSubPath}
              settings={this.settings}
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
          <div
            onClickCapture={this.props.demoPreventInteraction ? undefined : (e) => this.onClickCapture(e, project)}
            style={{
              height: this.props.demoFixedHeight,
              width: this.props.demoFixedWidth,
              overflow: 'hidden',
              position: 'relative', // For containerPortal
              pointerEvents: this.props.demoPreventInteraction ? 'none' : undefined,
            }}
            ref={this.containerRef}
          >
            {demo}
          </div>
        );
        return demo;
      }} />
    );
    if (this.props.demoInsetFade) {
      demoPromised = (
        <div className={this.props.classes.insetFadeContainer} style={{
          height: this.props.demoFixedHeight,
          width: this.props.demoFixedWidth,
        }}>
          <div className={this.props.classes.insetFade} />
          {demoPromised}
        </div>
      );
    }

    return (
      <Block
        {...blockProps}
        controls={this.props.controls && (
          <Promised promise={this.projectPromise} render={project => this.props.controls && this.props.controls(project)} />
        )}
        demo={demoPromised}
      />
    );
  }

  onClickCapture(event, project: Project) {
    if (project.server.getStore().getState().settings.demoUserIsInteracting) {
      return;
    }
    project.server.getStore().dispatch({
      type: 'updateSettings',
      payload: {
        demoUserIsInteracting: true,
        ...(this.props.demoScrollYOnClick ? {
          demoScrollY: true,
        } : {}),
      }
    });
  }
}

export default withStyles(styles, { withTheme: true })(Demo);
