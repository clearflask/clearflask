import React, { Component } from 'react';
import { MemoryRouter, Route, RouteComponentProps, withRouter } from 'react-router-dom';
import * as Admin from "../api/admin";
import DataMock from '../api/dataMock';
import { Server, StateSettings } from '../api/server';
import ServerMock from '../api/serverMock';
import App from '../app/App';
import * as ConfigEditor from '../common/config/configEditor';
import Templater from '../common/config/configTemplater';
import randomUuid from '../common/util/uuid';

export interface Project {
  server: Server;
  templater: Templater;
  editor: ConfigEditor.Editor;
  saveEdits: () => void;
  mocker: DataMock;
}

export async function getProject(
  template: ((templater: Templater) => void) | undefined = undefined,
  mock: ((mocker: DataMock, config: Admin.ConfigAdmin) => Promise<any>) | undefined = undefined,
  settings?: StateSettings,
): Promise<Project> {
  await new Promise<void>(resolve => setTimeout(resolve, 1));
  const slug = `demo-${randomUuid().substring(0, 5)}`;
  const projectId = `${slug}-${randomUuid().substring(0, 3)}`
  const server = new Server(projectId, settings, ServerMock.get());
  const editor = new ConfigEditor.EditorImpl();
  editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(projectId);
  editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(slug);
  const templater = Templater.get(editor);
  template && template(templater);
  const d = await server.dispatchAdmin();
  await d.projectCreateAdmin({
    configAdmin: editor.getConfig(),
  });
  server.subscribeToChanges(editor);
  const saveEdits = async (): Promise<Admin.VersionedConfigAdmin> => {
    return await d.configSetAdmin({
      projectId,
      configAdmin: editor.getConfig(),
    });
  };
  await saveEdits();
  const mocker = DataMock.get(projectId);
  mock && await mock(mocker, editor.getConfig());
  await server.dispatch().then(d => d.configAndUserBindSlug({
    slug,
    userBind: {},
  }));
  const project = { server, templater, editor, mocker, saveEdits };
  return project;
}

export function deleteProject(projectId: string) {
  ServerMock.get().deleteProject(projectId);
}

interface Props {
  server: Server;
  intialSubPath?: string;
  forcePathSubscribe?: (listener: (forcePath: string) => void) => void;
  settings?: StateSettings;
}

export default class DemoApp extends Component<Props> {

  shouldComponentUpdate(nextProps) {
    return false;
  }

  render() {
    return (
      <MemoryRouter initialEntries={this.props.intialSubPath ? [`${this.props.intialSubPath || '/'}`] : undefined}>
        <Route path="/" render={props => (
          <>
            {this.props.forcePathSubscribe && (
              <ForceUrl forcePathSubscribe={this.props.forcePathSubscribe} />
            )}
            <App
              {...props}
              slug={this.props.server.getStore().getState().conf.conf?.slug!}
              supressCssBaseline
              isInsideContainer
              serverOverride={this.props.server}
              settings={this.props.settings}
            />
          </>
        )} />
      </MemoryRouter>
    );
  }
}

var lastForcedPath;
const ForceUrl = withRouter((props: RouteComponentProps & { forcePathSubscribe: (listener: (forcePath: string) => void) => void }) => {
  props.forcePathSubscribe(forcePath => {
    if (forcePath !== lastForcedPath) {
      setTimeout(() => props.history.push(forcePath!), 1);
      lastForcedPath = forcePath;
    };
  });
  return null;
});
