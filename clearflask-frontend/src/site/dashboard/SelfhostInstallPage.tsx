import { ProjectSettingsBase, Section } from './ProjectSettings';
import { Link as MuiLink } from '@material-ui/core';
import React from 'react';
import { Link } from 'react-router-dom';

export const SelfhostInstallPage = () => {
  return (
    <ProjectSettingsBase
      title="Installation"
      description={(
        <>
          ClearFlask can be self-hosted on your own infrastructure using Docker.
        </>
      )}
    >
      <Section
        title="Via Docker"
        content={(
          <>
            Download the <MuiLink rel="noopener nofollow"
                                  href="https://github.com/clearflask/clearflask/blob/master/clearflask-release/src/main/docker/compose/docker-compose.self-host.yml">Docker
            Compose file</MuiLink> and run the following command:
            <br />
            <code>docker-compose --profile with-deps up</code>
          </>
        )}
      />
      <Section
        title="Custom domain"
        content={(
          <>
            To setup a custom domain instead of <code>localhost</code>, <MuiLink rel="noopener nofollow"
                                                                                 href="https://github.com/clearflask/clearflask#dns">follow
            the instructions</MuiLink>.
          </>
        )}
      />
      <Section
        title="Outgoing Email"
        content={(
          <>
            For ClearFlask to send notifications and invitations, you need to setup an SMTP endpoint for sending emails.
          </>
        )}
      />
      <Section
        title="Unlock full potential"
        content={(
          <>
            Apply the <Link to="/dashboard/settings/account/selfhost-service">license</Link> to get full functionality.
          </>
        )}
      />
    </ProjectSettingsBase>
  );
};
