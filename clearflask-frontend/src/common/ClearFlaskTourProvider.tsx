// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
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
export const setGuideState = async (guideId: string, state: TourDefinitionGuideState) => {
  (await ServerAdmin.get().dispatchAdmin()).accountUpdateAdmin({
    accountUpdateAdmin: {
      attrs: {
        [getGuideAttrId(guideId)]: state,
      }
    },
  });
}

const ClearFlaskTourProvider = (props: {
  children?: any;
  feedback?: FeedbackInstance;
  roadmap?: RoadmapInstance;
  changelog?: ChangelogInstance;
}) => {
  const account = useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);
  return (
    <TourProvider
      tour={{
        guides: {
          ...(!props.feedback ? {} : {
            'feedback-page': {
              state: getGuideState('feedback-page', account),
              title: 'Manage incoming feedback',
              steps: {
                'create-btn': {
                  title: 'Create feedback form', description: "First let's capture feedback from a customer.",
                  openPath: '/dashboard/feedback',
                  anchorId: 'feedback-page-create-btn',
                },
                'edit-title': {
                  title: 'Describe feedback', description: 'Create an informative summary (ie "Product Tour is too boring")',
                  anchorId: 'post-create-form-edit-title',
                },
                'submit-feedback': {
                  title: 'Submit feedback', description: 'Save the newly created feedback',
                  anchorId: 'post-create-form-submit-btn',
                },
                'convert-to-task': {
                  title: 'Convert feedback into tasks', description: 'Creates a task and places it on your roadmap. Feedback is marked as Accepted, linked to your task, and all subscribers notified.',
                  anchorId: 'feedback-page-convert-to-task',
                  showButtonNext: true,
                },
                'merge-or-link': {
                  title: 'Combine duplicates', description: 'For duplicate or related ideas, merge together with existing feedback or link it to an existing task.',
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
              title: 'Prioritize your roadmap',
              steps: {
                ...(!props.roadmap.statusIdBacklog ? {} : {
                  'show-backlog': {
                    title: 'Backlog of ideas', description: 'These are tasks that are in an ideation stage. They are shown to users to gather feedback but do not show up in the public roadmap.',
                    openPath: '/dashboard/roadmap',
                    showButtonNext: true,
                    anchorId: 'roadmap-page-section-backlog',
                  },
                }),
                'show-roadmap': {
                  title: 'Public roadmap', description: 'This is where you show off your roadmap to your users. Feel free to adjust the titles, colors and columns in the settings.',
                  openPath: '/dashboard/roadmap',
                  showButtonNext: true,
                  anchorId: 'roadmap-page-section-roadmap',
                },
                ...(!props.roadmap.statusIdCompleted ? {} : {
                  'show-completed': {
                    title: 'Completed tasks', description: 'After your finish a task, drop it in here.' + (props.changelog ? ' We will combine these into a changelog entry in the next tutorial.' : ''),
                    showButtonNext: true,
                    anchorId: 'roadmap-page-section-completed',
                  },
                }),
                'create-task': {
                  title: 'Create a task', description: "Let's create your first task on the public roadmap.",
                  anchorId: 'roadmap-page-section-roadmap-create-btn',
                },
                'edit-title': {
                  title: 'Describe task', description: 'Create a nice title for your task. (ie "Fix all of the bugs")',
                  anchorId: 'post-create-form-edit-title',
                },
                'submit-feedback': {
                  title: 'Submit feedback', description: 'Save the newly created feedback',
                  anchorId: 'post-create-form-submit-btn',
                },
                'public-view': {
                  title: 'Success!', description: 'Check out your task in a public view',
                  anchorId: 'roadmap-page-public-view',
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          ...(!props.changelog ? {} : {
            'changelog-page': {
              state: getGuideState('changelog-page', account),
              title: 'Create a changelog entry',
              steps: {
                'create-btn': {
                  title: 'Create changelog', description: "Let's create your first changelog",
                  openPath: '/dashboard/changelog',
                  anchorId: 'changelog-page-create-btn',
                },
                'edit-title': {
                  title: 'Describe your change', description: 'Create your changelog title such as "August update" or "Version 2.0.4"',
                  anchorId: 'post-create-form-edit-title',
                },
                'link-to-task': {
                  title: 'Link with tasks', description: 'Optionally you can link to your completed tasks or feedback here',
                  anchorId: 'post-create-form-link-to-task',
                },
                'save-draft': {
                  title: 'Save as a draft', description: 'Useful if you are not quite ready to publish yet. Drafts are private to you only. I keep a draft open at all times and add any completed tasks on the go.',
                  anchorId: 'post-create-form-save-draft',
                },
                'submit-feedback': {
                  title: 'Submit feedback', description: 'Save the newly created feedback',
                  anchorId: 'post-create-form-submit-btn',
                },
                'public-view': {
                  title: 'Success!', description: 'Check out your changelog in a public view',
                  anchorId: 'changelog-page-public-view',
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          'onboarding': {
            state: getGuideState('onboarding', account),
            title: 'Public/private visibility and Onboarding users',
            steps: {
              'visibility': {
                title: 'Visibility', description: 'Choose whether you want to have your portal publicly available.',
                openPath: '/dashboard/settings/project/onboard',
                showButtonNext: 'Skip',
                anchorId: 'settings-onboard-visibility',
              },
              'methods': {
                title: 'Onboarding', description: 'Choose how your users can sign-up here',
                showButtonNext: true,
                anchorId: 'settings-onboard-methods',
              },
              'publish-changes': {
                title: 'Save changes', description: 'Publish your changes live.',
                anchorId: 'settings-publish-changes',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'custom-domain': {
            state: getGuideState('custom-domain', account),
            title: 'Setup a custom domain for your portal',
            steps: {
              'dns-settings': {
                title: 'Visibility', description: 'Choose whether you want to have your portal publicly available.',
                openPath: '/dashboard/settings/project/onboard',
                showButtonNext: 'Skip',
                anchorId: 'settings-onboard-visibility',
              },
              'custom-domain': {
                title: 'Onboarding', description: 'Choose how your users can sign-up here',
                showButtonNext: true,
                anchorId: 'settings-onboard-methods',
              },
              'publish-changes': {
                title: 'Save changes', description: 'Publish your changes live.',
                anchorId: 'settings-publish-changes',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'install': {
            state: getGuideState('install', account),
            title: 'Install the portal on your website',
            steps: {
              'copy': {
                title: 'Link it', description: 'Copy the following HTML into your website.',
                openPath: '/dashboard/settings/project/install',
                showButtonNext: true,
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
            title: 'Add a payment card to continue using our service',
            steps: {
              'review-plan': {
                title: 'Review plan', description: 'Look over your current plan',
                openPath: '/dashboard/settings/account/billing',
                showButtonNext: true,
                anchorId: 'settings-billing-plan',
              },
              'add-payment': {
                title: 'Add payment', description: 'Look over your current plan',
                scrollTo: true,
                anchorId: 'settings-billing-plan',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
        },
        groups: [
          { title: 'Getting started', guideIds: ['feedback-page', 'roadmap-page', 'changelog-page'] },
          { title: 'Project customization', guideIds: ['onboarding', 'custom-domain', 'install'] },
          { title: 'Account', guideIds: ['invite-teammates', 'add-payment'] },
        ],
      }}
      onGuideCompleted={(guideId, guide) => setGuideState(guideId, TourDefinitionGuideState.Completed)}
      onGuideSkipped={(guideId, guide) => setGuideState(guideId, TourDefinitionGuideState.Skipped)}
    >
      {props.children}
    </TourProvider>
  );
};
ClearFlaskTourProvider.displayName = 'ClearFlaskTourProvider';
export default ClearFlaskTourProvider;
