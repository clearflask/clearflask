import { Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { Server } from '../../api/server';
import { ReduxStateAdmin } from '../../api/serverAdmin';
import * as ConfigEditor from '../../common/config/configEditor';
import DataSettings from '../../common/config/settings/DataSettings';
import Property from '../../common/config/settings/Property';
import { RestrictedProperties } from '../../common/config/settings/UpgradeWrapper';

const styles = (theme: Theme) => createStyles({
  container: {
    padding: theme.spacing(4),
  },
});
const useStyles = makeStyles(styles);

export const ProjectSettingsBase = (props: {
  children?: any,
  title?: string,
  description?: string,
}) => {
  const classes = useStyles();
  return (
    <div className={classes.container}>
      {!!props.title && (
        <Typography variant='h4' component='h1'>{props.title}</Typography>
      )}
      {!!props.description && (
        <Typography variant='body1' component='p'>{props.description}</Typography>
      )}
      {props.children}
    </div>
  );
}

export const ProjectSettingsInstall = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Branding'>
      <p>TODO show project link, encourage linking to it on website</p>
      <p>TODO Show how to embed widget, Select page to embed, ie feature requests, roadmap, etc...</p>
      <p>TODO Show how to embed idea status</p>
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsBranding = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Branding'>
      <PropertyByPath editor={props.editor} path={['name']} />
      <PropertyByPath editor={props.editor} path={['logoUrl']} />
      <PropertyByPath editor={props.editor} path={['website']} />
      <PropertyByPath editor={props.editor} path={['style', 'palette', 'background']} />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsDomain = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Custom Domain'>
      <PropertyByPath editor={props.editor} path={['slug']} />
      <PropertyByPath editor={props.editor} path={['domain']} />
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsUsers = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Users'>
      <p>TODO Copy over onboarding from CreatePage</p>
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsFeedback = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Feedback'>
      <p>TODO enable</p>
      <p>TODO Categories, foreach:</p>
      <p>TODO - name (deduce url path)</p>
      <p>TODO - name</p>
      <p>TODO - tags</p>
      <p>TODO - Create form</p>
      <p>TODO rename statuses (for all categories)</p>
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsRoadmap = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Roadmap'>
      <p>TODO enable</p>
      <p>TODO rename panels</p>
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsChangelog = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Changelog'>
      <p>TODO enable</p>
      <p>TODO tags</p>
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsData = (props: {
  server: Server;
}) => {
  return (
    <ProjectSettingsBase title='Data'>
      <DataSettings
        server={props.server}
      />
    </ProjectSettingsBase>
  );
}

const PropertyByPath = (props: {
  editor: ConfigEditor.Editor;
  path: ConfigEditor.Path;
}) => {
  const history = useHistory();
  const plan = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);

  var propertyRequiresUpgrade: ((propertyPath: ConfigEditor.Path) => boolean) | undefined;
  const restrictedProperties = plan && RestrictedProperties[plan];
  if (restrictedProperties) {
    propertyRequiresUpgrade = (path) => restrictedProperties.some(restrictedPath =>
      ConfigEditor.pathEquals(restrictedPath, path));
  }

  return (
    <Property
      key={ConfigEditor.pathToString(props.path)}
      prop={props.editor.get(props.path)}
      pageClicked={path => history.push(`/dashboard/settings/advanced/${path.join('/')}`)}
      requiresUpgrade={propertyRequiresUpgrade}
      width='350px'
    />
  );
}
