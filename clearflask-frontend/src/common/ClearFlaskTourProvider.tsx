// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { useTranslation } from 'react-i18next';
import { shallowEqual, useSelector } from 'react-redux';
import * as Admin from '../api/admin';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import { ChangelogInstance } from './config/template/changelog';
import { FeedbackInstance } from './config/template/feedback';
import { RoadmapInstance } from './config/template/roadmap';
import { TourDefinitionGuideState, TourProvider } from './tour';

const getGuideState = (guideId: string, account?: Admin.AccountAdmin): TourDefinitionGuideState => {
  return (account?.attrs?.[getGuideAttrId(guideId)] || TourDefinitionGuideState.Available) as TourDefinitionGuideState;
}
const getGuideAttrId = (guideId: string): string => {
  return `guide-state-${guideId}`;
}
const setGuideState = async (guideId: string, state: TourDefinitionGuideState) => {
  (await ServerAdmin.get().dispatchAdmin()).accountAttrsUpdateAdmin({
    accountAttrsUpdateAdmin: {
      attrs: { [getGuideAttrId(guideId)]: state }
    }
  });
}
export const tourSetGuideState = async (guideId: string, state: TourDefinitionGuideState) => {
  const account = ServerAdmin.get().getStore().getState().account.account.account;
  if (!account) return;
  if (getGuideState(guideId, account) === state) return;
  setGuideState(guideId, state);
}

