import { Button, Collapse, FormControlLabel, Switch, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import { Alert, AlertTitle } from '@material-ui/lab';
import React, { Component, useState } from 'react';
import { Provider, shallowEqual, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import * as Client from '../../api/client';
import { ReduxState, Server, StateConf } from '../../api/server';
import { ReduxStateAdmin } from '../../api/serverAdmin';
import AppThemeProvider from '../../app/AppThemeProvider';
import { Direction } from '../../app/comps/Panel';
import PanelPost from '../../app/comps/PanelPost';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import { BoardContainer, BoardPanel } from '../../app/CustomPage';
import { HeaderLogo } from '../../app/Header';
import { PostStatusConfig } from '../../app/PostStatus';
import { getPostStatusIframeSrc } from '../../app/PostStatusIframe';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { configStateEqual, Confirmation, ConfirmationResponseId } from '../../common/config/configTemplater';
import DataSettings from '../../common/config/settings/DataSettings';
import Property from '../../common/config/settings/Property';
import { RestrictedProperties } from '../../common/config/settings/UpgradeWrapper';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import FakeBrowser from '../../common/FakeBrowser';
import debounce from '../../common/util/debounce';
import { escapeHtml } from '../../common/util/htmlUtil';
import windowIso from '../../common/windowIso';
import PostSelection from './PostSelection';

const styles = (theme: Theme) => createStyles({
  container: {
    padding: theme.spacing(4),
  },
  browserPreview: {
    marginBottom: 40,
  },
  projectLink: {
    color: theme.palette.primary.main,
    fontWeight: 'bold',
  },
  previewContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  previewTitle: {
    marginTop: 60,
  },
  previewContent: {
    flex: '1 1 300px',
    minWidth: 'min-content',
    width: 300,
  },
  previewSpacer: {
    width: theme.spacing(4),
    height: 0,
  },
  previewPreview: {
    flex: '1 1 300px',
    minWidth: 'min-content',
    width: 300,
    marginTop: 60,
  },
  statusConfigLine: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  statusPreviewContainer: {
    padding: theme.spacing(2, 4),
    display: 'flex',
    height: 80,
    boxSizing: 'content-box',
  },
  statusPreviewText: {
    flex: '1 1 content',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginRight: theme.spacing(1),
  },
  statusPreviewStatus: {
    flex: '1 1 200px',
  },
  roadmapPanelContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    '& > *:not(:first-child)': { marginLeft: theme.spacing(2) },
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
  const [widgetPath, setWidgetPath] = useState<string | undefined>();
  const [popup, setPopup] = useState<boolean>(false);
  const [statusPostLabel, setStatusPostLabel] = useState<Label | undefined>();
  const [statusConfig, setStatusConfig] = useState<Required<PostStatusConfig>>({
    fontSize: '14px',
    fontFamily: '',
    color: '',
    backgroundColor: 'transparent',
    fontWeight: 'normal',
    alignItems: 'center',
    justifyContent: 'flex-start',
    textTransform: '',
  });
  return (
    <ProjectSettingsBase title='Install'>
      <Preview
        title='Portal'
        preview={(
          <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
            <ProjectSettingsInstallPortalPreview server={props.server} />
          </Provider>
        )}
        content={(
          <>
            <p><Typography>The recommended way is to direct your users to the full portal by linking your website with the portal's website.</Typography></p>
          </>
        )}
      />
      <Preview
        title='Widget'
        preview={(
          <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
            <ProjectSettingsInstallWidgetPreview server={props.server} widgetPath={widgetPath} popup={popup} />
          </Provider>
        )}
        content={(
          <>
            <p><Typography>The widget is a simple IFrame tag that can be put anywhere on your site.</Typography></p>
            <p><Typography>You can even put it inside a popup:</Typography></p>
            <ProjectSettingsInstallWidgetPopupSwitch popup={popup} setPopup={setPopup} />
            <p><Typography>Embed the whole portal or an individual page without the navigation menu:</Typography></p>
            <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
              <ProjectSettingsInstallWidgetPath server={props.server} widgetPath={widgetPath} setWidgetPath={setWidgetPath} />
            </Provider>
          </>
        )}
      />
      <Preview
        title='Status'
        preview={(
          <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
            <ProjectSettingsInstallStatusPreview server={props.server} postId={statusPostLabel?.value} config={statusConfig} />
          </Provider>
        )}
        content={(
          <>
            <p><Typography>You can also embed the Status of an idea, or a roadmap item. This is useful if you want to show an upcoming feature or build your own Roadmap.</Typography></p>
            <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
              <PostSelection
                server={props.server}
                label='Search for a post'
                size='small'
                variant='outlined'
                onChange={setStatusPostLabel}
                errorMsg='Search for a post to preview'
                searchIfEmpty
              />
            </Provider>
            <p><Typography>Optionally format the status to fit your website:</Typography></p>
            <ProjectSettingsInstallStatusConfig config={statusConfig} setConfig={setStatusConfig} />
          </>
        )}
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsInstallPortalPreview = (props: {
  server: Server;
}) => {
  const theme = useTheme();
  const domain = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.domain, shallowEqual);
  const slug = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.slug, shallowEqual);
  const projectLink = `${windowIso.location.protocol}//${escapeHtml(domain) || `${escapeHtml(slug)}.${windowIso.location.host}`}`;
  const html = `<a href="${projectLink}" target="_blank">`
    + `\n  Click me to open in a new window`
    + `\n</a>`;
  return (
    <BrowserPreview
      server={props.server}
      addresBar='website'
      code={html}
      suppressStoreProvider
    >
      <div style={{ padding: theme.spacing(4), height: '100%' }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </BrowserPreview>
  );
}
export const ProjectSettingsInstallWidgetPreview = (props: {
  server: Server;
  widgetPath?: string;
  popup: boolean;
}) => {
  const theme = useTheme();
  const domain = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.domain, shallowEqual);
  const slug = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.slug, shallowEqual);
  const projectLink = `${windowIso.location.protocol}//${escapeHtml(domain) || `${escapeHtml(slug)}.${windowIso.location.host}`}${props.widgetPath || ''}`;
  var html;
  var content;
  if (props.popup) {
    html = `<a href="${projectLink}" target="_blank" style="position: relative;" onclick="
  event.preventDefault();
  var el = document.getElementById('cf-widget-content');
  var isShown = el.style.display != 'none'
  el.style.display = isShown ? 'none' : 'block';
">
  Click me to open in a popup
  <iframe src='${projectLink}' id="cf-widget-content" class="cf-widget-content" style="
    display: none;
    height: 600px;
    width: 450px;
    border: 1px solid lightgrey;
    border-radius: 15px;
    box-shadow: -7px 4px 42px 8px rgba(0,0,0,.1);
    position: absolute;
    z-index: 1;
    top: 125%;
    left: 50%;
    transform: translateX(-50%);
  " />
</a>`;
    content = (
      <div style={{ padding: theme.spacing(4) }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  } else {
    html = `<iframe src='${projectLink}'  style="
  width: 100%;
  height: 300px;
  border: 1px solid lightgrey;
" />`;
    content = (
      <div style={{ padding: theme.spacing(1) }}>
        <div style={{ padding: theme.spacing(3) }}>
          Directly on your site:
      </div>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }
  return (
    <BrowserPreview
      server={props.server}
      addresBar='website'
      code={html}
      suppressStoreProvider
    >
      {content}
    </BrowserPreview>
  );
}
export const ProjectSettingsInstallWidgetPath = (props: {
  server: Server;
  widgetPath?: string;
  setWidgetPath: (widgetPath: string | undefined) => void;
}) => {
  const pages = useSelector<ReduxState, Client.Page[] | undefined>(state => state.conf.conf?.layout.pages, shallowEqual) || [];
  const selectedValue: Label[] = [];
  const options: Label[] = [];

  const homeLabel: Label = {
    label: 'Whole portal',
    value: '',
  };
  options.push(homeLabel);
  if (!props.widgetPath) {
    selectedValue.push(homeLabel);
  }

  pages.forEach(page => {
    const pageLabel: Label = {
      label: page.name,
      value: `/embed/${page.slug}`,
    };
    options.push(pageLabel);
    if (pageLabel.value === props.widgetPath) {
      selectedValue.push(pageLabel);
    }
  });

  return (
    <SelectionPicker
      value={selectedValue}
      options={options}
      forceDropdownIcon={true}
      disableInput
      showTags
      noOptionsMessage='No pages'
      width='max-content'
      bareTags
      disableClearable
      onValueChange={labels => labels[0] && props.setWidgetPath(labels[0]?.value || undefined)}
      TextFieldProps={{
        variant: 'outlined',
        size: 'small',
      }}
    />
  );
}
export const ProjectSettingsInstallWidgetPopupSwitch = (props: {
  popup: boolean;
  setPopup: (bare: boolean) => void;
}) => {
  return (
    <FormControlLabel
      label={props.popup ? 'Show as popup' : 'Show inline'}
      control={(
        <Switch
          checked={!!props.popup}
          onChange={(e, checked) => props.setPopup(!props.popup)}
          color='default'
        />
      )}
    />
  );
}
export const ProjectSettingsInstallStatusPreview = (props: {
  server: Server;
  postId?: string;
  config: Required<PostStatusConfig>;
}) => {
  const classes = useStyles();
  const projectId = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.projectId, shallowEqual);
  if (!projectId || !props.postId) {
    return null;
  }
  const src = getPostStatusIframeSrc(props.postId, projectId, props.config);
  const html = `<iframe
  src='${src}'
  frameBorder=0
  scrolling="no"
  allowTransparency="true"
  width="100%"
  height="80px"
/>`;
  return (
    <BrowserPreview
      server={props.server}
      addresBar='website'
      code={html}
      suppressStoreProvider
    >
      <div className={classes.statusPreviewContainer}>
        <div className={classes.statusPreviewText}>My status:&nbsp;</div>
        <div className={classes.statusPreviewStatus} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </BrowserPreview>
  );
}
export const ProjectSettingsInstallStatusConfig = (props: {
  config: Required<PostStatusConfig>;
  setConfig: (config: Required<PostStatusConfig>) => void;
}) => {
  const classes = useStyles();
  const onChange = (key: string, value: string) => props.setConfig({
    ...props.config,
    [key]: value,
  });

  const fontSize = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Text'
      selectedValue={props.config.fontSize + ''}
      onChange={value => onChange('fontSize', value)}
      options={[
        { label: '8px', value: '8px' },
        { label: '9px', value: '9px' },
        { label: '10px', value: '10px' },
        { label: '11px', value: '11px' },
        { label: '12px', value: '12px' },
        { label: '13px', value: '13px' },
        { label: '14px', value: '14px' },
        { label: '15px', value: '15px' },
        { label: '16px', value: '16px' },
        { label: '17px', value: '17px' },
        { label: '18px', value: '18px' },
        { label: '19px', value: '19px' },
        { label: '20px', value: '20px' },
      ]}
    />
  );
  const fontFamily = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Family'
      selectedValue={props.config.fontFamily}
      onChange={value => onChange('fontFamily', value)}
      options={[
        { label: 'Default', value: '' },
        { label: 'Times', value: 'courier' },
        { label: 'Courier', value: 'times' },
        { label: 'Arial', value: 'arial' },
      ]}
    />
  );
  const color = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Text'
      selectedValue={props.config.color}
      onChange={value => onChange('color', value)}
      options={[
        { label: 'Match status', value: '' },
        { label: 'Grey', value: 'grey' },
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' },
        { label: 'Green', value: 'green' },
      ]}
    />
  );
  const backgroundColor = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Background'
      selectedValue={props.config.backgroundColor}
      onChange={value => onChange('backgroundColor', value)}
      options={[
        { label: 'Transparent', value: 'transparent' },
        { label: 'White', value: 'white' },
        { label: 'Red', value: 'lightcoral' },
        { label: 'Blue', value: 'aqua' },
        { label: 'Green', value: 'lightgreen' },
      ]}
    />
  );
  const fontWeight = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Boldness'
      selectedValue={props.config.fontWeight + ''}
      onChange={value => onChange('fontWeight', value)}
      options={[
        { label: 'Normal', value: 'normal' },
        { label: 'Bold', value: 'bold' },
      ]}
    />
  );
  const alignItems = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Vertical'
      selectedValue={props.config.alignItems}
      onChange={value => onChange('alignItems', value)}
      options={[
        { label: 'Top', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'Bottom', value: 'flex-end' },
      ]}
    />
  );
  const justifyContent = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Horizontal'
      selectedValue={props.config.justifyContent}
      onChange={value => onChange('justifyContent', value)}
      options={[
        { label: 'Left', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'Right', value: 'flex-end' },
      ]}
    />
  );
  const textTransform = (
    <ProjectSettingsInstallStatusConfigSelect
      label='Case'
      selectedValue={props.config.textTransform + ''}
      onChange={value => onChange('textTransform', value)}
      options={[
        { label: 'Default', value: '' },
        { label: 'Capitalized', value: 'capitalize' },
        { label: 'Uppercase', value: 'uppercase' },
        { label: 'Lowercase', value: 'lowercase' },
      ]}
    />
  );
  return (
    <>
      <p className={classes.statusConfigLine}><Typography variant='subtitle1' component='span'>Font:</Typography> {fontFamily}{textTransform}</p>
      <p className={classes.statusConfigLine}><Typography variant='subtitle1' component='span'>Size:</Typography> {fontSize}{fontWeight}</p>
      <p className={classes.statusConfigLine}><Typography variant='subtitle1' component='span'>Color:</Typography> {color}{backgroundColor}</p>
      <p className={classes.statusConfigLine}><Typography variant='subtitle1' component='span'>Align:</Typography>{alignItems}{justifyContent}</p>
    </>
  );
}
export const ProjectSettingsInstallStatusConfigSelect = (props: {
  label?: string;
  selectedValue: string;
  onChange: (selectedValue: string) => void;
  options: Array<Label>;
}) => {
  const theme = useTheme();
  const selectedValue = props.options.filter(l => l.value === props.selectedValue);
  return (
    <SelectionPicker
      style={{ display: 'inline-block', margin: theme.spacing(1, 1) }}
      value={selectedValue}
      options={props.options}
      disableInput
      label={props.label}
      width='max-content'
      showTags
      bareTags
      disableClearable
      onValueChange={labels => labels[0] && props.onChange(labels[0].value)}
      TextFieldProps={{
        variant: 'outlined',
        size: 'small',
      }}
    />
  );
}

