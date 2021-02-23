import { VersionedConfigAdmin } from './api/admin';
import DataMock from './api/dataMock';
import ServerAdmin from './api/serverAdmin';
import ServerMock, { SSO_SECRET_KEY } from './api/serverMock';
import * as ConfigEditor from './common/config/configEditor';
import Templater, { createTemplateOptionsDefault } from './common/config/configTemplater';
import windowIso from './common/windowIso';

var mockedProjectId: string | undefined;
export function mock(slug: string = 'mock'): Promise<VersionedConfigAdmin> {
  const editor = new ConfigEditor.EditorImpl();
  editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(slug);
  const templater = Templater.get(editor);
  templater.demo({
    ...createTemplateOptionsDefault,
    webPushAllowed: true,
    fundingAllowed: true,
    expressionAllowed: true,
  });

  templater.usersOnboardingSso(true, SSO_SECRET_KEY, `${windowIso.location.protocol}//${windowIso.location.host.substr(windowIso.location.host.indexOf('.') + 1)}/login?cfr=<return_uri>`, 'ClearFlask');
  return ServerAdmin.get().dispatchAdmin({ ssr: true })
    .then(d => d.projectCreateAdmin({
      configAdmin: editor.getConfig(),
    }).then(project => {
      mockedProjectId = project.projectId;
      return project;
    }).then(project => d.configSetAdmin({
      projectId: project.projectId,
      versionLast: project.config.version,
      configAdmin: editor.getConfig(),
    }).then(config => {
      DataMock.get(project.projectId).mockAll();
      return config;
    }).then(config => {
      if (windowIso.location.hash && windowIso.location.hash.substring(1) === 'latency') {
        ServerMock.get().setLatency(true);
      }
      return config;
    })));
}

export async function mockIdeaGetProjectId(postId: string): Promise<string> {
  await DataMock.get(mockedProjectId!).mockFakeIdeaWithComments(postId, config => ({
    statusId: config.content.categories[0]?.workflow.statuses[3]?.statusId,
  }));
  return mockedProjectId!;
}