const ClearFlaskTourProvider = (props: {
  children?: any;
  feedback?: FeedbackInstance;
  roadmap?: RoadmapInstance;
  changelog?: ChangelogInstance;
}) => {
  const { t } = useTranslation('site');
  const account = useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);
  return (
    <TourProvider
      tour={{
        title: t('quick-start-guide'),
        /**
         * TODO:
         * - Import data
         * - Invite teammates
         */
        guides: {
          ...(!props.feedback ? {} : {
            'feedback-page': {
              state: getGuideState('feedback-page', account),
              title: t('manage-incoming-feedback'),
              steps: {
                'create-btn': {
                  title: t('capture-feedback'), description: t('first-lets-capture-feedback-from-a-customer'),
                  openPath: '/dashboard/feedback',
                  anchorId: 'feedback-page-create-btn',
                },
                'submit-feedback': {
                  title: t('submit-feedback'), description: t('save-the-newly-created-feedback'),
                  anchorId: 'post-create-form-submit-btn',
                },
                'convert-to-task': {
                  title: t('convert-feedback-into-a-task'), description: t('creates-a-task-and-places-it-on-your'),
                  anchorId: 'feedback-page-convert-to-task',
                  showButtonNext: true,
                },
                'merge-or-link': {
                  title: t('combine-duplicates'), description: t('for-duplicate-or-related-ideas-merge-together'),
                  anchorId: 'feedback-page-link-or-merge',
                  showButtonNext: true,
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          ...(!props.roadmap ? {} : {
            'roadmap-page': {
              state: getGuideState('roadmap-page', account),
              title: t('prioritize-your-roadmap'),
              steps: {
                ...(!props.roadmap.statusIdBacklog ? {} : {
                  'show-backlog': {
                    title: t('backlog-of-ideas'), description: t('these-are-tasks-that-are-in-an-ideation'),
                    openPath: '/dashboard/roadmap',
                    showButtonNext: true,
                    anchorId: 'roadmap-page-section-backlog',
                  },
                }),
                'show-roadmap': {
                  title: t('public-roadmap'), description: t('this-is-where-you-show-off-your'),
                  openPath: '/dashboard/roadmap',
                  showButtonNext: true,
                  anchorId: 'roadmap-page-section-roadmap',
                },
                ...(!props.roadmap.statusIdCompleted ? {} : {
                  'show-completed': {
                    title: t('completed-tasks'), description: t('after-your-finish-a-task-drop-it-in-here') + (props.changelog ? ' ' + t('we-will-combine-these-into-a') : ''),
                    showButtonNext: true,
                    anchorId: 'roadmap-page-section-completed',
                  },
                }),
                'create-task': {
                  title: t('create-a-task'), description: t('lets-create-your-first-task-on'),
                  anchorId: 'roadmap-page-section-roadmap-create-btn',
                },
                'submit-task': {
                  title: t('submit-task'), description: t('save-the-newly-created-task'),
                  anchorId: 'post-create-form-submit-btn',
                  showDelay: 500,
                },
                'drag-roadmap': {
                  title: t('pick-me-up'), description: t('and-drag-me-around-the-roadmap'),
                  showButtonNext: t('i-had-enough'),
                  anchorId: 'roadmap-page-selected-drag-me',
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          ...(!props.changelog ? {} : {
            'changelog-page': {
              state: getGuideState('changelog-page', account),
              title: t('create-a-changelog-entry'),
              steps: {
                'create-btn': {
                  title: t('create-changelog'), description: t('lets-create-your-first-changelog'),
                  openPath: '/dashboard/changelog',
                  anchorId: 'changelog-page-create-btn',
                },
                'link-to-task': {
                  title: t('link-with-tasks'), description: t('optionally-you-can-link-to-your'),
                  showButtonNext: true,
                  anchorId: 'post-create-form-link-to-task',
                },
                'save-draft': {
                  title: t('save-as-a-draft'), description: t('useful-if-you-are-not-quite-ready'),
                  anchorId: 'post-create-form-save-draft',
                  showButtonNext: true,
                  zIndex: zb => zb.modal - 1,
                },
                'submit-feedback': {
                  title: t('submit-feedback'), description: t('submit-the-newly-created-changelog'),
                  showButtonNext: t('got-it'),
                  anchorId: 'post-create-form-submit-btn',
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          'visit-project': {
            state: getGuideState('visit-project', account),
            title: t('check-out-your-portal'),
            steps: {
              'visit-project': {
                title: t('check-it-out-over-here'), description: t('this-will-take-you-to-the-publicly'),
                anchorId: 'dashboard-visit-portal',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'visibility': {
            state: getGuideState('visibility', account),
            title: t('toggle-portals-public-visibility'),
            steps: {
              'visibility': {
                title: t('visibility'), description: t('choose-whether-you-want-to-have'),
                openPath: '/dashboard/settings/project/onboard',
                showButtonComplete: t('this-is-fine'),
                anchorId: 'settings-onboard-visibility',
              },
              'publish-changes': {
                title: t('save-changes'), description: t('publish-your-changes-live'),
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'onboarding': {
            state: getGuideState('onboarding', account),
            title: t('choose-how-users-can-sign-up'),
            steps: {
              'methods': {
                title: t('onboarding'), description: t('choose-how-your-users-can-sign'),
                openPath: '/dashboard/settings/project/onboard',
                showButtonComplete: t('this-is-fine'),
                anchorId: 'settings-onboard-methods',
              },
              'publish-changes': {
                title: t('save-changes'), description: t('publish-your-changes-live'),
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'custom-domain': {
            state: getGuideState('custom-domain', account),
            title: t('setup-a-custom-domain-for-your-portal'),
            steps: {
              'dns-settings': {
                title: 'DNS ' + t('settings'), description: t('first-you-need-to-configure-your-dns', { cname: 'sni.clearflask.com' }),
                openPath: '/dashboard/settings/project/domain',
                showButtonNext: t('done'),
                anchorId: 'settings-domain-dns-info',
              },
              'custom-domain': {
                title: t('set-domain'), description: t('type-in-your-custom-domain-here'),
                anchorId: 'settings-domain-custom',
              },
              'publish-changes': {
                title: t('save-changes'), description: t('publish-your-changes-live'),
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'invite-teammates': {
            state: getGuideState('invite-teammates', account),
            title: t('invite-your-teammates-to-explore-together'),
            steps: {
              'invite': {
                title: t('type-their-email'), description: t('send-your-teammate-an-invitation-by'),
                openPath: '/dashboard/settings/project/teammates',
                showButtonNext: t('thats-enough'),
                anchorId: 'settings-teammates-invite',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'install': {
            state: getGuideState('install', account),
            title: t('install-the-portal-on-your-website'),
            steps: {
              'copy': {
                title: t('link-it'), description: t('copy-the-following-html-into-your-website'),
                openPath: '/dashboard/settings/project/install',
                showButtonNext: t('got-it'),
                anchorId: 'settings-install-portal-code',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'add-payment': {
            // TODO the state should really be taken from billing
            // But at the moment it's not simple and this is good enough for now.
            state: getGuideState('add-payment', account),
            disableSkip: true,
            title: t('add-a-payment-card'),
            steps: {
              'review-plan': {
                title: t('review-plan'), description: t('look-over-your-current-plan'),
                openPath: '/dashboard/settings/account/billing',
                showButtonNext: true,
                anchorId: 'settings-billing-plan',
              },
              'add-payment-btn': {
                title: t('add-a-payment-here'),
                scrollTo: true,
                anchorId: 'settings-add-payment-open',
              },
              'add-payment-popup': {
                title: t('type-in-your-credit-card-information'),
                anchorId: 'settings-add-payment-popup',
              },
              'payment-review': {
                title: t('success'), description: t('thank-you-for-supporting-us'),
                showButtonNext: true,
                anchorId: 'settings-credit-card',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
        },
        groups: [
          { title: t('how-to-manage-feedback-roadmap-and-changelog'), guideIds: ['feedback-page', 'roadmap-page', 'changelog-page'] },
          { title: t('customize-your-portal'), guideIds: ['visibility', 'onboarding', 'custom-domain', 'visit-project'] },
          { title: t('start-collecting-feedback'), guideIds: ['invite-teammates', 'install', 'add-payment'] },
        ],
      }}
      onGuideCompleted={(guideId, guide) => setGuideState(guideId, TourDefinitionGuideState.Completed)}
      onGuideSkipped={(guideId, guide) => setGuideState(guideId, TourDefinitionGuideState.Skipped)}
      onGuideUnSkipped={(guideId, guide) => setGuideState(guideId, TourDefinitionGuideState.Available)}
    >
      {props.children}
    </TourProvider>
  );
};
ClearFlaskTourProvider.displayName = 'ClearFlaskTourProvider';
export default ClearFlaskTourProvider;
