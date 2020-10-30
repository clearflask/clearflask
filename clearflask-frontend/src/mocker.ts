import DataMock from './api/dataMock';
import ServerAdmin from './api/serverAdmin';
import ServerMock, { SSO_SECRET_KEY } from './api/serverMock';
import * as ConfigEditor from './common/config/configEditor';
import Templater, { createTemplateOptionsDefault } from './common/config/configTemplater';
import { detectEnv, Environment } from './common/util/detectEnv';

export function mock(): Promise<any> {
  if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
    const slug = 'mock';
    const editor = new ConfigEditor.EditorImpl();
    editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(slug);
    const templater = Templater.get(editor);
    templater.demo({
      ...createTemplateOptionsDefault,
      webPushAllowed: true,
      fundingAllowed: true,
      expressionAllowed: true,
    });

    templater.usersOnboardingSso(true, SSO_SECRET_KEY, `${window.location.protocol}//${window.location.host.substr(window.location.host.indexOf('.') + 1)}/login?cfr=<return_uri>`, 'ClearFlask');
    return ServerAdmin.get().dispatchAdmin()
      .then(d => d.projectCreateAdmin({
        configAdmin: editor.getConfig(),
      })
        .then(project => d.configSetAdmin({
          projectId: project.projectId,
          versionLast: project.config.version,
          configAdmin: editor.getConfig(),
        })
        .then(() => DataMock.get(project.projectId).mockAll())
        .then(() => { if (window.location.hash && window.location.hash.substring(1) === 'latency') ServerMock.get().setLatency(true) })));
  } else {
    return Promise.resolve();
  }
}
