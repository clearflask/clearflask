import { detectEnv, Environment } from './common/util/detectEnv';
import ServerAdmin from './api/serverAdmin';
import * as ConfigEditor from './common/config/configEditor';
import Templater from './common/config/configTemplater';
import DataMock from './api/dataMock';
import ServerMock from './api/serverMock';

export function mock():Promise<any> {
  if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
    const projectId = 'mock';
    const editor = new ConfigEditor.EditorImpl();
    editor.getProperty<ConfigEditor.StringProperty>(['projectId']).set(projectId);
    editor.getProperty<ConfigEditor.StringProperty>(['name']).set(projectId);
    editor.getProperty<ConfigEditor.StringProperty>(['slug']).set(projectId);
    Templater.get(editor).demo();
    return ServerAdmin.get().dispatchAdmin()
      .then(d => d.projectCreateAdmin({
        projectId: projectId,
        configAdmin: editor.getConfig(),
      })
      .then(project =>{
        return d.configSetAdmin({
          projectId: projectId,
          versionLast: project.config.version,
          configAdmin: editor.getConfig(),
        });
      })
      .then(() => DataMock.get(projectId).mockAll())
      .then(() => {if(window.location.hash && window.location.hash.substring(1) === 'latency') ServerMock.get().setLatency(true)}));
  } else {
    return Promise.resolve();
  }
}
