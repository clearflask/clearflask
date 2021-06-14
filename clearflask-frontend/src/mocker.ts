import { VersionedConfigAdmin } from './api/admin';
import DataMock from './api/dataMock';
import ServerAdmin from './api/serverAdmin';
import ServerMock, { SSO_SECRET_KEY } from './api/serverMock';
import * as ConfigEditor from './common/config/configEditor';
import Templater, { createTemplateV2OptionsDefault } from './common/config/configTemplater';
import windowIso from './common/windowIso';

export async function mock(slug: string = 'mock'): Promise<VersionedConfigAdmin> {
  const editor = new ConfigEditor.EditorImpl();
  editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(slug);
  const templater = Templater.get(editor);
  await templater.createTemplateV2({
    ...createTemplateV2OptionsDefault,
    infoName: 'Sandbox',
    infoLogo: '/img/clearflask-logo.png',
    infoWebsite: 'https://clearflask.com',
    infoSlug: 'mock',
  });

  templater.usersOnboardingSso(true, SSO_SECRET_KEY, `${windowIso.location.protocol}//${windowIso.location.host.substr(windowIso.location.host.indexOf('.') + 1)}/login?cfr=<return_uri>`, 'ClearFlask');
  const dispatcher = await ServerAdmin.get().dispatchAdmin({ ssr: true });
  const project = await dispatcher.projectCreateAdmin({
    configAdmin: editor.getConfig(),
  });
  const config = await dispatcher.configSetAdmin({
    projectId: project.projectId,
    versionLast: project.config.version,
    configAdmin: editor.getConfig(),
  });
  await DataMock.get(project.projectId).mockAll();
  if (windowIso.location.hash && windowIso.location.hash.substring(1) === 'latency') {
    ServerMock.get().setLatency(true);
  }
  return config;
}

export async function mockIdea(projectId: string, postId: string) {
  return await DataMock.get(projectId).mockFakeIdeaWithComments(postId, config => ({
    statusId: config.content.categories[0]?.workflow.statuses[3]?.statusId,
  }));
}