export const ProjectSettingsBranding = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Branding'>
      <Preview
        title='Logo'
        preview={(
          <BrowserPreview server={props.server}>
            <ProjectSettingsBrandingPreview />
          </BrowserPreview>
        )}
        content={(
          <>
            <PropertyByPath editor={props.editor} path={['name']} />
            <PropertyByPath editor={props.editor} path={['logoUrl']} />
            <PropertyByPath editor={props.editor} path={['website']} />
          </>
        )}
      />
      <Preview
        title='Palette'
        preview={(
          <BrowserPreview server={props.server}>
            <PanelPost
              direction={Direction.Horizontal}
              panel={{
                display: {
                  titleTruncateLines: 1,
                  descriptionTruncateLines: 2,
                  responseTruncateLines: 0,
                  showCommentCount: true,
                  showCreated: true,
                  showAuthor: true,
                  showStatus: true,
                  showTags: true,
                  showVoting: true,
                  showFunding: true,
                  showExpression: true,
                  showEdit: true,
                  showCategoryName: true,
                },
                search: { limit: 1 },
                hideIfEmpty: false,
              }}
              server={props.server}
              disableOnClick
            />
          </BrowserPreview>
        )}
        content={(
          <>
            <PropertyByPath editor={props.editor} path={['style', 'palette', 'darkMode']} />
            <PropertyByPath editor={props.editor} path={['style', 'palette', 'primary']} />
          </>
        )}
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsBrandingPreview = (props: {}) => {
  const configState = useSelector<ReduxState, StateConf>(state => state.conf, configStateEqual);
  return (
    <div style={{ padding: 20 }}>
      <HeaderLogo config={configState.conf} targetBlank suppressLogoLink />
    </div>
  );
}
export const ProjectSettingsDomain = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Custom Domain'>
      <Preview
        preview={(
          <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
            <ProjectSettingsDomainPreview server={props.server} />
          </Provider>
        )}
        content={(
          <>
            <PropertyByPath editor={props.editor} path={['slug']} />
            <PropertyByPath editor={props.editor} path={['domain']} />
          </>
        )}
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsDomainPreview = (props: {
  server: Server;
}) => {
  const classes = useStyles();
  const domain = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.domain, shallowEqual);
  const slug = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.slug, shallowEqual);
  const projectLink = `${windowIso.location.protocol}//${domain || `${slug}.${windowIso.location.host}`}`;
  return (
    <BrowserPreview server={props.server} suppressStoreProvider FakeBrowserProps={{
      addresBarContent: (
        <span className={classes.projectLink}>
          { projectLink}
        </span>),
    }}>
    </BrowserPreview>
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

export const ProjectSettingsLanding = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Landing'>
      <p>TODO choose: home page, or another page as main; if home page chosen:</p>
      <p>TODO Add contact link (email or url)</p>
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsFeedback = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Feedback'>
      <TemplateWrapper<FeedbackInstance | undefined>
        editor={props.editor}
        mapper={templater => templater.feedbackGet()}
        render={(templater, feedback) => (
          <>
            <FormControlLabel
              label={!!feedback?.hasAllPages ? 'Enabled' : 'Disabled'}
              control={(
                <Switch
                  checked={!!feedback?.hasAllPages}
                  onChange={(e, checked) => !!feedback?.hasAllPages
                    ? templater.feedbackOff(feedback)
                    : templater.feedbackOn()}
                  color='primary'
                />
              )}
            />
            <Collapse in={!!feedback?.hasAllPages}>

            </Collapse>
          </>
        )
        }
      />
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
  var planId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);
  return (
    <ProjectSettingsBase title='Roadmap'>
      <TemplateWrapper<RoadmapInstance | undefined>
        editor={props.editor}
        mapper={templater => templater.roadmapGet()}
        render={(templater, roadmap) => (
          <>
            <FormControlLabel
              label={!!roadmap ? 'Enabled' : 'Disabled'}
              control={(
                <Switch
                  checked={!!roadmap}
                  onChange={(e, checked) => !!roadmap
                    ? templater.roadmapOff(roadmap)
                    : templater.roadmapOn()}
                  color='primary'
                />
              )}
            />
            {roadmap && (
              <>
                <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
                  <BoardContainer
                    overrideTitle={(
                      <PropertyByPathReduxless
                        planId={planId}
                        width={200}
                        overrideName='Title'
                        editor={props.editor}
                        path={['layout', 'pages', roadmap?.pageIndex, 'board', 'title']}
                      />
                    )}
                    server={props.server}
                    board={roadmap.page.board}
                    panels={roadmap?.page.board.panels.map((panel, panelIndex) => (
                      <BoardPanel
                        server={props.server}
                        panel={panel}
                        PanelPostProps={{
                          disableOnClick: true,
                          overrideTitle: (
                            <>
                              <PropertyByPathReduxless
                                planId={planId}
                                width='auto'
                                overrideDescription=''
                                overrideName='Title'
                                editor={props.editor}
                                path={['layout', 'pages', roadmap.pageIndex, 'board', 'panels', panelIndex, 'search', 'filterStatusIds']}
                              />
                              <PropertyByPathReduxless
                                planId={planId}
                                width='auto'
                                overrideDescription=''
                                overrideName='Title'
                                editor={props.editor}
                                path={['layout', 'pages', roadmap.pageIndex, 'board', 'panels', panelIndex, 'title']}
                              />
                            </>
                          ),
                        }}
                      />
                    ))}
                  />
                </Provider>
              </>
            )}
          </>
        )
        }
      />
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

const Preview = (props: {
  title?: string;
  content: any;
  preview: any;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.previewContainer}>
      <div className={classes.previewContent}>
        {!!props.title && (
          <Typography variant='h5' component='h2' className={classes.previewTitle}>{props.title}</Typography>
        )}
        {props.content}
      </div>
      <div className={classes.previewSpacer} />
      <div className={classes.previewPreview}>
        {props.preview}
      </div>
    </div>
  );
}
const BrowserPreview = (props: {
  server: Server;
  children?: any;
  FakeBrowserProps?: React.ComponentProps<typeof FakeBrowser>;
  suppressStoreProvider?: boolean;
  suppressThemeProvider?: boolean;
  code?: string;
  addresBar?: 'website';
}) => {
  const classes = useStyles();
  var preview = props.children;
  if (!props.suppressThemeProvider) {
    preview = (
      <AppThemeProvider
        appRootId={props.server.getProjectId()}
        seed={props.server.getProjectId()}
        isInsideContainer={true}
        supressCssBaseline={true}
      >
        {preview}
      </AppThemeProvider>
    );
  }
  preview = (
    <BrowserPreviewInternal FakeBrowserProps={props.FakeBrowserProps} addresBar={props.addresBar} code={props.code}>
      {preview}
    </BrowserPreviewInternal>
  );
  if (!props.suppressStoreProvider) {
    preview = (
      <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
        {preview}
      </Provider>
    );
  }
  return preview;
}
const BrowserPreviewInternal = (props: {
  children?: any;
  code?: string;
  addresBar?: 'website';
  FakeBrowserProps?: React.ComponentProps<typeof FakeBrowser>;
}) => {
  const classes = useStyles();
  const darkMode = useSelector<ReduxState, boolean>(state => !!state?.conf?.conf?.style.palette.darkMode, shallowEqual);
  const website = useSelector<ReduxState, string | undefined>(state => state?.conf?.conf?.website, shallowEqual);
  const addresBar = props.addresBar === 'website'
    ? (website || 'yoursite.com')
    : undefined;
  return (
    <FakeBrowser
      fixedWidth={350}
      codeMaxHeight={150}
      className={classes.browserPreview}
      darkMode={darkMode}
      addresBarContent={addresBar}
      codeContent={props.code}
      {...props.FakeBrowserProps}
    >
      {props.children}
    </FakeBrowser>
  );
}



