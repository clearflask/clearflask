// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@material-ui/core';
import ServerAdmin from '../../api/serverAdmin';
import * as ConfigEditor from '../../common/config/configEditor';
import Menu, { MenuHeading, MenuItem } from '../../common/config/settings/Menu';
import SettingsDynamicPage from '../../common/config/settings/SettingsDynamicPage';
import { Orientation } from '../../common/ContentScroll';
import { SectionContent } from '../../common/Layout';
import SubmitButton from '../../common/SubmitButton';
import { TourAnchor } from '../../common/tour';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, ProjectSettingsMainSize } from "../Dashboard";
import BillingPage from './BillingPage';
import { ProjectSettingsAdvancedEnter, ProjectSettingsApi, ProjectSettingsBase, ProjectSettingsBranding, ProjectSettingsChangelog, ProjectSettingsCookies, ProjectSettingsCoupons, ProjectSettingsData, ProjectSettingsDomain, ProjectSettingsFeedback, ProjectSettingsGitHub, ProjectSettingsGoogleAnalytics, ProjectSettingsHotjar, ProjectSettingsInstall, ProjectSettingsIntercom, ProjectSettingsLanding, ProjectSettingsLoginAs, ProjectSettingsRoadmap, ProjectSettingsTeammates, ProjectSettingsUsers, ProjectSettingsUsersOauth, ProjectSettingsUsersSso } from './ProjectSettings';
import SettingsPage from './SettingsPage';
import { SelfhostLicensePage } from './SelfhostLicensePage';
import { SelfhostInstallPage } from './SelfhostInstallPage';

