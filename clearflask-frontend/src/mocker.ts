import { detectEnv, Environment } from './common/util/detectEnv';
import ServerAdmin from './api/serverAdmin';
import * as ConfigEditor from './common/config/configEditor';
import Templater from './common/config/configTemplater';
import DataMock from './api/dataMock';

export function mock():Promise<any> {
  if(detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
    const projectId = 'mock';
    return ServerAdmin.get().dispatchAdmin()
      .then(d => d.projectCreateAdmin({projectId: projectId})
        .then(project =>{
          const editor = new ConfigEditor.EditorImpl(project.config.config);
          Templater.get(editor).demo();
          return d.configSetAdmin({
            projectId: projectId,
            versionLast: project.config.version,
            config: editor.getConfig(),
          });
        })
        .then(() => DataMock.get(projectId).mockAll())
        // .then(() => {if(projectId === 'mock-latency') ServerMock.get().setLatency(true)})
        // .then(() => d.configGetAllAdmin())
      )
  } else {
    return Promise.resolve();
  }
}
