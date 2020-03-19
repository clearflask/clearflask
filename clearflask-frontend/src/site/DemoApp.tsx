import React, { Component } from 'react';
import { MemoryRouter, Route, RouteComponentProps, withRouter } from 'react-router-dom';
import DataMock from '../api/dataMock';
import { Server } from '../api/server';
import ServerMock from '../api/serverMock';
import App from '../app/App';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import randomUuid from '../common/util/uuid';

export interface Project {
  server: Server;
  templater: Templater;
  editor: ConfigEditor.Editor;
}

export function getProject(
  template: ((templater: Templater) => void) | undefined = undefined,
  mock: ((mocker: DataMock) => void) | undefined = undefined,
  projectId: string = randomUuid(),
): Promise<Project> {
  const server = new Server(projectId, ServerMock.get());
  const editor = new ConfigEditor.EditorImpl();
  editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(projectId);
  editor.getProperty<ConfigEditor.StringProperty>(['name']).set(projectId);
  editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(projectId);
  const templater = Templater.get(editor);
  template && template(templater);
  return server.dispatchAdmin()
    .then(d => d.projectCreateAdmin({
      projectId: projectId,
      configAdmin: editor.getConfig(),
    })
      .then(project => {
        server.subscribeToChanges(editor);
        return d.configSetAdmin({
          projectId: projectId,
          versionLast: project.config.version,
          configAdmin: editor.getConfig(),
        })
          .then(() => mock && mock(DataMock.get(projectId)))
          .then(() => server.dispatch().configGetAndUserBind({ projectId: projectId }))
          .then(() => ({ server, templater, editor }));
      }));
}

export function deleteProject(projectId: string) {
  ServerMock.get().deleteProject(projectId);
}

interface Props {
  server: Server;
  intialSubPath?: string;
  forcePath?: string;
}

export default class DemoApp extends Component<Props> {
  render() {
    return (
      <MemoryRouter initialEntries={this.props.intialSubPath ? [`${this.props.intialSubPath || '/'}`] : undefined}>
        <Route path="/" render={props => (
          <React.Fragment>
            <ForceUrl forcePath={this.props.forcePath} />
            <App
              {...props}
              projectId={this.props.server.getProjectId()}
              supressCssBaseline
              isInsideContainer
              serverOverride={this.props.server} />
          </React.Fragment>
        )} />
      </MemoryRouter>
    );
  }
}

var lastForcedPath;
const ForceUrl = withRouter((props: RouteComponentProps & { forcePath?: string }) => {
  if (props.forcePath !== undefined
    && props.forcePath !== lastForcedPath) {
    setTimeout(() => props.history.push(`/${props.match.params['projectId']}${props.forcePath}`), 1);
  };
  lastForcedPath = props.forcePath
  return null;
});
