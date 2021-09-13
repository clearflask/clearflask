// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Checkbox, Collapse, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, IconButton, InputAdornment, InputLabel, Link as MuiLink, MenuItem, Select, Slider, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import AddIcon from '@material-ui/icons/AddRounded';
import EmailAtIcon from '@material-ui/icons/AlternateEmail';
import CheckIcon from '@material-ui/icons/Check';
import DeleteIcon from '@material-ui/icons/DeleteOutline';
import EditIcon from '@material-ui/icons/Edit';
import FacebookIcon from '@material-ui/icons/Facebook';
import GithubIcon from '@material-ui/icons/GitHub';
import CustomIcon from '@material-ui/icons/MoreHoriz';
import { Alert, AlertTitle, ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import classNames from 'classnames';
import React, { Component, useEffect, useRef, useState } from 'react';
import { Provider, shallowEqual, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import * as Admin from '../../api/admin';
import { ReduxState, Server, StateConf, Status } from '../../api/server';
import ServerAdmin, { DemoUpdateDelay, ReduxStateAdmin } from '../../api/serverAdmin';
import AppDynamicPage, { BoardContainer, BoardPanel, LandingLink, PageTitleDescription } from '../../app/AppDynamicPage';
import AppThemeProvider from '../../app/AppThemeProvider';
import { Direction } from '../../app/comps/Panel';
import PanelPost from '../../app/comps/PanelPost';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import TagSelect from '../../app/comps/TagSelect';
import { HeaderLogo } from '../../app/Header';
import { PostStatusConfig } from '../../app/PostStatus';
import { getPostStatusIframeSrc } from '../../app/PostStatusIframe';
import Loading from '../../app/utils/Loading';
import { tourSetGuideState } from '../../common/ClearFlaskTourProvider';
import * as ConfigEditor from '../../common/config/configEditor';
import Templater, { configStateEqual, Confirmation, ConfirmationResponseId } from '../../common/config/configTemplater';
import DataSettings from '../../common/config/settings/DataSettings';
import WorkflowPreview from '../../common/config/settings/injects/WorkflowPreview';
import Property from '../../common/config/settings/Property';
import TableProp from '../../common/config/settings/TableProp';
import UpgradeWrapper, { Action, RestrictedProperties } from '../../common/config/settings/UpgradeWrapper';
import { ChangelogInstance } from '../../common/config/template/changelog';
import { FeedbackInstance } from '../../common/config/template/feedback';
import { LandingInstance } from '../../common/config/template/landing';
import { RoadmapInstance } from '../../common/config/template/roadmap';
import { CategoryAndIndex } from '../../common/config/template/templateUtils';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { Device } from '../../common/DeviceContainer';
import FakeBrowser from '../../common/FakeBrowser';
import DiscordIcon from '../../common/icon/DiscordIcon';
import DynamicMuiIcon from '../../common/icon/DynamicMuiIcon';
import GitlabIcon from '../../common/icon/GitlabIcon';
import GoogleIcon from '../../common/icon/GoogleIcon';
import MicrosoftIcon from '../../common/icon/MicrosoftIcon';
import TwitchIcon from '../../common/icon/TwitchIcon';
import MyAccordion from '../../common/MyAccordion';
import MyColorPicker from '../../common/MyColorPicker';
import { FilterControlSelect } from '../../common/search/FilterControls';
import SubmitButton from '../../common/SubmitButton';
import TextFieldWithColorPicker from '../../common/TextFieldWithColorPicker';
import { TourAnchor, TourDefinitionGuideState } from '../../common/tour';
import UpdatableField from '../../common/UpdatableField';
import { notEmpty } from '../../common/util/arrayUtil';
import debounce from '../../common/util/debounce';
import randomUuid from '../../common/util/uuid';
import windowIso from '../../common/windowIso';
import { getProjectLink } from '../Dashboard';
import { getProject, Project } from '../DemoApp';
import Demo from '../landing/Demo';
import OnboardingDemo from '../landing/OnboardingDemo';
import PostSelection from './PostSelection';

const propertyWidth = 250;

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
  feedbackAccordionContainer: {
    margin: theme.spacing(4, 0),
  },
  feedbackAddNoMargin: {
    margin: theme.spacing(0),
  },
  feedbackTagGroupProperty: {
    marginBottom: theme.spacing(2),
  },
  roadmapAddTitleButton: {
    display: 'block',
    marginTop: theme.spacing(4),
  },
  roadmapPanelAddTitleButton: {
    display: 'block',
    marginTop: theme.spacing(1),
  },
  roadmapPanelContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    '& > *:not(:first-child)': { marginLeft: theme.spacing(2) },
  },
  filterStatus: {
    padding: theme.spacing(2, 2, 0),
  },
  filterStatusInput: {
    borderColor: 'transparent',
  },
  showOrEdit: {
    display: 'flex',
    alignItems: 'center',
  },
  showOrEditButton: {
    marginLeft: theme.spacing(1),
  },
  feedbackTag: {
    marginBottom: theme.spacing(3),
  },
  tagPreviewContainer: {
    padding: theme.spacing(4, 2),
  },
  maxContent: {
    width: 'max-content',
    height: 'max-content',
  },
  previewLandingLink: {
    margin: 'auto'
  },
  previewPageTitleDescription: {
    margin: theme.spacing(2)
  },
  createTemplateButton: {
    margin: theme.spacing(4, 2),
  },
  landingLinkContainer: {
    marginTop: theme.spacing(2),
    display: 'flex',
    alignItems: 'stretch',
  },
  landingLinkPageTextfield: {
    padding: '4.5px!important',
  },
  landingLinkTextfield: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  landingLinkTypeSelect: {
    width: 87,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginRight: -1,
    '& > fieldset': {
      borderRightColor: 'transparent',
    },
  },
  usersOauthAddProp: {
    minWidth: propertyWidth,
    margin: theme.spacing(1, 0),
  },
  usersOauthAddAddButton: {
    margin: theme.spacing(3, 0),
  },
  usersOauthAddSelectItem: {
    display: 'flex',
    alignItems: 'center',
  },
  usersVisibilityButtonGroup: {
    margin: theme.spacing(4, 2),
    display: 'flex',
    justifyContent: 'center',
  },
  usersVisibilityButton: {
    flexDirection: 'column',
    textTransform: 'none',
  },
  usersInlineTextField: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  usersOnboardOption: {
    margin: theme.spacing(0.5, 1),
  },
  usersOnboardOptions: {
    display: 'flex',
    flexDirection: 'column',
  },
  domainField: {
    display: 'flex',
    alignItems: 'flex-end',
  },
  domainFieldText: {
    marginBottom: 5,
  },
  rolePending: {
    color: theme.palette.text.hint,
  },
  item: {
    margin: theme.spacing(4),
  },
  teammatesInviteMargins: {
    margin: theme.spacing(4, 0, 6),
  },
  teammatesInviteNeedHelp: {
    marginBottom: theme.spacing(1),
  },
  advancedEnterAlert: {
    maxWidth: 450,
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
});
const useStyles = makeStyles(styles);