class TemplateWrapper<T> extends Component<{
  editor: ConfigEditor.Editor;
  mapper: (templater: Templater) => Promise<T>;
  render: (templater: Templater, response: T) => any;
}, {
  confirmation?: Confirmation;
  confirm?: (response: ConfirmationResponseId) => void;
  mappedValue?: { val: T };
}> {
  unsubscribe?: () => void;
  templater: Templater;
  remapDebounced: () => void;

  constructor(props) {
    super(props);

    this.state = {};

    this.templater = Templater.get(
      props.editor,
      (confirmation) => new Promise<ConfirmationResponseId>(resolve => this.setState({
        confirmation,
        confirm: resolve,
      })));

    const refreshMappedValue = () => {
      this.props.mapper(this.templater)
        .then(mappedValue => this.setState({ mappedValue: { val: mappedValue } }));
    }

    this.remapDebounced = debounce(() => {
      refreshMappedValue();
    }, 10);

    refreshMappedValue();
  }

  componentDidMount() {
    this.unsubscribe = this.props.editor.subscribe(() => this.remapDebounced());
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <>
        <Collapse in={!!this.state.confirmation}>
          <Alert
            severity='warning'
            action={this.state.confirmation?.responses.map(response => (
              <Button
                size='small'
                color='inherit'
                style={{ color: response.type === 'cancel' ? 'red' : undefined }}
              >
                {response.type}
              </Button>
            ))}
          >
            <AlertTitle>{this.state.confirmation?.title}</AlertTitle>
            {this.state.confirmation?.description}
          </Alert>
        </Collapse>
        {this.state.mappedValue && this.props.render(this.templater, this.state.mappedValue.val)}
      </>
    );
  }
}
const PropertyByPath = (props: Omit<React.ComponentProps<typeof PropertyByPathReduxless>, 'planId'>) => {
  var planId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);
  return (<PropertyByPathReduxless planId={planId} {...props} />);
}

const PropertyByPathReduxless = (props: {
  planId: string | undefined;
  editor: ConfigEditor.Editor;
  path: ConfigEditor.Path;
  overrideName?: string;
  overrideDescription?: string;
  width?: string | number;
}) => {
  const history = useHistory();

  var propertyRequiresUpgrade: ((propertyPath: ConfigEditor.Path) => boolean) | undefined;
  const restrictedProperties = props.planId && RestrictedProperties[props.planId];
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
      width={props.width || 350}
      overrideName={props.overrideName}
      overrideDescription={props.overrideDescription}
    />
  );
}