export async function renderSettings(this: Dashboard, context: DashboardPageContext) {
  if (!this.props.account) {
    setTitle(this.props.t('settings') + ' - ' + this.props.t('dashboard'));
    context.showWarning = 'Not logged in';
    return;
  }
  const activeProject = context.activeProject;
  const activePath = this.props.match.params['path'] || '';
  const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');

  var mainContent: SectionContent;
  if (activeSubPath[0] === 'project') {
    if (!activeProject) { context.showCreateProjectWarning = true; return; }

    const showAdvancedWarning = activeSubPath[1] !== 'advanced'
      && !activeProject.editor.getConfig().usedAdvancedSettings;
    context.sections.push({
      name: 'menu',
      breakAction: 'menu',
      size: { breakWidth: 200, width: 'max-content', maxWidth: 350, scroll: Orientation.Vertical },
      content: (
        <>
          <Menu key='project-settings'
            items={[
              { type: 'heading', text: this.props.t('project'), hasUnsavedChanges: activeProject.hasUnsavedChanges() },
              { type: 'item', slug: 'settings/project/branding', name: this.props.t('branding'), offset: 1 },
              { type: 'item', slug: 'settings/project/domain', name: this.props.t('domain'), offset: 1 },
              { type: 'item', slug: 'settings/project/teammates', name: this.props.t('teammates'), offset: 1 },
              { type: 'item', slug: 'settings/project/landing', name: this.props.t('landing'), offset: 1 },
              { type: 'item', slug: 'settings/project/feedback', name: this.props.t('feedback'), offset: 1 },
              { type: 'item', slug: 'settings/project/roadmap', name: this.props.t('roadmap'), offset: 1 },
              { type: 'item', slug: 'settings/project/changelog', name: this.props.t('announcements'), offset: 1 },
              { type: 'item', slug: 'settings/project/onboard', name: this.props.t('onboard'), offset: 1 },
              { type: 'item', slug: 'settings/project/onboard/sso', name: 'SSO', offset: 2 },
              { type: 'item', slug: 'settings/project/onboard/oauth', name: 'OAuth', offset: 2 },
              { type: 'item', slug: 'settings/project/install', name: this.props.t('install'), offset: 1 },
              { type: 'item', slug: 'settings/project/cookies', name: this.props.t('cookie-consent'), offset: 1 },
              { type: 'item', slug: 'settings/project/data', name: this.props.t('data'), offset: 1 },
              { type: 'heading', text: this.props.t('integrations'), offset: 1 },
              { type: 'item', slug: 'settings/project/github', name: 'GitHub', offset: 2 },
              { type: 'item', slug: 'settings/project/intercom', name: 'Intercom', offset: 2 },
              { type: 'item', slug: 'settings/project/google-analytics', name: 'Google Analytics', offset: 2 },
              { type: 'item', slug: 'settings/project/hotjar', name: 'Hotjar', offset: 2 },
              (showAdvancedWarning ? {
                type: 'item', slug: 'settings/project/advanced-enter', name: this.props.t('advanced'), offset: 1,
              } : {
                type: 'project',
                name: this.props.t('advanced'),
                slug: 'settings/project/advanced',
                offset: 1,
                projectId: activeProject.server.getProjectId(),
                page: activeProject.editor.getPage([]),
              }),
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
          />
        </>
      ),
    });

    if (activeSubPath[1] === 'advanced') {
      const pagePath = activeSubPath.slice(2);
      try {
        var currentPage = activeProject.editor.getPage(pagePath);
      } catch (ex) {
        setTitle('Settings - Dashboard');
        context.showWarning = 'Oops, page failed to load';
        return;
      }
      if (!!this.forcePathListener
        && pagePath.length >= 3
        && pagePath[0] === 'layout'
        && pagePath[1] === 'pages') {
        const pageIndex = pagePath[2];
        const forcePath = '/' + (activeProject.editor.getProperty(['layout', 'pages', pageIndex, 'slug']) as ConfigEditor.StringProperty).value;
        this.forcePathListener(forcePath);
      }

      mainContent = (
        <ProjectSettingsBase>
          <SettingsDynamicPage
            key={currentPage.key}
            page={currentPage}
            server={activeProject.server}
            editor={activeProject.editor}
            pageClicked={path => this.pageClicked(activePath, ['project', 'advanced', ...path])}
          />
        </ProjectSettingsBase>
      );
    } else {
      if (!activeProject) { context.showCreateProjectWarning = true; return; }
      switch (activeSubPath[1]) {
        case 'teammates':
          mainContent = (<ProjectSettingsTeammates server={activeProject.server} />);
          break;
        case 'install':
          mainContent = (<ProjectSettingsInstall server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'branding':
          mainContent = (<ProjectSettingsBranding server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'domain':
          mainContent = (<ProjectSettingsDomain server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'onboard':
          if (activeSubPath[2] === 'sso') {
            mainContent = (<ProjectSettingsUsersSso server={activeProject.server} editor={activeProject.editor} />);
          } else if (activeSubPath[2] === 'oauth') {
            mainContent = (<ProjectSettingsUsersOauth server={activeProject.server} editor={activeProject.editor} />);
          } else {
            mainContent = (<ProjectSettingsUsers server={activeProject.server} editor={activeProject.editor} />);
          }
          break;
        case 'landing':
          mainContent = (<ProjectSettingsLanding server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'feedback':
          mainContent = (<ProjectSettingsFeedback server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'roadmap':
          mainContent = (<ProjectSettingsRoadmap server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'changelog':
          mainContent = (<ProjectSettingsChangelog server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'data':
          mainContent = (<ProjectSettingsData server={activeProject.server} />);
          break;
        case 'cookies':
          mainContent = (<ProjectSettingsCookies server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'github':
          mainContent = (<ProjectSettingsGitHub project={activeProject} server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'google-analytics':
          mainContent = (<ProjectSettingsGoogleAnalytics server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'hotjar':
          mainContent = (<ProjectSettingsHotjar server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'intercom':
          mainContent = (<ProjectSettingsIntercom server={activeProject.server} editor={activeProject.editor} />);
          break;
        case 'advanced-enter':
          mainContent = (<ProjectSettingsAdvancedEnter />);
          break;
      }
    }
  } else if (activeSubPath[0] === 'account') {
    context.sections.push({
      name: 'menu',
      breakAction: 'menu',
      size: { breakWidth: 200, width: 'max-content', maxWidth: 350, scroll: Orientation.Vertical },
      content: (
        <>
          <Menu key='account'
            items={[
              { type: 'heading', text: this.props.t('account') } as MenuHeading,
              { type: 'item', slug: 'settings/account/profile', name: this.props.t('profile'), offset: 1 } as MenuItem,
              { type: 'item', slug: 'settings/account/billing', name: this.props.t('billing'), offset: 1 } as MenuItem,
              ...(!context.isSelfhostServiceOnly ? [
                { type: 'item', slug: 'settings/account/api', name: 'API', offset: 1 } as MenuItem,
              ] : [
                { type: 'heading', text: this.props.t('self-hosting') } as MenuHeading,
                { type: 'item', slug: 'settings/account/selfhost-install', name: this.props.t('install'), offset: 1 } as MenuItem,
                { type: 'item', slug: 'settings/account/selfhost-service', name: 'License', offset: 1 } as MenuItem,
              ]),
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
          />
        </>
      ),
    });

    switch (activeSubPath[1]) {
      case 'profile':
        setTitle(this.props.t('account') + ' - ' + this.props.t('dashboard'));
        mainContent = (<SettingsPage />);
        break;
      case 'billing':
        setTitle(this.props.t('billing') + ' - ' + this.props.t('dashboard'));
        mainContent = (<BillingPage stripePromise={Dashboard.getStripePromise()} />);
        break;
      case 'api':
        setTitle('API - ' + this.props.t('dashboard'));
        mainContent = (<ProjectSettingsApi />);
        break;
      case 'selfhost-install':
        setTitle('Self-host License - ' + this.props.t('dashboard'));
        mainContent = (<SelfhostInstallPage />);
        break;
      case 'selfhost-service':
        setTitle('Self-host License - ' + this.props.t('dashboard'));
        mainContent = (<SelfhostLicensePage />);
        break;
    }
  } else if (activeSubPath[0] === 'super') {
    context.sections.push({
      name: 'menu',
      breakAction: 'menu',
      size: { breakWidth: 200, width: 'max-content', maxWidth: 350, scroll: Orientation.Vertical },
      content: (
        <Menu key='account'
          items={[
            { type: 'heading', text: 'Super Admin' } as MenuHeading,
            { type: 'item', slug: 'settings/super/loginas', name: 'Login As', offset: 1 } as MenuItem,
            { type: 'item', slug: 'settings/super/coupons', name: 'Coupons', offset: 1 } as MenuItem,
          ]}
          activePath={activePath}
          activeSubPath={activeSubPath}
        />
      ),
    });

    switch (activeSubPath[1]) {
      case 'loginas':
        setTitle('Login As - ' + this.props.t('dashboard'));
        mainContent = (
          <ProjectSettingsLoginAs account={this.props.account} />
        );
        break;
      case 'coupons':
        setTitle('Coupons - ' + this.props.t('dashboard'));
        mainContent = (
          <ProjectSettingsCoupons />
        );
        break;
    }
  }
  var barBottom: SectionContent;
  if (activeSubPath[0] === 'project') {
    barBottom = (activeProject?.hasUnsavedChanges()) ? (
      <div className={this.props.classes.unsavedChangesBar}>
        <Typography style={{ flexGrow: 100 }}>{this.props.t('you-have-unsaved-changes')}</Typography>
        {!this.state.settingsPreviewChanges && (
          <Button
            variant='text'
            color='default'
            style={{ marginLeft: 8 }}
            onClick={() => this.setState({
              previewShowOnPage: 'settings',
              settingsPreviewChanges: 'live',
            })}
          >
            {this.props.t('preview')}
          </Button>
        )}
        <SubmitButton
          variant='text'
          color='inherit'
          isSubmitting={this.state.saveIsSubmitting}
          style={{ marginLeft: 8, color: !this.state.saveIsSubmitting ? this.props.theme.palette.error.main : undefined }}
          onClick={() => this.setState({
            saveDiscardDialogOpen: true,
          })}
        >
          {this.props.t('discard')}
        </SubmitButton>
        <TourAnchor anchorId='settings-publish-changes' placement='top' disablePortal>
          {(next, isActive, anchorRef) => (
            <SubmitButton
              buttonRef={anchorRef}
              isSubmitting={this.state.saveIsSubmitting}
              variant='contained'
              disableElevation
              color='primary'
              style={{ marginLeft: 8 }}
              onClick={async () => {
                this.setState({ saveIsSubmitting: true });
                try {
                  await this.publishChanges(activeProject);
                  this.setState({ settingsPreviewChanges: undefined });
                  next();
                } finally {
                  this.setState({ saveIsSubmitting: false });
                }
              }}
            >
              {this.props.t('publish')}
            </SubmitButton>
          )}
        </TourAnchor>
        <Dialog
          open={!!this.state.saveDiscardDialogOpen}
          onClose={() => this.setState({ saveDiscardDialogOpen: false })}
        >
          <DialogTitle>{this.props.t('discard-changes')}</DialogTitle>
          <DialogContent>
            <DialogContentText>{this.props.t('are-you-sure-you-want-to-discard-all-your-configuration-changes')}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ saveDiscardDialogOpen: false })}
            >{this.props.t('cancel')}</Button>
            <SubmitButton
              isSubmitting={this.state.saveIsSubmitting}
              style={{ color: !this.state.saveIsSubmitting ? this.props.theme.palette.error.main : undefined }}
              onClick={async () => {
                this.setState({ saveIsSubmitting: true });
                try {
                  const oldVersionedConfigAdmin = ServerAdmin.get().getStore().getState().configs.configs.byProjectId?.[activeProject.projectId]?.config;
                  if (oldVersionedConfigAdmin) {
                    activeProject.resetUnsavedChanges(oldVersionedConfigAdmin);
                    this.setState({ saveDiscardDialogOpen: false });
                  }
                } finally {
                  this.setState({ saveIsSubmitting: false });
                }
              }}>
              {this.props.t('discard')}
            </SubmitButton>
          </DialogActions>
        </Dialog>
      </div>
    ) : undefined;
  }
  context.sections.push({
    name: 'main',
    size: ProjectSettingsMainSize,
    content: mainContent,
    barBottom: barBottom,
  });

  if (!!this.state.settingsPreviewChanges) {
    context.previewOnClose = () => this.setState({ settingsPreviewChanges: undefined });

    context.sections.push(this.renderPreviewChangesDemo(activeProject,
      this.state.settingsPreviewChanges === 'code'
    ));
  }

  context.showProjectLink = true;
}