export const ProjectSettingsBase = (props: {
  children?: any,
  title?: string,
  description?: React.ReactNode,
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

export const ProjectSettingsTeammates = (props: {
  server: Server;
}) => {
  const myAccountId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.accountId, shallowEqual);
  const accountBasePlanId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);
  const accountSubscriptionStatus = useSelector<ReduxStateAdmin, Admin.SubscriptionStatus | undefined>(state => state.account.account.account?.subscriptionStatus, shallowEqual);
  if (!accountBasePlanId || !accountSubscriptionStatus) return null;
  return (
    <ProjectSettingsBase title='Teammates'
      description='Invite your teammates to this project only.'>
      <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
        <ProjectSettingsTeammatesList
          server={props.server}
          myAccountId={myAccountId}
          accountBasePlanId={accountBasePlanId}
          accountSubscriptionStatus={accountSubscriptionStatus}
        />
      </Provider>
      <ProjectSettingsTeammatesPermissionsInfo />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsTeammatesList = (props: {
  server: Server;
  myAccountId?: string;
  accountBasePlanId: string;
  accountSubscriptionStatus: Admin.SubscriptionStatus;
}) => {
  const classes = useStyles();
  const theme = useTheme();

  const teammatesStatus = useSelector<ReduxState, Status | undefined>(state => state.teammates.teammates?.status, shallowEqual);
  const teammates = useSelector<ReduxState, Admin.ProjectAdmin[] | undefined>(state => state.teammates.teammates?.teammates, shallowEqual);
  const invitations = useSelector<ReduxState, Admin.InvitationAdmin[] | undefined>(state => state.teammates.teammates?.invitations, shallowEqual);
  if (teammatesStatus === undefined) {
    props.server.dispatchAdmin({ debounce: 100 }).then(d => d.projectAdminsListAdmin({
      projectId: props.server.getProjectId(),
    }));
  }

  const [confirmDeleteTeammate, setConfirmDeleteTeammate] = useState<Admin.ProjectAdmin | undefined>();
  const [isSubmittingRemove, setIsSubmittingRemove] = useState<boolean>();

  if (!teammates || !invitations) return (<Loading />);

  const doRemove = async (request: Pick<Admin.ProjectAdminsRemoveAdminRequest, 'accountId' | 'invitationId'>) => {
    setIsSubmittingRemove(true);
    try {
      await (await props.server.dispatchAdmin({ debounce: true })).projectAdminsRemoveAdmin({
        projectId: props.server.getProjectId(),
        ...request,
      });
      setConfirmDeleteTeammate(undefined);
    } finally {
      setIsSubmittingRemove(false);
    }
  };
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell key='name'>Name</TableCell>
            <TableCell key='email'>Email</TableCell>
            <TableCell key='role'>Role</TableCell>
            <TableCell key='action'></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {teammates.map(teammate => (
            <TableRow key={teammate.accountId}>
              <TableCell key='name'><Typography>{teammate.name}</Typography></TableCell>
              <TableCell key='email'><Typography>{teammate.email}</Typography></TableCell>
              <TableCell key='role'><Typography>{teammate.role}</Typography></TableCell>
              <TableCell key='action'>
                {teammate.role !== Admin.ProjectAdminRoleEnum.Owner && (
                  <IconButton
                    disabled={isSubmittingRemove}
                    onClick={() => setConfirmDeleteTeammate(teammate)}
                  >
                    <DeleteIcon />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
          {invitations.map(invitation => (
            <TableRow key={invitation.invitationId}>
              <TableCell key='name'><Typography></Typography></TableCell>
              <TableCell key='email'><Typography>{invitation.email}</Typography></TableCell>
              <TableCell key='role'><Typography className={classes.rolePending}>Pending</Typography></TableCell>
              <TableCell key='action'>
                {// Because reducer makes a mock invitation with empty invitationId, Only show remove button if not empty
                  !!invitation.invitationId && (
                    <IconButton
                      disabled={isSubmittingRemove}
                      onClick={() => doRemove({ invitationId: invitation.invitationId })}
                    >
                      <DeleteIcon />
                    </IconButton>
                  )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <UpgradeWrapper
        overrideUpgradeMsg='Plan upgrade required to invite more'
        accountBasePlanId={props.accountBasePlanId}
        subscriptionStatus={props.accountSubscriptionStatus}
        action={Action.TEAMMATE_INVITE}
        teammatesCount={teammates.length + invitations.length}
      >
        <Provider store={ServerAdmin.get().getStore()}>
          <TourAnchor anchorId='settings-teammates-invite' placement='bottom'>
            {(next, isActive, anchorRef) => (
              <Provider store={props.server.getStore()}>
                <ProjectSettingsInviteTeammate
                  server={props.server}
                  AddWithNameProps={{ TextFieldProps: { ref: anchorRef } }}
                />
              </Provider>
            )}
          </TourAnchor>
        </Provider>
      </UpgradeWrapper>
      <Dialog
        open={!!confirmDeleteTeammate}
        onClose={() => setConfirmDeleteTeammate(undefined)}
      >
        <DialogTitle>Remove teammate</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to remove your teammate from this project? This will not remove their contributions nor any project users/mods they may have created and may still have access to.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteTeammate(undefined)}
          >Cancel</Button>
          <SubmitButton
            isSubmitting={isSubmittingRemove}
            style={{ color: !isSubmittingRemove ? theme.palette.error.main : undefined }}
            onClick={() => doRemove({ accountId: confirmDeleteTeammate?.accountId })}>
            Remove
          </SubmitButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
export const NeedHelpInviteTeammate = (props: {
  server: Server;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.teammatesInviteMargins}>
      <Typography variant='h6' className={classes.teammatesInviteNeedHelp}>Need help?</Typography>
      <Provider store={props.server.getStore()}>
        <ProjectSettingsInviteTeammate server={props.server} noMargin />
      </Provider>
    </div>
  );
}
export const ProjectSettingsInviteTeammate = (props: {
  server: Server;
  noMargin?: boolean;
  AddWithNameProps?: Partial<React.ComponentProps<typeof ProjectSettingsAddWithName>>;
}) => {
  const classes = useStyles();
  const website = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.website, shallowEqual);
  var domain = 'example.com';
  if (website) {
    try {
      const { hostname } = new URL(website);
      domain = hostname;
    } catch (e) { }
  }
  return (
    <ProjectSettingsAddWithName
      className={classNames(
        !props.noMargin && classes.teammatesInviteMargins,
      )}
      label='Invite a teammate'
      placeholder={`sandy@${domain}`}
      noMargin
      onAdd={email => props.server.dispatchAdmin({ debounce: true }).then(d => d.projectAdminsInviteAdmin({
        projectId: props.server.getProjectId(),
        email,
      })).then(() => tourSetGuideState('invite-teammates', TourDefinitionGuideState.Completed))}
      {...props.AddWithNameProps}
    />
  );
}
const permissions: Array<[number, number, number, number, string]> = [
  [1, 1, 1, 1, 'View portal'],
  [1, 1, 1, 1, 'Submit feedback'],
  [0, 1, 1, 1, "Submit feedback on-behalf"],
  [0, 1, 1, 1, "Create/modify any post"],
  [0, 1, 1, 1, "Create/modify users/mods"],
  [0, 1, 1, 1, "Delete any comment"],
  [0, 0, 1, 1, 'Dashboard access'],
  [0, 0, 1, 1, 'Address feedback'],
  [0, 0, 1, 1, 'Prioritize roadmap'],
  [0, 0, 1, 1, 'Manage changelog'],
  [0, 0, 1, 1, 'Project settings'],
  [0, 0, 0, 1, 'API access'],
  [0, 0, 0, 1, 'Delete project'],
  [0, 0, 0, 1, 'Account Billing'],
];
export const ProjectSettingsTeammatesPermissionsInfo = (props: {}) => {
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell key='permission'>
              <Typography variant='h5' component='div'>Permissions</Typography>
            </TableCell>
            <TableCell key='User'>User</TableCell>
            <TableCell key='Mod'>Mod</TableCell>
            <TableCell key='Admin'>Admin</TableCell>
            <TableCell key='Owner'>Owner</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {permissions.map((permission, permisionIndex) => (
            <TableRow key={permisionIndex}>
              <TableCell key='permission'><Typography>{permission[permission.length - 1]}</Typography></TableCell>
              {permission.map((item, itemIndex, itemArr) => (itemIndex < (itemArr.length - 1)) ? (
                <TableCell key={itemIndex}>{!!item && (<CheckIcon color='primary' />)}</TableCell>
              ) : null)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

export const ProjectSettingsInstall = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Install'>
      <ProjectSettingsInstallPortal server={props.server} editor={props.editor} />
      <NeedHelpInviteTeammate server={props.server} />
      <ProjectSettingsInstallWidget server={props.server} editor={props.editor} />
      <ProjectSettingsInstallStatus server={props.server} editor={props.editor} />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsInstallPortal = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <Section
      title='Portal'
      preview={(
        <TourAnchor anchorId='settings-install-portal-code' placement='bottom'>
          <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
            <ProjectSettingsInstallPortalPreview server={props.server} />
          </Provider>
        </TourAnchor>
      )}
      content={(
        <>
          <p><Typography>Link your product directly to the full portal. Add the following link to your product's website.</Typography></p>
        </>
      )}
    />
  );
}
export const ProjectSettingsInstallWidget = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const [widgetPath, setWidgetPath] = useState<string | undefined>();
  const [popup, setPopup] = useState<boolean>(false);
  return (
    <Section
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
  );
}
export const ProjectSettingsInstallStatus = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const [statusPostId, setStatusPostId] = useState<string>();
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
    <Section
      title='Status'
      preview={(
        <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
          <ProjectSettingsInstallStatusPreview server={props.server} postId={statusPostId} config={statusConfig} />
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
              onChange={postIds => setStatusPostId(postIds[0])}
              errorMsg='Search for a post to preview'
              searchIfEmpty
              initialSelectAny
            />
          </Provider>
          <p><Typography>Optionally format the status to fit your website:</Typography></p>
          <ProjectSettingsInstallStatusConfig config={statusConfig} setConfig={setStatusConfig} />
        </>
      )}
    />
  );
}
export const ProjectSettingsInstallPortalPreview = (props: {
  server: Server;
}) => {
  const theme = useTheme();
  const config = useSelector<ReduxState, Admin.Config | undefined>(state => state.conf.conf, shallowEqual);
  if (!config) return null;
  const projectLink = getProjectLink(config);
  const html = `<a href="${projectLink}" target="_blank">`
    + `\n  Give feedback`
    + `\n</a>`;
  return (
    <BrowserPreview
      server={props.server}
      addressBar='website'
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
  if (slug === undefined) return null;
  const projectLink = `${getProjectLink({ domain, slug })}${props.widgetPath || ''}`;
  const htmlPopup = `<a href="${projectLink}" target="_blank" style="position: relative;" onclick="
  event.preventDefault();
  var el = document.getElementById('cf-widget-content');
  var isShown = el.style.display != 'none'
  el.style.display = isShown ? 'none' : 'block';
">
  Give feedback
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
  const htmlIframe = `<iframe src='${projectLink}'  style="
  width: 100%;
  height: 300px;
  border: 1px solid lightgrey;
" />`;
  return (
    <BrowserPreview
      server={props.server}
      addressBar='website'
      code={props.popup ? htmlPopup : htmlIframe}
      suppressStoreProvider
    >
      <Collapse mountOnEnter in={props.popup}>
        <div style={{ padding: theme.spacing(4) }}>
          <div dangerouslySetInnerHTML={{ __html: htmlPopup }} />
        </div>
      </Collapse>
      <Collapse mountOnEnter in={!props.popup}>
        <div style={{ padding: theme.spacing(1) }}>
          <div dangerouslySetInnerHTML={{ __html: htmlIframe }} />
        </div>
      </Collapse>
    </BrowserPreview>
  );
}
export const ProjectSettingsInstallWidgetPath = (props: {
  server: Server;
  widgetPath?: string;
  setWidgetPath: (widgetPath: string | undefined) => void;
}) => {
  const pages = useSelector<ReduxState, Admin.Page[] | undefined>(state => state.conf.conf?.layout.pages, shallowEqual) || [];
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
      addressBar='website'
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
      label='Text size'
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
      label='Font'
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
    <ProjectSettingsInstallStatusConfigSelectColor
      label='Text color'
      selectedValue={props.config.color || ''}
      onChange={value => onChange('color', value || '')}
    />
  );
  const backgroundColor = (
    <ProjectSettingsInstallStatusConfigSelectColor
      label='Background color'
      selectedValue={(props.config.backgroundColor === 'transparent' || !props.config.backgroundColor) ? '' : props.config.backgroundColor}
      onChange={value => onChange('backgroundColor', value || 'transparent')}
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
      <p className={classes.statusConfigLine}> {color}{backgroundColor}</p>
      <p className={classes.statusConfigLine}> {fontSize}{fontWeight}</p>
      <p className={classes.statusConfigLine}> {fontFamily}{textTransform}</p>
      <p className={classes.statusConfigLine}>{justifyContent}{alignItems}</p>
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
      width={100}
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
export const ProjectSettingsInstallStatusConfigSelectColor = (props: {
  label?: string;
  selectedValue: string;
  onChange: (selectedValue: string) => void;
}) => {
  const theme = useTheme();
  return (
    <MyColorPicker
      style={{ margin: theme.spacing(1, 1) }}
      clearable
      preview
      placeholder='#FFF'
      label={props.label}
      value={props.selectedValue}
      onChange={color => props.onChange(color)}
      TextFieldProps={{
        variant: 'outlined',
        size: 'small',
        InputProps: {
          style: {
            width: 216,
          },
        },
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
      <Section
        title='Logo'
        preview={(
          <BrowserPreview server={props.server}>
            <ProjectSettingsBrandingPreview />
          </BrowserPreview>
        )}
        content={(
          <>
            <PropertyByPath server={props.server} editor={props.editor} path={['name']} />
            <PropertyByPath server={props.server} editor={props.editor} path={['logoUrl']} />
            <PropertyByPath server={props.server} editor={props.editor} path={['website']} />
          </>
        )}
      />
      <Section
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
                  showVoting: false,
                  showVotingCount: true,
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
            <PropertyByPath server={props.server} editor={props.editor} path={['style', 'palette', 'primary']} />
            <PropertyByPath server={props.server} editor={props.editor} path={['style', 'palette', 'darkMode']} />
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
    <ProjectSettingsBase title='Custom Domain' description={`Customize your portal's URL to either use ${windowIso.parentDomain} or your own custom domain.`}>
      <div className={classes.domainField}>
        <Typography variant='h6' component='div' className={classes.domainFieldText}>https://&nbsp;</Typography>
        <PropertyByPath overrideDescription='' server={props.server} editor={props.editor} path={['slug']} />
        <Typography variant='h6' component='div' className={classes.domainFieldText}>&nbsp;{`.${windowIso.parentDomain}`}</Typography>
      </div>
      <TourAnchor anchorId='settings-domain-custom' placement='top-start'>
        {(next, isActive, anchorRef) => (
          <div ref={anchorRef} className={classes.domainField}>
            <Typography variant='h6' component='div' className={classes.domainFieldText}>https://&nbsp;</Typography>
            <PropertyByPath overrideDescription='' server={props.server} editor={props.editor} path={['domain']} TextFieldProps={{ onKeyDown: next }} />
          </div>
        )}
      </TourAnchor>
      <TourAnchor anchorId='settings-domain-dns-info' placement='bottom'>
        <Typography variant='body1' component='div'>Ensure your DNS settings are configured with your domain set to CNAME sni.clearflask.com</Typography>
        <Typography variant='caption' component='div'>NOTE: First request to a custom domain always bypasses our global CDN, contact support if you need both.</Typography>
      </TourAnchor>
      <NeedHelpInviteTeammate server={props.server} />
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsUsers = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Onboarding'>
      <Section
        description='Make your portal private or choose how your users will log in / sign up.'
        preview={(
          <>
            <ProjectSettingsUsersOnboardingDemo server={props.server} editor={props.editor} />
          </>
        )}
        content={(
          <ProjectSettingsUsersOnboarding
            server={props.server}
            editor={props.editor}
          />
        )}
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsUsersOnboardingDemo = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const projectRef = useRef<Promise<Project> | undefined>();
  useEffect(() => {
    const setOnboarding = (demoEditor: ConfigEditor.Editor) => demoEditor.getPage(['users', 'onboarding']).setRaw(props.editor.getConfig().users.onboarding);
    var unsubscribe;
    projectRef.current = getProject(
      templater => setOnboarding(templater.editor)
    ).then(project => {
      unsubscribe = props.editor.subscribe(() => setOnboarding(project.editor));
      return project;
    });
    return () => unsubscribe?.();
  }, []);
  return !projectRef.current ? null : (
    <Demo
      type='column'
      demoProject={projectRef.current}
      initialSubPath='/embed/demo'
      demoFixedWidth={420}
      demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} server={project.server} />)}
    />
  );
}
export const ProjectSettingsUsersOnboarding = (props: Omit<React.ComponentProps<typeof ProjectSettingsUsersOnboardingInternal>, 'accountBasePlanId' | 'accountSubscriptionStatus'>) => {
  const accountBasePlanId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);
  const accountSubscriptionStatus = useSelector<ReduxStateAdmin, Admin.SubscriptionStatus | undefined>(state => state.account.account.account?.subscriptionStatus, shallowEqual);
  if (!accountBasePlanId || !accountSubscriptionStatus) return null;
  return (
    <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
      <ProjectSettingsUsersOnboardingInternal accountBasePlanId={accountBasePlanId} accountSubscriptionStatus={accountSubscriptionStatus} {...props} />
    </Provider>
  );
}
const ProjectSettingsUsersOnboardingInternal = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  accountBasePlanId: string;
  accountSubscriptionStatus: Admin.SubscriptionStatus;
  onPageClicked?: () => void;
  inviteMods?: string[];
  setInviteMods?: (inviteMods: string[]) => void;
}) => {
  const classes = useStyles();
  const history = useHistory();
  const visibility = useSelector<ReduxState, Admin.OnboardingVisibilityEnum | undefined>(state => state.conf.conf?.users.onboarding.visibility, shallowEqual);
  const anonymous = useSelector<ReduxState, Admin.AnonymousSignup | undefined>(state => state.conf.conf?.users.onboarding.notificationMethods.anonymous, shallowEqual);
  const browserPush = useSelector<ReduxState, boolean | undefined>(state => state.conf.conf?.users.onboarding.notificationMethods.browserPush, shallowEqual);
  const email = useSelector<ReduxState, Admin.EmailSignup | undefined>(state => state.conf.conf?.users.onboarding.notificationMethods.email, shallowEqual);
  const sso = useSelector<ReduxState, Admin.SsoSignup | undefined>(state => state.conf.conf?.users.onboarding.notificationMethods.sso, shallowEqual);
  const oauthNum = useSelector<ReduxState, number>(state => state.conf.conf?.users.onboarding.notificationMethods.oauth?.length || 0, shallowEqual);
  const website = useSelector<ReduxState, string | undefined>(state => state.conf.conf?.website, shallowEqual);
  const websiteWithoutProtocol = website?.replace(/^https?:\/\//, '');
  const allowedDomainsProp = props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'email', 'allowedDomains']) as ConfigEditor.ArrayProperty;
  const [allowedDomain, setAllowedDomain] = useDebounceProp<string>(
    (email?.allowedDomains?.[0] !== undefined ? email.allowedDomains[0] : websiteWithoutProtocol) || '',
    text => {
      if (!allowedDomainsProp.value) allowedDomainsProp.set(true);
      const allowedDomainProp = (!!allowedDomainsProp.childProperties?.length
        ? allowedDomainsProp.childProperties[0]
        : allowedDomainsProp.insert()) as ConfigEditor.StringProperty
      allowedDomainProp.set(text || '');
    }
  );

  var [inviteModsSubmitting, setInviteModsSubmitting] = useState<boolean | undefined>();
  var [inviteMods, setInviteMods] = useState<string[]>([]);
  const inviteModsControlled = props.setInviteMods !== undefined && props.inviteMods !== undefined;
  if (inviteModsControlled) {
    setInviteMods = props.setInviteMods! as any;
    inviteMods = props.inviteMods!;
  }
  const inviteModsLabels = inviteMods.map(email => ({ label: email, value: email }));

  const checkboxLabel = (primary: string, secondary: string,): React.ReactNode => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Typography variant='body1' component='p'>{primary}</Typography>
      <Typography variant='caption' component='p'>{secondary}</Typography>
    </div>
  );
  return (
    <Provider store={ServerAdmin.get().getStore()}>
      <UpgradeWrapper accountBasePlanId={props.accountBasePlanId} subscriptionStatus={props.accountSubscriptionStatus} propertyPath={['users', 'onboarding', 'visibility']}>
        <TourAnchor anchorId='settings-onboard-visibility' placement='bottom'>
          {(next, isActive, anchorRef) => (
            <ToggleButtonGroup
              ref={anchorRef}
              className={classes.usersVisibilityButtonGroup}
              size='large'
              exclusive
              value={visibility || ''}
              onChange={(e, val) => {
                const visibilityProp = (props.editor.getProperty(['users', 'onboarding', 'visibility']) as ConfigEditor.EnumProperty);
                if (val === 'Private' && visibilityProp.value !== Admin.OnboardingVisibilityEnum.Private) {
                  visibilityProp.set(Admin.OnboardingVisibilityEnum.Private);
                  (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'anonymous']) as ConfigEditor.ObjectProperty).set(undefined);
                  (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'browserPush']) as ConfigEditor.BooleanProperty).set(false);
                  (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'email']) as ConfigEditor.ObjectProperty).set(undefined);
                } else if (val === 'Public' && visibilityProp.value !== Admin.OnboardingVisibilityEnum.Public) {
                  visibilityProp.set(Admin.OnboardingVisibilityEnum.Public);
                  (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'email']) as ConfigEditor.ObjectProperty).set(undefined);
                }
                next();
                tourSetGuideState('visibility', TourDefinitionGuideState.Completed);
              }}
            >
              <ToggleButton value='Public' classes={{ label: classes.usersVisibilityButton }}>
                PUBLIC
                <Typography variant='caption' display='block'>Anyone can see</Typography>
              </ToggleButton>
              <ToggleButton value='Private' classes={{ label: classes.usersVisibilityButton }}>
                PRIVATE
                <Typography variant='caption' display='block'>Restricted access</Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </TourAnchor>
      </UpgradeWrapper>
      <TourAnchor anchorId='settings-onboard-methods' placement='top'>
        {(next, isActive, anchorRef) => (
          <div ref={anchorRef}>
            <FormControlLabel
              label={checkboxLabel('Single Sign-On', 'Allow users to authenticate seamlessly between your service and ClearFlask')}
              className={classes.usersOnboardOption}
              control={(
                <Checkbox
                  color='primary'
                  checked={!!sso}
                  onChange={e => {
                    if (sso) {
                      (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'sso']) as ConfigEditor.ObjectProperty).set(undefined);
                    } else {
                      history.push(`/dashboard/settings/project/onboard/sso`);
                      props.onPageClicked?.();
                    }
                    next();
                    tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                  }}
                />
              )}
            />
            <FormControlLabel
              label={checkboxLabel('OAuth', visibility === Admin.OnboardingVisibilityEnum.Public
                ? 'Authenticate from an external service such as Facebook, Google or GitHub'
                : 'Authenticate from your OAuth-compatible service')}
              className={classes.usersOnboardOption}
              control={(
                <Checkbox
                  color='primary'
                  checked={!!oauthNum}
                  onChange={e => {
                    if (oauthNum) {
                      const oauthProp = props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'oauth']) as ConfigEditor.ArrayProperty;
                      for (var i = 0; i < oauthNum; i++) {
                        oauthProp.delete(0);
                      }
                    } else {
                      history.push(`/dashboard/settings/project/onboard/oauth`);
                      props.onPageClicked?.();
                    }
                    next();
                    tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                  }}
                />
              )}
            />
            <Collapse mountOnEnter in={visibility === Admin.OnboardingVisibilityEnum.Private} classes={{ wrapperInner: classes.usersOnboardOptions }}>
              <FormControlLabel
                label={(
                  <span className={classes.usersInlineTextField}>
                    Email from&nbsp;
                    <TextField
                      style={{ width: 140 }}
                      placeholder='company.com'
                      required
                      disabled={!email}
                      error={!!email && !allowedDomain}
                      value={allowedDomain}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position='start'>
                            <EmailAtIcon fontSize='inherit' />
                          </InputAdornment>
                        ),
                      }}
                      onChange={e => {
                        setAllowedDomain(e.target.value || '');
                        next();
                        tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                      }}
                    />
                  </span>
                )}
                className={classes.usersOnboardOption}
                control={(
                  <Checkbox
                    color='primary'
                    checked={!!email?.allowedDomains}
                    indeterminate={!!email && !email.allowedDomains}
                    onChange={e => {
                      (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'email']) as ConfigEditor.ObjectProperty).setRaw(!email?.allowedDomains
                        ? Admin.EmailSignupToJSON({
                          mode: Admin.EmailSignupModeEnum.SignupAndLogin,
                          password: Admin.EmailSignupPasswordEnum.None,
                          verification: Admin.EmailSignupVerificationEnum.None,
                          allowedDomains: [allowedDomain],
                        }) : undefined);
                      next();
                      tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                    }}
                  />
                )}
              />
              <div className={classNames(classes.usersOnboardOption, classes.usersInlineTextField)}>
                <Typography variant='body1' component='span'>Invite moderators by email</Typography>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                  <SelectionPicker
                    style={{
                      flexGrow: 1,
                    }}
                    TextFieldProps={{
                      variant: 'outlined',
                      size: 'small',
                      fullWidth: true,
                    }}
                    disabled={inviteModsSubmitting}
                    showTags
                    limitTags={1}
                    isMulti
                    placeholder={`joe@${websiteWithoutProtocol || 'xyz.com'}`}
                    value={inviteModsLabels}
                    options={inviteModsLabels}
                    onValueCreate={email => setInviteMods([...inviteMods, email])}
                    onValueChange={labels => setInviteMods([...(labels.map(l => l.value))])}
                  />
                  {!inviteModsControlled && (
                    <SubmitButton
                      aria-label='Invite'
                      color='primary'
                      style={{ visibility: !inviteModsLabels.length ? 'hidden' : undefined }}
                      isSubmitting={inviteModsSubmitting}
                      onClick={async () => {
                        setInviteModsSubmitting(true);
                        const d = await props.server.dispatchAdmin();
                        const inviteModsRemaining = new Set(inviteMods);
                        try {
                          for (const mod of inviteMods) {
                            d.userCreateAdmin({
                              projectId: props.server.getProjectId(),
                              userCreateAdmin: {
                                email: mod,
                              },
                            });
                            inviteModsRemaining.delete(mod);
                          }
                        } catch (e) { }
                        setInviteMods([...inviteModsRemaining]);
                        setInviteModsSubmitting(false);
                      }}
                    >Send</SubmitButton>
                  )}
                </div>
              </div>
            </Collapse>
            <Collapse mountOnEnter in={visibility === Admin.OnboardingVisibilityEnum.Public} classes={{ wrapperInner: classes.usersOnboardOptions }}>
              <FormControlLabel
                label={checkboxLabel('Guest', 'Allow users to sign up as a Guest. Hidden if Browser Push is available.')}
                className={classes.usersOnboardOption}
                control={(
                  <Checkbox
                    color='primary'
                    checked={!!anonymous}
                    onChange={e => {
                      (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'anonymous']) as ConfigEditor.ObjectProperty).setRaw(!anonymous
                        ? Admin.AnonymousSignupToJSON({ onlyShowIfPushNotAvailable: true }) : undefined);
                      next();
                      tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                    }}
                  />
                )}
              />
              <FormControlLabel
                label={checkboxLabel('Browser Push', 'Allow users to sign up by receiving push messages directly in their browser')}
                className={classes.usersOnboardOption}
                control={(
                  <Checkbox
                    color='primary'
                    checked={!!browserPush}
                    onChange={e => {
                      (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'browserPush']) as ConfigEditor.BooleanProperty).set(!browserPush);
                      next();
                      tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                    }}
                  />
                )}
              />
              <FormControlLabel
                label={checkboxLabel('Email', 'Allow users to sign up with their email')}
                className={classes.usersOnboardOption}
                control={(
                  <Checkbox
                    color='primary'
                    checked={!!email}
                    indeterminate={!!email?.allowedDomains}
                    onChange={e => {
                      (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'email']) as ConfigEditor.ObjectProperty).setRaw(!email
                        ? Admin.EmailSignupToJSON({
                          mode: Admin.EmailSignupModeEnum.SignupAndLogin,
                          password: Admin.EmailSignupPasswordEnum.None,
                          verification: Admin.EmailSignupVerificationEnum.None,
                        }) : undefined);
                      next();
                      tourSetGuideState('onboarding', TourDefinitionGuideState.Completed);
                    }}
                  />
                )}
              />
            </Collapse>
          </div>
        )}
      </TourAnchor>
    </Provider>
  );
}
export const ProjectSettingsUsersSso = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Single Sign-On'>
      <Section
        description={(
          <>
            {'Enabling SSO takes a bit of work and requires you to make changes on your webserver. Read our '}
            <MuiLink
              underline='none'
              color='primary'
              target="_blank"
              href='https://product.clearflask.com/post/how-to-setup-single-signon-uv5'
            >documentation</MuiLink>
            {' before you continue.'}
          </>
        )}
        preview={(
          <>
            <ProjectSettingsUsersOnboardingDemo server={props.server} editor={props.editor} />
          </>
        )}
        content={(
          <PropertyByPath
            server={props.server}
            overrideName=''
            editor={props.editor}
            path={['users', 'onboarding', 'notificationMethods', 'sso']}
          />
        )}
      />
      <NeedHelpInviteTeammate server={props.server} />
    </ProjectSettingsBase>
  );
}
const OauthPrefilled: {
  [provider: string]: {
    authorizeUrl?: string;
    tokenUrl?: string;
    scope?: string;
    userProfileUrl?: string;
    guidJsonPath?: string;
    nameJsonPath?: string;
    emailUrl?: string;
    emailJsonPath?: string;
    icon?: string;
  }
} = {
  Google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://www.googleapis.com/oauth2/v4/token',
    scope: 'profile email',
    userProfileUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    guidJsonPath: 'id',
    nameJsonPath: 'name',
    emailJsonPath: 'email',
    icon: 'Google',
  },
  Github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'user:email',
    userProfileUrl: 'https://api.github.com/user',
    guidJsonPath: 'id',
    nameJsonPath: "['name','login']",
    emailUrl: 'https://api.github.com/user/emails',
    emailJsonPath: '[?(@.verified == true)][?(@.primary == true)].email',
    icon: 'GitHub',
  },
  Facebook: {
    authorizeUrl: 'https://www.facebook.com/v3.2/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/oauth/access_token',
    scope: 'public_profile email',
    userProfileUrl: 'https://graph.facebook.com/me?fields=name,email',
    guidJsonPath: 'id',
    nameJsonPath: 'name',
    emailJsonPath: 'email',
    icon: 'Facebook',
  },
  Gitlab: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scope: 'read_user',
    userProfileUrl: 'https://gitlab.com/api/v4/user',
    guidJsonPath: 'id',
    nameJsonPath: 'name',
    emailJsonPath: 'email',
    icon: 'Gitlab',
  },
  Discord: {
    authorizeUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    userProfileUrl: 'https://discord.com/api/users/@me',
    guidJsonPath: 'id',
    nameJsonPath: 'username',
    emailJsonPath: 'email',
    icon: 'Discord',
  },
  Twitch: {
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    scope: 'user:read:email',
    userProfileUrl: 'https://api.twitch.tv/helix/users',
    guidJsonPath: 'data[0].id',
    nameJsonPath: 'data[0].display_name',
    emailJsonPath: 'data[0].email',
    icon: 'Twitch',
  },
  Azure: {
    authorizeUrl: 'https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token',
    scope: 'User.Read',
    userProfileUrl: 'https://graph.microsoft.com/v1.0/me',
    guidJsonPath: 'id',
    nameJsonPath: 'displayName',
    emailJsonPath: 'mail',
    icon: 'Microsoft',
  },
};
export const ProjectSettingsUsersOauth = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  const accountBasePlanId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);
  const subscriptionStatus = useSelector<ReduxStateAdmin, Admin.SubscriptionStatus | undefined>(state => state.account.account.account?.subscriptionStatus, shallowEqual);
  const [expandedType, setExpandedType] = useState<'oauth' | undefined>();
  const [expandedIndex, setExpandedIndex] = useState<number | undefined>();
  const [newOauthType, setNewOauthType] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const [azureTenantId, setAzureTenantId] = useState<string>('');
  const config = props.server.getStore().getState().conf.conf;
  const projectLink = config ? getProjectLink(config) : undefined;
  return (
    <ProjectSettingsBase title='OAuth'>
      <Section
        description='Authenticate users to an OAuth2 compatible service provider such as Facebook, Google or GitHub.'
        preview={(
          <>
            <ProjectSettingsUsersOnboardingDemo server={props.server} editor={props.editor} />
          </>
        )}
        content={(
          <UpgradeWrapper accountBasePlanId={accountBasePlanId} subscriptionStatus={subscriptionStatus} propertyPath={['users', 'onboarding', 'notificationMethods', 'oauth']}>
            <div className={classes.feedbackAccordionContainer}>
              {props.editor.getConfig().users.onboarding.notificationMethods.oauth.map((oauth, oauthIndex) => (
                <ProjectSettingsUsersOauthItem
                  server={props.server}
                  editor={props.editor}
                  oauth={oauth}
                  oauthIndex={oauthIndex}
                  expanded={expandedType === 'oauth' && expandedIndex === oauthIndex}
                  onExpandedChange={() => {
                    if (expandedType === 'oauth' && expandedIndex === oauthIndex) {
                      setExpandedIndex(undefined)
                    } else {
                      setExpandedType('oauth');
                      setExpandedIndex(oauthIndex)
                    }
                  }}
                />
              ))}
            </div>
            <FormControl
              variant='outlined'
              size='small'
              className={classes.usersOauthAddProp}
            >
              <InputLabel>Add new provider</InputLabel>
              <Select
                label='Add new provider'
                value={newOauthType}
                onChange={e => setNewOauthType((e.target.value as string) || 'Custom')}
                classes={{
                  select: classes.usersOauthAddSelectItem,
                }}
              >
                <MenuItem value='Google'><GoogleIcon />&nbsp;&nbsp;&nbsp;Google</MenuItem>
                <MenuItem value='Github'><GithubIcon />&nbsp;&nbsp;&nbsp;Github</MenuItem>
                <MenuItem value='Facebook'><FacebookIcon />&nbsp;&nbsp;&nbsp;Facebook</MenuItem>
                <MenuItem value='Gitlab'><GitlabIcon />&nbsp;&nbsp;&nbsp;Gitlab</MenuItem>
                <MenuItem value='Discord'><DiscordIcon />&nbsp;&nbsp;&nbsp;Discord</MenuItem>
                <MenuItem value='Twitch'><TwitchIcon />&nbsp;&nbsp;&nbsp;Twitch</MenuItem>
                <MenuItem value='Azure'><MicrosoftIcon />&nbsp;&nbsp;&nbsp;Azure</MenuItem>
                <MenuItem value='Custom'><CustomIcon />&nbsp;&nbsp;&nbsp;Other</MenuItem>
              </Select>
            </FormControl>
            <Collapse mountOnEnter in={newOauthType === 'Custom'} >
              <p>To setup OAuth, you need to register first. If you are having trouble filling out all the fields, please contact support.</p>
              <p>You may be asked to provide a <b>Redirect URL</b> for security measures:</p>
              {projectLink && (
                <pre>{projectLink + '/oauth'}</pre>
              )}
            </Collapse>
            <Collapse mountOnEnter in={!!newOauthType && newOauthType !== 'Custom'} >
              <p>To setup OAuth for {newOauthType}, you need to register to obtain a <b>Client ID</b> and <b>Client Secret</b>.</p>
              <p>You will be asked to provide a <b>Redirect URL</b> for security measures:</p>
              {projectLink && (
                <pre>{projectLink + '/oauth'}</pre>
              )}
              <Collapse mountOnEnter in={newOauthType === 'Google'}>Visit <MuiLink href="https://console.developers.google.com/apis/credentials/oauthclient" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Github'}>Visit <MuiLink href="https://github.com/settings/applications/new" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Facebook'}>Visit <MuiLink href="https://developers.facebook.com/apps" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Gitlab'}>Visit <MuiLink href="https://gitlab.com/oauth/applications" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Discord'}>Visit <MuiLink href="https://discordapp.com/developers/applications" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Twitch'}>Visit <MuiLink href="https://glass.twitch.tv/console/apps/create" rel="noreferrer noopener" target="_blank">here</MuiLink> to get started.</Collapse>
              <Collapse mountOnEnter in={newOauthType === 'Azure'}>Visit <MuiLink href="https://portal.azure.com/" rel="noreferrer noopener" target="_blank">here</MuiLink> -&gt; "Azure Active Directory" -&gt; "App Registrations" to get started.</Collapse>
              <p>Once you are done, fill these out:</p>
              <TextField
                className={classes.usersOauthAddProp}
                size='small'
                variant='outlined'
                label='Client ID'
                value={clientId}
                onChange={e => setClientId(e.target.value)}
              />
              <TextField
                className={classes.usersOauthAddProp}
                size='small'
                variant='outlined'
                label='Client secret'
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
              />
              <Collapse mountOnEnter in={newOauthType === 'Azure'}>
                <TextField
                  className={classes.usersOauthAddProp}
                  size='small'
                  variant='outlined'
                  label='Tenant ID'
                  value={azureTenantId}
                  onChange={e => setAzureTenantId(e.target.value)}
                />
              </Collapse>
            </Collapse>
            <Collapse mountOnEnter in={!!newOauthType} >
              <Button
                className={classes.usersOauthAddAddButton}
                variant='contained'
                color='primary'
                disableElevation
                disabled={!newOauthType || (newOauthType !== 'Custom' && (!clientId || !clientSecret))}
                onClick={() => {
                  setExpandedType('oauth');
                  setExpandedIndex(config?.users.onboarding.notificationMethods.oauth.length)

                  const oauthId = randomUuid();
                  ((props.editor.getProperty(['oauthClientSecrets']) as ConfigEditor.DictProperty)
                    .put(oauthId) as ConfigEditor.StringProperty).set(clientSecret);
                  var { authorizeUrl, tokenUrl, scope, userProfileUrl, guidJsonPath, nameJsonPath, emailUrl, emailJsonPath, icon } = OauthPrefilled[newOauthType] || {};
                  if (newOauthType === 'Azure') {
                    if (azureTenantId) authorizeUrl = authorizeUrl?.replace('<tenant-id>', azureTenantId);
                    if (azureTenantId) tokenUrl = tokenUrl?.replace('<tenant-id>', azureTenantId);
                  }
                  ((props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'oauth']) as ConfigEditor.ArrayProperty)
                    .insert() as ConfigEditor.ObjectProperty).setRaw(Admin.NotificationMethodsOauthToJSON({
                      oauthId,
                      buttonTitle: newOauthType === 'Custom' ? 'My provider' : newOauthType,
                      clientId,
                      authorizeUrl: authorizeUrl || '',
                      tokenUrl: tokenUrl || '',
                      scope: scope || '',
                      userProfileUrl: userProfileUrl || '',
                      guidJsonPath: guidJsonPath || '',
                      nameJsonPath,
                      emailUrl: emailUrl || '',
                      emailJsonPath,
                      icon,
                    }));

                  setNewOauthType('');
                  setClientId('');
                  setClientSecret('');
                  setAzureTenantId('');
                }}
              >
                Add
              </Button>
            </Collapse>
          </UpgradeWrapper>
        )}
      />
      <NeedHelpInviteTeammate server={props.server} />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsUsersOauthItem = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  oauth: Admin.NotificationMethodsOauth;
  oauthIndex: number;
  expanded: boolean;
  onExpandedChange: () => void;
}) => {
  const classes = useStyles();
  return (
    <MyAccordion
      key={props.oauth.oauthId}
      TransitionProps={{ unmountOnExit: true }}
      expanded={props.expanded}
      onChange={() => props.onExpandedChange()}
      name={(
        <PropertyShowOrEdit
          allowEdit={props.expanded}
          show={(
            <div className={classes.usersOauthAddSelectItem}>
              {!!props.oauth.icon && (<DynamicMuiIcon name={props.oauth.icon} />)}
              &nbsp;&nbsp;&nbsp;
              {props.oauth.buttonTitle}
            </div>
          )}
          edit={(
            <PropertyByPath
              server={props.server}
              marginTop={0}
              overrideName='Button title'
              overrideDescription=''
              editor={props.editor}
              path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'buttonTitle']}
            />
          )}
        />
      )}
    >
      <PropertyByPath server={props.server} overrideName='Button Icon' overrideDescription='' editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'icon']} />
      <IconPickerHelperText />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'clientId']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['oauthClientSecrets', props.oauth.oauthId]} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'authorizeUrl']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'tokenUrl']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'scope']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'userProfileUrl']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'guidJsonPath']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'nameJsonPath']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'emailUrl']} />
      <PropertyByPath server={props.server} editor={props.editor} path={['users', 'onboarding', 'notificationMethods', 'oauth', props.oauthIndex, 'emailJsonPath']} />
      <Button
        color='inherit'
        style={{ color: 'darkred', alignSelf: 'flex-end' }}
        onClick={() => {
          (props.editor.getProperty(['users', 'onboarding', 'notificationMethods', 'oauth']) as ConfigEditor.ArrayProperty)
            .delete(props.oauthIndex);
        }}
      >Delete</Button>
    </MyAccordion>
  );
};

