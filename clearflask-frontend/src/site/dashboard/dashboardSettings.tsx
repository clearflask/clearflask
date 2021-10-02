// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@material-ui/core';
import React from 'react';
import * as Admin from '../../api/admin';
import ServerAdmin from '../../api/serverAdmin';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
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
import { ProjectSettingsAdvancedEnter, ProjectSettingsApi, ProjectSettingsBase, ProjectSettingsBranding, ProjectSettingsChangelog, ProjectSettingsData, ProjectSettingsDomain, ProjectSettingsFeedback, ProjectSettingsGitHub, ProjectSettingsGoogleAnalytics, ProjectSettingsHotjar, ProjectSettingsInstall, ProjectSettingsIntercom, ProjectSettingsLanding, ProjectSettingsRoadmap, ProjectSettingsTeammates, ProjectSettingsUsers, ProjectSettingsUsersOauth, ProjectSettingsUsersSso } from './ProjectSettings';
import SettingsPage from './SettingsPage';

export async function renderSettings(this: Dashboard, context: DashboardPageContext) {
  if (!this.props.account) {
    setTitle('Settings - Dashboard');
    context.showWarning = 'Not logged in';
    return;
  }
  const activeProject = context.activeProject;
  const activePath = this.props.match.params['path'] || '';
  const activeSubPath = ConfigEditor.parsePath(this.props.match.params['subPath'], '/');

  // Superadmin account switcher
  const accountToLabel = (account: Admin.Account): Label => {
    return {
      label: account.name,
      filterString: `${account.name} ${account.email}`,
      value: account.email
    };
  }
  const seenAccountEmails: Set<string> = new Set();
  const curAccountLabel: Label = accountToLabel(this.props.account);
  const accountOptions = [curAccountLabel];
  seenAccountEmails.add(this.props.account.email)
  this.state.accountSearch && this.state.accountSearch.forEach(account => {
    if (!seenAccountEmails.has(account.email)) {
      const label = accountToLabel(account);
      seenAccountEmails.add(account.email);
      accountOptions.push(label);
    }
  });

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
              { type: 'heading', text: 'Project', hasUnsavedChanges: activeProject.hasUnsavedChanges() },
              { type: 'item', slug: 'settings/project/branding', name: 'Branding', offset: 1 },
              { type: 'item', slug: 'settings/project/domain', name: 'Domain', offset: 1 },
              { type: 'item', slug: 'settings/project/teammates', name: 'Teammates', offset: 1 },
              { type: 'item', slug: 'settings/project/landing', name: 'Landing', offset: 1 },
              { type: 'item', slug: 'settings/project/feedback', name: 'Feedback', offset: 1 },
              { type: 'item', slug: 'settings/project/roadmap', name: 'Roadmap', offset: 1 },
              { type: 'item', slug: 'settings/project/changelog', name: 'Changelog', offset: 1 },
              { type: 'item', slug: 'settings/project/onboard', name: 'Onboard', offset: 1 },
              { type: 'item', slug: 'settings/project/onboard/sso', name: 'SSO', offset: 2 },
              { type: 'item', slug: 'settings/project/onboard/oauth', name: 'OAuth', offset: 2 },
              { type: 'item', slug: 'settings/project/install', name: 'Install', offset: 1 },
              { type: 'item', slug: 'settings/project/data', name: 'Data', offset: 1 },
              { type: 'heading', text: 'Integrations', offset: 1 },
              { type: 'item', slug: 'settings/project/github', name: 'GitHub', offset: 2 },
              { type: 'item', slug: 'settings/project/intercom', name: 'Intercom', offset: 2 },
              { type: 'item', slug: 'settings/project/google-analytics', name: 'Google Analytics', offset: 2 },
              { type: 'item', slug: 'settings/project/hotjar', name: 'Hotjar', offset: 2 },
              (showAdvancedWarning ? {
                type: 'item', slug: 'settings/project/advanced-enter', name: 'Advanced', offset: 1,
              } : {
                type: 'project',
                name: 'Advanced',
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
      setTitle(currentPage.getDynamicName());

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
              { type: 'heading', text: 'Account' } as MenuHeading,
              { type: 'item', slug: 'settings/account/profile', name: 'Profile', offset: 1 } as MenuItem,
              { type: 'item', slug: 'settings/account/billing', name: 'Billing', offset: 1 } as MenuItem,
              { type: 'item', slug: 'settings/account/api', name: 'API', offset: 1 } as MenuItem,
            ]}
            activePath={activePath}
            activeSubPath={activeSubPath}
          />
          {!!this.props.isSuperAdmin && (
            <SelectionPicker
              className={this.props.classes.accountSwitcher}
              disableClearable
              value={[curAccountLabel]}
              forceDropdownIcon={false}
              options={accountOptions}
              helperText='Switch account'
              minWidth={50}
              maxWidth={150}
              inputMinWidth={0}
              showTags
              bareTags
              disableFilter
              loading={this.state.accountSearching !== undefined}
              noOptionsMessage='No accounts'
              onFocus={() => {
                if (this.state.accountSearch === undefined
                  && this.state.accountSearching === undefined) {
                  this.searchAccounts('');
                }
              }}
              onInputChange={(newValue, reason) => {
                if (reason === 'input') {
                  this.searchAccounts(newValue);
                }
              }}
              onValueChange={labels => {
                const email = labels[0]?.value;
                if (email && this.props.account?.email !== email) {
                  ServerAdmin.get().dispatchAdmin().then(d => d.accountLoginAsSuperAdmin({
                    accountLoginAs: {
                      email,
                    },
                  }).then(result => {
                    return d.configGetAllAndUserBindAllAdmin();
                  }));
                }
              }}
            />
          )}
        </>
      ),
    });

    switch (activeSubPath[1]) {
      case 'profile':
        setTitle('Account - Dashboard');
        mainContent = (<SettingsPage />);
        break;
      case 'billing':
        setTitle('Billing - Dashboard');
        mainContent = (<BillingPage stripePromise={Dashboard.getStripePromise()} />);
        break;
      case 'api':
        setTitle('API - Dashboard');
        mainContent = (<ProjectSettingsApi />);
        break;
    }
  }
  var barBottom: SectionContent;
  if (activeSubPath[0] === 'project') {
    barBottom = (activeProject?.hasUnsavedChanges()) ? (
      <div className={this.props.classes.unsavedChangesBar}>
        <Typography style={{ flexGrow: 100 }}>You have unsaved changes</Typography>
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
            Preview
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
          Discard
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
                  const versionedConfigAdmin = await this.publishChanges(activeProject);
                  this.setState({ settingsPreviewChanges: undefined });
                  next();
                } finally {
                  this.setState({ saveIsSubmitting: false });
                }
              }}
            >
              Publish
            </SubmitButton>
          )}
        </TourAnchor>
        <Dialog
          open={!!this.state.saveDiscardDialogOpen}
          onClose={() => this.setState({ saveDiscardDialogOpen: false })}
        >
          <DialogTitle>Discard changes</DialogTitle>
          <DialogContent>
            <DialogContentText>Are you sure you want to discard all your configuration changes?</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => this.setState({ saveDiscardDialogOpen: false })}
            >Cancel</Button>
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
              Discard
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