export const ProjectSettingsLanding = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  const [expandedType, setExpandedType] = useState<'link' | undefined>();
  const [expandedIndex, setExpandedIndex] = useState<number | undefined>();
  return (
    <ProjectSettingsBase title='Landing'>
      <TemplateWrapper<LandingInstance | undefined>
        key='landing'
        editor={props.editor}
        mapper={templater => templater.landingGet()}
        renderResolved={(templater, landing) => (
          <>
            <Typography variant='body1' component='div'>Show a dedicated welcome page for your visitors</Typography>
            <FormControlLabel
              label={!!landing ? 'Enabled' : 'Disabled'}
              control={(
                <Switch
                  checked={!!landing}
                  onChange={(e, checked) => !!landing
                    ? templater.landingOff(landing)
                    : templater.landingOn()}
                  color='primary'
                />
              )}
            />
            {landing && (
              <>
                <BrowserPreview
                  server={props.server}
                  scroll={Orientation.Both}
                  addressBar='project'
                  projectPath={landing.pageAndIndex.page.slug}
                  forceBreakpoint='xs'
                  FakeBrowserProps={{
                    fixedWidth: 650,
                  }}
                >
                  <AppDynamicPage
                    key={props.server.getProjectId()}
                    server={props.server}
                    pageSlug={landing.pageAndIndex.page.slug}
                    landingLinkOpenInNew
                  />
                </BrowserPreview>
                <Section
                  title='Welcome message'
                  description='Decide on a welcome message for your users'
                  preview={(
                    <>
                      {(!!landing.pageAndIndex.page.title || !!landing.pageAndIndex.page.description) && (
                        <BrowserPreview
                          server={props.server}
                          scroll={Orientation.Both}
                          addressBar='project'
                          projectPath={landing.pageAndIndex.page.slug}
                          FakeBrowserProps={{
                            fixedWidth: 350,
                          }}
                        >
                          <div className={classNames(classes.previewPageTitleDescription, classes.maxContent)}>
                            <PageTitleDescription page={landing.pageAndIndex.page} suppressSpacing />
                          </div>
                        </BrowserPreview>
                      )}
                    </>
                  )}
                  content={(
                    <>
                      <PropertyByPath
                        server={props.server}
                        overrideName='Title'
                        overrideDescription=''
                        editor={props.editor}
                        path={['layout', 'pages', landing.pageAndIndex.index, 'title']}
                      />
                      <PropertyByPath
                        server={props.server}
                        overrideName='Description'
                        overrideDescription=''
                        editor={props.editor}
                        path={['layout', 'pages', landing.pageAndIndex.index, 'description']}
                      />
                    </>
                  )}
                />
                <Section
                  title='Links'
                  description='Modify the landing page links to point to your roadmap, feedback or your support email.'
                  preview={(
                    <>
                      {(expandedType === 'link' && expandedIndex !== undefined && (landing.pageAndIndex.page.landing?.links.length || -1) >= expandedIndex) && (
                        <BrowserPreview
                          server={props.server}
                          scroll={Orientation.Both}
                          addressBar='project'
                          projectPath={landing.pageAndIndex.page.slug}
                          FakeBrowserProps={{
                            fixedWidth: 350,
                            fixedHeight: 400,
                          }}
                        >
                          <div className={classNames(classes.previewLandingLink, classes.maxContent)}>
                            <LandingLink
                              server={props.server}
                              config={props.editor.getConfig()}
                              link={landing.pageAndIndex.page.landing?.links[expandedIndex]}
                              openInNew
                            />
                          </div>
                        </BrowserPreview>
                      )}
                    </>
                  )}
                  content={(
                    <>
                      <div className={classes.feedbackAccordionContainer}>
                        {props.editor.getConfig().layout.pages[landing.pageAndIndex.index]?.landing?.links.map((link, linkIndex) => (
                          <ProjectSettingsLandingLink
                            server={props.server}
                            editor={props.editor}
                            templater={templater}
                            landing={landing}
                            link={link}
                            linkIndex={linkIndex}
                            expanded={expandedType === 'link' && expandedIndex === linkIndex}
                            onExpandedChange={() => {
                              if (expandedType === 'link' && expandedIndex === linkIndex) {
                                setExpandedIndex(undefined)
                              } else {
                                setExpandedType('link');
                                setExpandedIndex(linkIndex)
                              }
                            }}
                          />
                        ))}
                      </div>
                      <ProjectSettingsAddWithName
                        label='New link'
                        placeholder='Title'
                        noMargin
                        onAdd={newLink => {
                          setExpandedType('link');
                          setExpandedIndex(landing.pageAndIndex.page.landing?.links.length || 0);
                          ((props.editor.getProperty(['layout', 'pages', landing.pageAndIndex.index, 'landing', 'links']) as ConfigEditor.ArrayProperty)
                            .insert() as ConfigEditor.ObjectProperty).setRaw(Admin.LandingLinkToJSON({
                              title: newLink,
                              ...(props.editor.getConfig().website ? {
                                url: props.editor.getConfig().website,
                              } : (props.editor.getConfig().layout.pages.length ? {
                                linkToPageId: props.editor.getConfig().layout.pages[0]?.pageId,
                              } : {}))
                            }));
                        }}
                      />
                    </>
                  )}
                />
              </>
            )}
          </>
        )
        }
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsLandingLink = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  templater: Templater;
  landing: LandingInstance;
  link: Admin.LandingLink;
  linkIndex: number;
  expanded: boolean;
  onExpandedChange: () => void;
}) => {
  const classes = useStyles();
  const urlProp = (props.editor.getProperty(['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'url']) as ConfigEditor.StringProperty);
  const linkToPageIdProp = (props.editor.getProperty(['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'linkToPageId']) as ConfigEditor.LinkProperty);
  const iconProp = (props.editor.getProperty(['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'icon']) as ConfigEditor.StringProperty);
  const [link, setLink] = useDebounceProp<Pick<Admin.LandingLink, 'url' | 'linkToPageId' | 'icon'>>(
    props.link,
    link => {
      urlProp.set(link.url);
      linkToPageIdProp.set(link.linkToPageId);
      iconProp.set(link.icon || undefined);
    });
  const [linkType, setLinkType] = useState<'page' | 'url' | 'email'>(!!link.url
    ? (link.url.startsWith('mailto://') ? 'email' : 'url')
    : 'page');
  return (
    <MyAccordion
      key={props.link.linkToPageId || props.link.url}
      TransitionProps={{ unmountOnExit: true }}
      expanded={props.expanded}
      onChange={() => props.onExpandedChange()}
      name={(
        <PropertyShowOrEdit
          allowEdit={props.expanded}
          show={props.link.title}
          edit={(
            <PropertyByPath
              server={props.server}
              marginTop={0}
              overrideName='Title'
              overrideDescription=''
              editor={props.editor}
              path={['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'title']}
            />
          )}
        />
      )}
    >
      <PropertyByPath
        server={props.server}
        marginTop={0}
        overrideName='Description'
        overrideDescription=''
        editor={props.editor}
        path={['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'description']}
      />
      <div className={classes.landingLinkContainer}>
        <FormControl
          variant='outlined'
          size='small'
        >
          <Select
            className={classes.landingLinkTypeSelect}
            value={linkType}
            onChange={e => {
              switch (e.target.value) {
                case 'page':
                  setLink({ linkToPageId: props.editor.getConfig().layout.pages.find(p => !p.landing)?.pageId })
                  setLinkType('page')
                  break;
                case 'email':
                  setLink({
                    icon: 'AlternateEmail',
                    url: props.editor.getConfig().website ? `mailto://support@${props.editor.getConfig().website!.replace(/^https?:\/\//, '')}` : ''
                  })
                  setLinkType('email')
                  break;
                case 'url':
                  setLink({ url: props.editor.getConfig().website || '' })
                  setLinkType('url')
                  break;
              }
            }}
          >
            <MenuItem value='page'>Page</MenuItem>
            <MenuItem value='url'>URL</MenuItem>
            <MenuItem value='email'>Email</MenuItem>
          </Select>
        </FormControl>
        {linkType === 'page' ? (
          <PropertyByPath
            server={props.server}
            marginTop={0}
            overrideName=''
            overrideDescription=''
            editor={props.editor}
            path={['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'linkToPageId']}
            TextFieldProps={{
              InputProps: {
                classes: {
                  root: classNames(classes.landingLinkTextfield, classes.landingLinkPageTextfield),
                }
              },
            }}
            width={164}
            inputMinWidth={164}
            SelectionPickerProps={{
              disableInput: true,
              disableClearable: true,
            }}
          />
        ) : (
          <TextField
            size='small'
            variant='outlined'
            value={linkType === 'url' ? link.url : link.url?.replace(/^mailto:\/\//, '')}
            placeholder={linkType === 'url' ? 'https://' : 'support@example.com'}
            onChange={e => setLink({
              url: linkType === 'url' ? e.target.value || '' : `mailto://${e.target.value || ''}`
            })}
            InputProps={{
              style: {
                maxWidth: 164,
                width: 164,
              },
              classes: {
                root: classes.landingLinkTextfield,
              },
            }}
          />
        )}
      </div>
      <PropertyByPath
        server={props.server}
        marginTop={16}
        overrideName='Override Icon'
        overrideDescription=''
        editor={props.editor}
        path={['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links', props.linkIndex, 'icon']}
      />
      <IconPickerHelperText />
      <Button
        color='inherit'
        style={{ color: 'darkred', alignSelf: 'flex-end' }}
        onClick={() => {
          (props.editor.getProperty(['layout', 'pages', props.landing.pageAndIndex.index, 'landing', 'links']) as ConfigEditor.ArrayProperty)
            .delete(props.linkIndex);
        }}
      >Delete</Button>
    </MyAccordion>
  );
}

export const ProjectSettingsFeedback = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  const [expandedType, setExpandedType] = useState<'tag' | 'status' | undefined>();
  const [expandedIndex, setExpandedIndex] = useState<number | undefined>();
  const intro = (
    <Typography variant='body1' component='div'>Collect useful feedback from your users</Typography>
  );
  return (
    <ProjectSettingsBase title='Feedback'>
      <TemplateWrapper<FeedbackInstance | undefined>
        key='feedback'
        editor={props.editor}
        mapper={templater => templater.feedbackGet()}
        renderResolved={(templater, feedback) => {
          return !feedback ? (
            <>
              {intro}
              <Button
                className={classes.createTemplateButton}
                variant='contained'
                color='primary'
                disableElevation
                onClick={() => templater.feedbackOn('feedback')}
              >
                Create feedback
              </Button>
            </>
          ) : (
            <>
              {intro}
              <Section
                title='Public feedback page'
                description={(
                  <>
                    Customize your public page for collecting feedback.
                    <p>The <b>Feedback Form</b> is recommended as it focuses on capturing user feedback first and showing other feedback later.</p>
                    <p>Whereas the <b>Classic Explorer</b> allows all users to search and filter others' feedback immediately.</p>
                  </>
                )}
                preview={(
                  <>
                    {!!feedback.pageAndIndex && (
                      <BrowserPreview
                        server={props.server}
                        scroll={Orientation.Both}
                        addressBar='project'
                        projectPath={feedback.pageAndIndex.page.slug}
                        FakeBrowserProps={{
                          fixedWidth: 700,
                          fixedHeight: 700,
                        }}
                      >
                        <AppDynamicPage
                          key={props.server.getProjectId()}
                          server={props.server}
                          pageSlug={feedback.pageAndIndex.page.slug}
                          ideaExplorerCreateFormAdminControlsDefaultVisibility='none'
                        />
                      </BrowserPreview>
                    )}
                  </>
                )}
                content={(
                  <>
                    <FilterControlSelect
                      type='radio'
                      labels={[
                        { label: 'Feedback Form', value: 'feedback' },
                        { label: 'Classic Explorer', value: 'explorer' },
                        { label: 'Off', value: 'off' },
                      ]}
                      selected={(!feedback.pageAndIndex?.page.explorer && !feedback.pageAndIndex?.page.feedback)
                        ? 'off'
                        : (feedback.pageAndIndex.page.feedback ? 'feedback' : 'explorer')}
                      onToggle={(val) => {
                        if (val === 'off'
                          || val === 'feedback'
                          || val === 'explorer') {
                          templater.feedbackOn(val);
                        }
                      }}
                    />
                    {!!feedback.pageAndIndex && (
                      <>
                        <PropertyByPath server={props.server} overrideDescription='' editor={props.editor} path={['layout', 'pages', feedback.pageAndIndex.index, 'title']} />
                        <PropertyByPath server={props.server} overrideDescription='' editor={props.editor} path={['layout', 'pages', feedback.pageAndIndex.index, 'description']} />
                        {!!feedback.pageAndIndex.page.explorer?.allowCreate && (
                          <>
                            <PropertyByPath server={props.server} overrideDescription='' editor={props.editor} path={['layout', 'pages', feedback.pageAndIndex.index, 'explorer', 'allowCreate', 'actionTitle']} />
                            <PropertyByPath server={props.server} overrideDescription='' editor={props.editor} path={['layout', 'pages', feedback.pageAndIndex.index, 'explorer', 'allowCreate', 'actionTitleLong']} />
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              />
              <Section
                title='Workflow'
                description='Define how you will handle incoming feedback and keep track of progress using custom statuses.'
                preview={!!feedback.categoryAndIndex.category.workflow.statuses.length && (
                  <WorkflowPreview
                    editor={props.editor}
                    categoryIndex={feedback.categoryAndIndex.index}
                    hideCorner
                    // static
                    isVertical
                    width={350}
                    height={500}
                    border
                  // scroll
                  />
                )}
                content={(
                  <>
                    <div className={classes.feedbackAccordionContainer}>
                      {feedback.categoryAndIndex.category.workflow.statuses.map((status, statusIndex) => (
                        <ProjectSettingsFeedbackStatus
                          server={props.server}
                          editor={props.editor}
                          feedback={feedback}
                          status={status}
                          statusIndex={statusIndex}
                          expanded={expandedType === 'status' && expandedIndex === statusIndex}
                          onExpandedChange={() => {
                            if (expandedType === 'status' && expandedIndex === statusIndex) {
                              setExpandedIndex(undefined)
                            } else {
                              setExpandedType('status');
                              setExpandedIndex(statusIndex)
                            }
                          }}
                        />
                      ))}
                    </div>
                    <ProjectSettingsAddWithName
                      label='New status'
                      placeholder='ex: In progress'
                      noMargin
                      onAdd={name => {
                        setExpandedType('status');
                        setExpandedIndex(feedback.categoryAndIndex.category.workflow.statuses.length)
                        props.editor.getPageGroup(['content', 'categories', feedback.categoryAndIndex.index, 'workflow', 'statuses'])
                          .insert()
                          .setRaw(Admin.IdeaStatusToJSON({
                            statusId: randomUuid(),
                            name: name,
                            disableFunding: false,
                            disableVoting: false,
                            disableExpressions: false,
                            disableIdeaEdits: false,
                            disableComments: false,
                          }));
                      }}
                    />
                  </>
                )}
              />
              <ProjectSettingsSectionTagging
                title='Tagging'
                description='Although discouraged, you can ask users to tag feedback before submitting. It is recommended that you apply tags yourself when you sort through Feedback and organize into Tasks.'
                server={props.server}
                editor={props.editor}
                categoryAndIndex={feedback.categoryAndIndex}
                userCreatable={true}
                expandedIndex={expandedType === 'tag' ? expandedIndex : undefined}
                onExpandedChange={(index) => {
                  if (expandedType === 'tag' && expandedIndex === index) {
                    setExpandedIndex(undefined)
                  } else {
                    setExpandedType('tag');
                    setExpandedIndex(index)
                  }
                }}
              />
            </>
          );
        }}
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsFeedbackStatus = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  feedback: FeedbackInstance;
  status: Admin.IdeaStatus;
  statusIndex: number;
  expanded: boolean;
  onExpandedChange: () => void;
}) => {
  const initialStatusIdProp = (props.editor.getProperty(['content', 'categories', props.feedback.categoryAndIndex.index, 'workflow', 'entryStatus']) as ConfigEditor.StringProperty);
  const nameProp = (props.editor.getProperty(['content', 'categories', props.feedback.categoryAndIndex.index, 'workflow', 'statuses', props.statusIndex, 'name']) as ConfigEditor.StringProperty);
  const colorProp = (props.editor.getProperty(['content', 'categories', props.feedback.categoryAndIndex.index, 'workflow', 'statuses', props.statusIndex, 'color']) as ConfigEditor.StringProperty);
  const [statusName, setStatusName] = useDebounceProp<string>(
    nameProp.value || '',
    text => nameProp.set(text));
  const [statusColor, setStatusColor] = useDebounceProp<string>(
    colorProp.value || '',
    text => colorProp.set(text));
  return (
    <MyAccordion
      key={props.status.statusId}
      TransitionProps={{ unmountOnExit: true }}
      expanded={props.expanded}
      onChange={() => props.onExpandedChange()}
      name={(
        <PropertyShowOrEdit
          allowEdit={props.expanded}
          show={(
            <span style={{ color: props.status.color }}>
              {props.status.name}
            </span>
          )}
          edit={(
            <TextFieldWithColorPicker
              label='Status Name'
              variant='outlined'
              size='small'
              textValue={statusName}
              onTextChange={text => setStatusName(text)}
              colorValue={statusColor}
              onColorChange={color => setStatusColor(color)}
              TextFieldProps={{
                InputProps: {
                  style: {
                    minWidth: Property.inputMinWidth,
                    width: propertyWidth,
                  },
                }
              }}
            />
          )}
        />
      )}
    >
      <FormControlLabel label='Default status' control={(
        <Checkbox size='small' color='primary'
          checked={initialStatusIdProp.value === props.status.statusId}
          disabled={initialStatusIdProp.value === props.status.statusId}
          onChange={e => initialStatusIdProp.set(props.status.statusId)}
        />
      )} />
      <PropertyByPath
        server={props.server}
        marginTop={16}
        overrideName='Next statuses'
        overrideDescription=''
        editor={props.editor}
        path={['content', 'categories', props.feedback.categoryAndIndex.index, 'workflow', 'statuses', props.statusIndex, 'nextStatusIds']}
      />
    </MyAccordion>
  );
}
export const ProjectSettingsSectionTagging = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  title?: React.ReactNode;
  description?: React.ReactNode;
  categoryAndIndex: CategoryAndIndex;
  userCreatable: boolean;
  expandedIndex?: number;
  onExpandedChange: (index: number) => void;
}) => {
  const classes = useStyles();
  const [tagIds, setTagIds] = useState<Array<string> | undefined>();
  return (
    <Section
      title={props.title}
      description={props.description}
      preview={(
        <TagSelect
          className={classes.tagPreviewContainer}
          wrapper={children => (
            <BrowserPreview server={props.server}>{children}</BrowserPreview>
          )}
          variant='outlined'
          size='small'
          label='Try selecting tags'
          category={props.categoryAndIndex.category}
          tagIds={tagIds}
          isModOrAdminLoggedIn={!props.userCreatable}
          onChange={(tagIds, errorStr) => setTagIds(tagIds)}
          SelectionPickerProps={{
            width: undefined,
          }}
        />
      )}
      content={(
        <>
          <div className={classes.feedbackAccordionContainer}>
            {props.categoryAndIndex.category.tagging.tagGroups
              .map((tagGroup, tagGroupIndex) => (
                <ProjectSettingsTagGroup
                  server={props.server}
                  editor={props.editor}
                  categoryAndIndex={props.categoryAndIndex}
                  userCreatable={props.userCreatable}
                  tagGroup={tagGroup}
                  tagGroupIndex={tagGroupIndex}
                  expanded={props.expandedIndex === tagGroupIndex}
                  onExpandedChange={() => props.onExpandedChange(tagGroupIndex)}
                />
              ))}
          </div>
          <ProjectSettingsAddWithName
            label='New tag group'
            placeholder='ex: Platform'
            noMargin
            onAdd={newTagGroup => {
              props.onExpandedChange(props.categoryAndIndex.category.tagging.tagGroups.length);
              props.editor.getPageGroup(['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups'])
                .insert()
                .setRaw(Admin.TagGroupToJSON({
                  name: newTagGroup,
                  tagGroupId: randomUuid(),
                  userSettable: true,
                  tagIds: [],
                }));
            }}
          />
        </>
      )}
    />
  );
}
export const ProjectSettingsTagGroup = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  categoryAndIndex: CategoryAndIndex;
  userCreatable: boolean;
  tagGroup: Admin.TagGroup;
  tagGroupIndex: number;
  expanded: boolean;
  onExpandedChange: () => void;
}) => {
  const classes = useStyles();
  const [minRequired, setMinRequired] = useState<number | undefined>(props.tagGroup.minRequired);
  const [maxRequired, setMaxRequired] = useState<number | undefined>(props.tagGroup.maxRequired);
  const tagsWithIndexes = props.categoryAndIndex.category.tagging.tags
    .map((tag, index) => ({ tag, index }));
  return (
    <MyAccordion
      key={props.tagGroup.tagGroupId}
      TransitionProps={{ unmountOnExit: true }}
      expanded={props.expanded}
      onChange={() => props.onExpandedChange()}
      name={(
        <PropertyShowOrEdit
          allowEdit={props.expanded}
          show={props.tagGroup.name}
          edit={(
            <PropertyByPath
              server={props.server}
              marginTop={0}
              overrideName='Tag Group Name'
              overrideDescription=''
              editor={props.editor}
              path={['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups', props.tagGroupIndex, 'name']}
            />
          )}
        />
      )}
    >
      <div className={classes.feedbackTagGroupProperty}>
        <PropertyByPath
          server={props.server}
          marginTop={0}
          overrideName='User settable'
          editor={props.editor}
          path={['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups', props.tagGroupIndex, 'userSettable']}
        />
      </div>
      <Collapse mountOnEnter in={props.tagGroup.tagIds.length > 1}>
        <div className={classes.feedbackTagGroupProperty}>
          <FormLabel>Number of required tags</FormLabel>
          <Slider
            marks
            valueLabelDisplay='auto'
            value={[
              minRequired !== undefined ? minRequired : 0,
              maxRequired !== undefined ? maxRequired : props.tagGroup.tagIds.length,
            ]}
            min={0}
            max={props.tagGroup.tagIds.length}
            onChange={(e, value) => {
              const min = Math.min(value[0], value[1]);
              const max = Math.max(value[0], value[1]);
              setMinRequired(min);
              setMaxRequired(max);
            }}
            onChangeCommitted={(e, value) => {
              const min = Math.min(value[0], value[1]);
              const max = Math.max(value[0], value[1]);
              setTimeout(() => {
                (props.editor.getProperty(['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups', props.tagGroupIndex, 'minRequired']) as ConfigEditor.IntegerProperty)
                  .set(min === 0 ? undefined : min);
                (props.editor.getProperty(['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups', props.tagGroupIndex, 'maxRequired']) as ConfigEditor.IntegerProperty)
                  .set(max === props.tagGroup.tagIds.length ? undefined : max);
              }, 10);
            }}
          />
        </div>
      </Collapse>
      {props.tagGroup.tagIds
        .map(tagId => tagsWithIndexes.find(t => t.tag.tagId === tagId))
        .filter(notEmpty)
        .map(tagWithIndex => (
          <Collapse mountOnEnter in={true} appear>
            <ProjectSettingsFeedbackTag
              server={props.server}
              editor={props.editor}
              categoryIndex={props.categoryAndIndex.index}
              tag={tagWithIndex.tag}
              tagIndex={tagWithIndex.index}
            />
          </Collapse>
        ))}
      <ProjectSettingsAddWithName
        key='New tag'
        label='New tag'
        placeholder='ex: Windows'
        onAdd={newTag => {
          const tagId = randomUuid();
          ((props.editor.getProperty(['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tags']) as ConfigEditor.ArrayProperty)
            .insert() as ConfigEditor.ObjectProperty)
            .setRaw(Admin.TagToJSON({
              tagId,
              name: newTag,
            }));
          (props.editor.getProperty(['content', 'categories', props.categoryAndIndex.index, 'tagging', 'tagGroups', props.tagGroupIndex, 'tagIds']) as ConfigEditor.LinkMultiProperty)
            .insert(tagId);
        }}
      />
    </MyAccordion>
  );
}
export const ProjectSettingsFeedbackTag = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  categoryIndex: number;
  tag: Admin.Tag;
  tagIndex: number;
}) => {
  const classes = useStyles();
  const nameProp = (props.editor.getProperty(['content', 'categories', props.categoryIndex, 'tagging', 'tags', props.tagIndex, 'name']) as ConfigEditor.StringProperty);
  const colorProp = (props.editor.getProperty(['content', 'categories', props.categoryIndex, 'tagging', 'tags', props.tagIndex, 'color']) as ConfigEditor.StringProperty);
  const [tagName, setTagName] = useDebounceProp<string>(
    nameProp.value || '',
    text => nameProp.set(text));
  const [tagColor, setTagColor] = useDebounceProp<string>(
    colorProp.value || '',
    text => colorProp.set(text));
  return (
    <TextFieldWithColorPicker
      className={classes.feedbackTag}
      label='Tag Name'
      variant='outlined'
      size='small'
      textValue={tagName}
      onTextChange={text => setTagName(text)}
      colorValue={tagColor}
      onColorChange={color => setTagColor(color)}
      TextFieldProps={{
        InputProps: {
          style: {
            minWidth: Property.inputMinWidth,
            width: propertyWidth,
          },
        },
      }}
    />
  );
}

export const ProjectSettingsAddWithName = (props: {
  className?: string;
  label: string;
  placeholder?: string;
  onAdd: (value: string) => void;
  noMargin?: boolean;
  TextFieldProps?: Partial<React.ComponentPropsWithRef<typeof TextField>>;
}) => {
  const classes = useStyles();
  const [value, setValue] = useState<string>();
  const [added, setAdded] = useState<boolean>(false);
  return (
    <TextField
      label={props.label}
      size='small'
      variant='outlined'
      placeholder={props.placeholder}
      value={value || ''}
      onChange={e => setValue(e.target.value)}
      {...props.TextFieldProps}
      className={classNames(
        props.TextFieldProps?.className,
        props.className,
        props.noMargin && classes.feedbackAddNoMargin,
      )}
      InputProps={{
        style: {
          minWidth: Property.inputMinWidth,
          width: propertyWidth,
        },
        endAdornment: (
          <InputAdornment position='end'>
            <IconButton
              disabled={!value}
              onClick={() => {
                if (!value) return;
                props.onAdd(value);
                setValue(undefined);
                !added && setAdded(true);
              }}
            >
              {(!value && !!added) ? (
                <CheckIcon color='primary' />
              ) : (
                <AddIcon />
              )}
            </IconButton>
          </InputAdornment>
        ),
        ...props.TextFieldProps?.InputProps,
      }}
    />
  );
}

export const ProjectSettingsRoadmap = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  const classes = useStyles();
  const [expandedType, setExpandedType] = useState<'tag' | undefined>();
  const [expandedIndex, setExpandedIndex] = useState<number | undefined>();
  return (
    <ProjectSettingsBase title='Roadmap'>
      <TemplateWrapper<RoadmapInstance | undefined>
        key='roadmap'
        editor={props.editor}
        mapper={templater => templater.roadmapGet()}
        renderResolved={(templater, roadmap) => !roadmap ? (
          <>
            <Typography variant='body1' component='div'>Create a public Roadmap to show off your product plan</Typography>
            <Button
              className={classes.createTemplateButton}
              variant='contained'
              color='primary'
              disableElevation
              onClick={() => templater.roadmapOn()}
            >
              Create Roadmap
            </Button>
          </>
        ) : (
          <>
            <Typography variant='body1' component='div'>Public roadmap page</Typography>
            <FormControlLabel
              label={!!roadmap ? 'Public' : 'Hidden'}
              control={(
                <Switch
                  checked={!!roadmap.pageAndIndex}
                  onChange={(e, checked) => !!roadmap.pageAndIndex
                    ? templater.roadmapPageOff(roadmap)
                    : templater.roadmapOn()}
                  color='primary'
                />
              )}
            />
            {roadmap.pageAndIndex && (
              <>
                <Provider key={props.server.getProjectId()} store={props.server.getStore()}>
                  {!roadmap.pageAndIndex.page.board.title && (
                    <Button
                      className={classes.roadmapAddTitleButton}
                      onClick={() => (props.editor.getProperty(['layout', 'pages', roadmap.pageAndIndex!.index, 'board', 'title']) as ConfigEditor.StringProperty)
                        .set('Roadmap')}
                    >
                      Add title
                    </Button>
                  )}
                  <BoardContainer
                    title={(
                      <PropertyShowOrEdit
                        allowEdit={true}
                        show={(roadmap.pageAndIndex.page.board.title)}
                        edit={(
                          <Provider store={ServerAdmin.get().getStore()}>
                            <PropertyByPath
                              server={props.server}
                              marginTop={0}
                              width={200}
                              overrideName='Title'
                              editor={props.editor}
                              path={['layout', 'pages', roadmap.pageAndIndex.index, 'board', 'title']}
                            />
                          </Provider>
                        )}
                      />
                    )}
                    panels={roadmap.pageAndIndex.page.board.panels.map((panel, panelIndex) => (
                      <ProjectSettingsRoadmapPanel
                        server={props.server}
                        editor={props.editor}
                        roadmap={roadmap}
                        panel={panel}
                        panelIndex={panelIndex}
                      />
                    ))}
                  />
                </Provider>
              </>
            )}
            <ProjectSettingsSectionTagging
              title='Tagging'
              description='Use tags to finely organize tasks.'
              server={props.server}
              editor={props.editor}
              categoryAndIndex={roadmap.categoryAndIndex}
              userCreatable={false}
              expandedIndex={expandedType === 'tag' ? expandedIndex : undefined}
              onExpandedChange={(index) => {
                if (expandedType === 'tag' && expandedIndex === index) {
                  setExpandedIndex(undefined)
                } else {
                  setExpandedType('tag');
                  setExpandedIndex(index)
                }
              }}
            />
          </>
        )
        }
      />
    </ProjectSettingsBase>
  );
}
export const ProjectSettingsRoadmapPanel = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  roadmap: RoadmapInstance;
  panel: Admin.PagePanelWithHideIfEmpty;
  panelIndex: number;
}) => {
  const classes = useStyles();

  // If advanced settings have not been used,
  // only one status per column and each column name and color matches status
  // Keep this in a ref, since value may flip while updating both panel title and status title.
  const onlyStatus = useRef(props.panel.search.filterStatusIds?.length !== 1 ? undefined : props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === props.panel.search.filterStatusIds?.[0]));
  const titleMatchesStatus = useRef(!!onlyStatus.current && props.panel.title === onlyStatus.current.name && props.panel.color === onlyStatus.current.color);

  if (!props.roadmap.pageAndIndex) return null;

  return (
    <BoardPanel
      server={props.server}
      panel={props.panel}
      PanelPostProps={{
        searchOverride: {
          limit: 3,
        },
        disableOnClick: true,
        overrideTitle: !props.panel.title ? undefined : (
          <PropertyShowOrEdit
            allowEdit={true}
            show={(<div style={{ color: props.panel.color }}>{props.panel.title}</div>)}
            edit={(
              <DebouncedTextFieldWithColorPicker
                className={classes.feedbackTag}
                label={(onlyStatus.current && titleMatchesStatus.current) ? 'Title and status name' : 'Title'}
                variant='outlined'
                size='small'
                textValue={props.panel.title}
                onTextChange={text => {
                  (props.editor.getProperty(['layout', 'pages', props.roadmap.pageAndIndex!.index, 'board', 'panels', props.panelIndex, 'title']) as ConfigEditor.StringProperty).set(text);
                  if (onlyStatus.current && titleMatchesStatus.current) {
                    const statusIndex = props.roadmap.categoryAndIndex.category.workflow.statuses.findIndex(s => s.statusId === onlyStatus.current?.statusId);
                    if (statusIndex !== -1) {
                      (props.editor.getProperty(['content', 'categories', props.roadmap.categoryAndIndex.index, 'workflow', 'statuses', statusIndex, 'name']) as ConfigEditor.StringProperty).set(text);
                    }
                  }
                }}
                colorValue={props.panel.color}
                onColorChange={color => {
                  (props.editor.getProperty(['layout', 'pages', props.roadmap.pageAndIndex!.index, 'board', 'panels', props.panelIndex, 'color']) as ConfigEditor.StringProperty).set(color);
                  if (onlyStatus.current && titleMatchesStatus.current) {
                    const statusIndex = props.roadmap.categoryAndIndex.category.workflow.statuses.findIndex(s => s.statusId === onlyStatus.current?.statusId);
                    if (statusIndex !== -1) {
                      (props.editor.getProperty(['content', 'categories', props.roadmap.categoryAndIndex.index, 'workflow', 'statuses', statusIndex, 'color']) as ConfigEditor.StringProperty).set(color);
                    }
                  }
                }}
                TextFieldProps={{
                  InputProps: {
                    style: {
                      minWidth: Property.inputMinWidth,
                      width: propertyWidth,
                    },
                  },
                }}
              />
            )}
          />
        ),
        preContent: (
          <>
            {!props.panel.title && (
              <Button
                className={classes.roadmapPanelAddTitleButton}
                onClick={() => (props.editor.getProperty(['layout', 'pages', props.roadmap.pageAndIndex!.index, 'board', 'panels', props.panelIndex, 'title']) as ConfigEditor.StringProperty)
                  .set(props.roadmap.categoryAndIndex.category.workflow.statuses.find(s => s.statusId === props.panel.search.filterStatusIds?.[0])?.name || 'Title')}
              >
                Add title
              </Button>
            )}
            {!titleMatchesStatus.current && (
              <Provider store={ServerAdmin.get().getStore()}>
                <PropertyByPath
                  server={props.server}
                  marginTop={0}
                  width='auto'
                  editor={props.editor}
                  path={['layout', 'pages', props.roadmap.pageAndIndex!.index, 'board', 'panels', props.panelIndex, 'search', 'filterStatusIds']}
                  bare
                  SelectionPickerProps={{
                    disableClearable: true,
                  }}
                  TextFieldProps={{
                    placeholder: 'Filter',
                    classes: { root: classes.filterStatus },
                    InputProps: {
                      classes: { notchedOutline: classes.filterStatusInput },
                    },
                  }}
                />
              </Provider>
            )}
          </>
        ),
      }}
    />
  );
}

export const ProjectSettingsChangelog = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
}) => {
  return (
    <ProjectSettingsBase title='Changelog'>
      <TemplateWrapper<ChangelogInstance | undefined>
        key='changelog'
        editor={props.editor}
        mapper={templater => templater.changelogGet()}
        renderResolved={(templater, changelog) => (
          <>
            <Typography variant='body1' component='div'>Publish released features and let your customers subscribe to changes</Typography>
            <FormControlLabel
              label={!changelog ? 'Disabled' : (!changelog?.pageAndIndex ? 'Hidden' : 'Shown')}
              control={(
                <Switch
                  checked={!!changelog?.pageAndIndex}
                  onChange={(e, checked) => !!changelog?.pageAndIndex
                    ? templater.changelogOff(changelog)
                    : templater.changelogOn()}
                  color='primary'
                />
              )}
            />
          </>
        )
        }
      />
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

export const ProjectSettingsAdvancedEnter = (props: {}) => {
  const history = useHistory();
  const classes = useStyles();
  return (
    <ProjectSettingsBase title='Advanced'>
      <Alert
        severity='warning'
        className={classes.advancedEnterAlert}
      >
        <AlertTitle>Warning</AlertTitle>
        <p>Advanced settings are powerful and can potentially break your portal or cause data loss.</p>
        <p>If you are unsure what a particular setting does, feel free to reach out to our support team.</p>
        <Button color='inherit' style={{ float: 'right' }} onClick={() => history.push(`/dashboard/settings/project/advanced`)}>
          I understand
        </Button>
      </Alert>
    </ProjectSettingsBase>
  );
}

export const ProjectSettingsApi = () => {
  const classes = useStyles();
  const account = useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);
  return (
    <ProjectSettingsBase title='Developer API'
      description={(
        <>
          Programmatically access and make changes or use Zapier to integrate with your workflow.
          <p>
            Check out the&nbsp;
            <MuiLink
              underline='none'
              color='primary'
              target="_blank"
              href={`${windowIso.location.protocol}//${windowIso.location.host}/api`}
            >API documentation</MuiLink>
            &nbsp;to get familiar.
          </p>
        </>
      )}>
      <UpgradeWrapper action={Action.API_KEY}>
        <Grid container alignItems='baseline' className={classes.item}>
          <Grid item xs={12} sm={4}><Typography>API Token</Typography></Grid>
          <Grid item xs={12} sm={8}><UpdatableField
            isToken
            value={account?.apiKey}
            onSave={newApiKey => ServerAdmin.get().dispatchAdmin().then(d => d.accountUpdateAdmin({
              accountUpdateAdmin: { apiKey: newApiKey }
            }))}
            helperText='Resetting a token invalidates previous token'
          /></Grid>
        </Grid>
        <Grid container alignItems='baseline' className={classes.item}>
          <Grid item xs={12} sm={4}><Typography>Account ID</Typography></Grid>
          <Grid item xs={12} sm={8}>{account?.accountId}</Grid>
        </Grid>
      </UpgradeWrapper>
    </ProjectSettingsBase>
  );
}

export const Section = (props: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  content?: React.ReactNode;
  contentWidth?: string | number;
  preview?: React.ReactNode;
  previewWidth?: string | number;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.previewContainer}>
      <div className={classes.previewContent} style={{ width: props.contentWidth }}>
        {!!props.title && (
          <Typography variant='h5' component='h2' className={classes.previewTitle}>{props.title}</Typography>
        )}
        {!!props.description && (
          <Typography variant='body1' component='div'>{props.description}</Typography>
        )}
        {props.content}
      </div>
      <div className={classes.previewSpacer} />
      {props.preview && (
        <div className={classes.previewPreview} style={{ width: props.previewWidth }}>
          {props.preview}
        </div>
      )}
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
  addressBar?: 'website' | 'project';
  projectPath?: string;
  scroll?: Orientation;
  forceBreakpoint?: Breakpoint;
}) => {
  var preview = props.children;
  if (!props.suppressThemeProvider) {
    preview = (
      <AppThemeProvider
        appRootId={props.server.getProjectId()}
        seed={props.server.getProjectId()}
        isInsideContainer={true}
        supressCssBaseline={true}
        forceBreakpoint={props.forceBreakpoint}
        containerStyle={theme => !props.scroll ? {} : {
          ...contentScrollApplyStyles({
            theme,
            orientation: props.scroll,
            backgroundColor: theme.palette.background.default,
          }),
        }}
      >
        {preview}
      </AppThemeProvider>
    );
  }
  preview = (
    <BrowserPreviewInternal
      FakeBrowserProps={props.FakeBrowserProps}
      addressBar={props.addressBar}
      projectPath={props.projectPath}
      code={props.code}
    >
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
  addressBar?: 'website' | 'project';
  projectPath?: string;
  FakeBrowserProps?: React.ComponentProps<typeof FakeBrowser>;
}) => {
  const classes = useStyles();
  const config = useSelector<ReduxState, Admin.Config | undefined>(state => state.conf.conf, shallowEqual);
  const darkMode = useSelector<ReduxState, boolean>(state => !!state?.conf?.conf?.style.palette.darkMode, shallowEqual);
  const website = useSelector<ReduxState, string | undefined>(state => state?.conf?.conf?.website, shallowEqual);


  var addressBar;
  switch (props.addressBar) {
    case 'website':
      addressBar = (website || 'yoursite.com');
      break;
    case 'project':
      addressBar = !config ? '' : getProjectLink(config);
      if (!!props.projectPath) {
        if (!props.projectPath.startsWith('/')) addressBar += '/';
        addressBar += props.projectPath;
      }
      break;
  }
  return (
    <FakeBrowser
      fixedWidth={350}
      codeMaxHeight={150}
      className={classes.browserPreview}
      darkMode={darkMode}
      addressBarContent={addressBar}
      codeContent={props.code}
      {...props.FakeBrowserProps}
    >
      {props.children}
    </FakeBrowser>
  );
}

export class TemplateWrapper<T> extends Component<{
  key: string; // Ensure two conflicting instances are not shared (happened to me...)
  editor: ConfigEditor.Editor;
  mapper: (templater: Templater) => Promise<T>;
  render?: (templater: Templater, response?: { val: T }, confirmation?: Confirmation) => any;
  type?: 'collapse' | 'dialog';
  renderResolved?: (templater: Templater, response: T) => any;
}, {
  confirmation?: Confirmation;
  confirm?: (response: ConfirmationResponseId) => void;
  mappedValue?: { val: T };
}> {
  unsubscribe?: () => void;
  templater: Templater;

  constructor(props) {
    super(props);

    this.state = {};

    this.templater = Templater.get(
      props.editor,
      (confirmation) => new Promise<ConfirmationResponseId>(resolve => this.setState({
        confirmation,
        confirm: resolve,
      })));
  }

  componentDidMount() {
    const refreshMappedValue = () => {
      this.props.mapper(this.templater)
        .then(mappedValue => this.setState({ mappedValue: { val: mappedValue } }));
    }

    const remapDebounced = debounce(() => {
      refreshMappedValue();
    }, 10);
    this.unsubscribe = this.props.editor.subscribe(() => remapDebounced());

    refreshMappedValue();
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    if (!!this.props.render) {
      return this.props.render(
        this.templater,
        this.state.mappedValue,
        this.state.confirmation,
      );
    }
    if (this.props.type === 'dialog') {
      return this.renderDialogConfirmation();
    }
    return this.renderCollapsibleConfirmation();
  }

  renderDialogConfirmation() {
    return (
      <>
        {this.state.mappedValue && this.props.renderResolved?.(this.templater, this.state.mappedValue.val)}
        <Dialog
          open={!!this.state.confirm}
          onClose={() => this.setState({ confirm: undefined })}
        >
          <DialogTitle>{this.state.confirmation?.title}</DialogTitle>
          <DialogContent>
            <DialogContentText>{this.state.confirmation?.description}</DialogContentText>
            <DialogContentText>This usually happens when you change defaults in the Advanced settings.</DialogContentText>
          </DialogContent>
          <DialogActions>
            {this.state.confirmation?.responses.map(response => (
              <Button
                color='inherit'
                style={{
                  textTransform: 'none',
                  color: response.type === 'cancel' ? 'darkred' : undefined,
                }}
                onClick={() => {
                  this.state.confirm?.(response.id);
                  this.setState({ confirm: undefined });
                }}
              >
                {response.title}
              </Button>
            ))}
          </DialogActions>
        </Dialog>
      </>
    );
  }

  renderCollapsibleConfirmation() {
    return (
      <>
        <Collapse mountOnEnter in={!!this.state.confirm}>
          <Alert
            style={{ maxWidth: 500 }}
            severity='warning'
          >
            <AlertTitle>{this.state.confirmation?.title}</AlertTitle>
            <p>{this.state.confirmation?.description}</p>
            <p>This usually happens when you change defaults in the Advanced settings.</p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}>
              {this.state.confirmation?.responses.map(response => (
                <Button
                  size='small'
                  color='inherit'
                  style={{
                    textTransform: 'none',
                    color: response.type === 'cancel' ? 'darkred' : undefined,
                  }}
                  onClick={() => {
                    this.state.confirm?.(response.id);
                    this.setState({ confirm: undefined });
                  }}
                >
                  {response.title}
                </Button>
              ))}
            </div>
          </Alert>
        </Collapse>
        <Collapse mountOnEnter in={!this.state.confirm}>
          {this.state.mappedValue && this.props.renderResolved?.(this.templater, this.state.mappedValue.val)}
        </Collapse>
      </>
    );
  }
}

const IconPickerHelperText = () => {
  return (
    <FormHelperText>
      Find an icon name&nbsp;
      <MuiLink
        underline='none'
        color='primary'
        target="_blank"
        href='https://material-ui.com/components/material-icons/'
        rel='noopener nofollow'
      >here</MuiLink>.
    </FormHelperText>
  );
}

const PropertyByPath = (props: {
  server: Server;
  editor: ConfigEditor.Editor;
  path: ConfigEditor.Path;
  overrideName?: string;
  overrideDescription?: string;
  marginTop?: number;
  width?: string | number;
  inputMinWidth?: string | number;
  TextFieldProps?: Partial<React.ComponentProps<typeof TextField>>;
  TablePropProps?: Partial<React.ComponentProps<typeof TableProp>>;
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
  bare?: boolean;
}) => {
  const history = useHistory();
  const planId = useSelector<ReduxStateAdmin, string | undefined>(state => state.account.account.account?.basePlanId, shallowEqual);

  var propertyRequiresUpgrade: ((propertyPath: ConfigEditor.Path) => boolean) | undefined;
  const restrictedProperties = planId && RestrictedProperties[planId];
  if (restrictedProperties) {
    propertyRequiresUpgrade = (path) => restrictedProperties.some(restrictedPath =>
      ConfigEditor.pathEquals(restrictedPath, path));
  }

  return (
    <Property
      key={ConfigEditor.pathToString(props.path)}
      server={props.server}
      prop={props.editor.get(props.path)}
      pageClicked={path => history.push(`/dashboard/settings/project/advanced/${path.join('/')}`)}
      requiresUpgrade={propertyRequiresUpgrade}
      marginTop={props.marginTop}
      width={props.width || propertyWidth}
      inputMinWidth={props.inputMinWidth}
      overrideName={props.overrideName}
      overrideDescription={props.overrideDescription}
      TextFieldProps={props.TextFieldProps}
      TablePropProps={props.TablePropProps}
      SelectionPickerProps={props.SelectionPickerProps}
      bare={props.bare}
    />
  );
}

const PropertyShowOrEdit = (props: {
  allowEdit: boolean;
  show: React.ReactNode;
  edit: React.ReactNode;
}) => {
  const classes = useStyles();
  const [editing, setEditing] = useState<boolean>(false);
  if (!props.allowEdit && editing) setEditing(false);
  return (
    <>
      <Collapse mountOnEnter in={!editing}>
        <div className={classes.showOrEdit}>
          {props.show}
          {props.allowEdit && (
            <IconButton
              className={classes.showOrEditButton}
              size='small'
              onClick={e => {
                setEditing(true);
                e.stopPropagation();
              }}
              onFocus={e => e.stopPropagation()}
            >
              <EditIcon />
            </IconButton>
          )}
        </div>
      </Collapse>
      <Collapse mountOnEnter in={editing}>
        <div
          onClick={e => e.stopPropagation()}
          onFocus={e => e.stopPropagation()}
        >
          {props.edit}
        </div>
      </Collapse>
    </>
  );
};

const DebouncedTextFieldWithColorPicker = (props: React.ComponentProps<typeof TextFieldWithColorPicker>) => {
  const [statusName, setStatusName] = useDebounceProp<string>(
    props.textValue || '',
    text => props.onTextChange(text));
  const [statusColor, setStatusColor] = useDebounceProp<string>(
    props.colorValue || '',
    color => props.onColorChange(color));
  return (
    <TextFieldWithColorPicker
      {...props}
      textValue={statusName}
      onTextChange={text => setStatusName(text)}
      colorValue={statusColor}
      onColorChange={color => setStatusColor(color)}
    />
  );
}

export const useDebounceProp = <T,>(initialValue: T, setter: (val: T) => void): [T, (val: T) => void] => {
  const [val, setVal] = useState<T>(initialValue);

  const setterDebouncedRef = useRef(setter);
  useEffect(() => {
    setterDebouncedRef.current = debounce(setter, DemoUpdateDelay);
  }, []);

  return [val, val => {
    setVal(val);
    setterDebouncedRef.current?.(val);
  }];
}
