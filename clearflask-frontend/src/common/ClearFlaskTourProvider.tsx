// SPDX-FileCopyrightText: 2019-2020 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { useTheme } from '@material-ui/core';
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
const setGuideState = async (guideId: string, state: TourDefinitionGuideState) => {
  (await ServerAdmin.get().dispatchAdmin()).accountUpdateAdmin({
    accountUpdateAdmin: {
      attrs: {
        [getGuideAttrId(guideId)]: state,
      }
    },
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
  const theme = useTheme();
  const account = useSelector<ReduxStateAdmin, Admin.AccountAdmin | undefined>(state => state.account.account.account, shallowEqual);
  return (
    <TourProvider
      tour={{
        /**
         * TODO:
         * - Import data
         * - Invite teammates
         */
        guides: {
          ...(!props.feedback ? {} : {
            'feedback-page': {
              state: getGuideState('feedback-page', account),
              title: 'Manage incoming feedback',
              steps: {
                'create-btn': {
                  title: 'Capture feedback', description: "First let's capture feedback from a customer.",
                  openPath: '/dashboard/feedback',
                  anchorId: 'feedback-page-create-btn',
                },
                'submit-feedback': {
                  title: 'Submit feedback', description: 'Save the newly created feedback',
                  anchorId: 'post-create-form-submit-btn',
                },
                'convert-to-task': {
                  title: 'Convert feedback into a task', description: 'Creates a task and places it on your roadmap. Feedback is marked as Accepted, linked to your task, and all subscribers notified.',
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
                'submit-task': {
                  title: 'Submit task', description: 'Save the newly created task',
                  anchorId: 'post-create-form-submit-btn',
                  showDelay: 500,
                },
                'drag-roadmap': {
                  title: 'Pick me up', description: 'And drag me around the roadmap.',
                  showButtonNext: 'I had enough',
                  anchorId: 'roadmap-page-selected-drag-me',
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
                'link-to-task': {
                  title: 'Link with tasks', description: 'Optionally you can link to your completed tasks or feedback here',
                  showButtonNext: true,
                  anchorId: 'post-create-form-link-to-task',
                },
                'save-draft': {
                  title: 'Save as a draft', description: 'Useful if you are not quite ready to publish yet. Drafts are private to you only. I keep a draft open at all times and add any completed tasks on the go.',
                  anchorId: 'post-create-form-save-draft',
                  showButtonNext: true,
                  zIndex: zb => zb.modal - 1,
                },
                'submit-feedback': {
                  title: 'Submit feedback', description: 'Save the newly created feedback',
                  showButtonNext: 'Got it',
                  anchorId: 'post-create-form-submit-btn',
                },
              },
              onComplete: { openPath: '/dashboard' },
            },
          }),
          'visit-project': {
            state: getGuideState('visit-project', account),
            title: 'Check out your portal',
            steps: {
              'visit-project': {
                title: 'Check it out over here', description: 'This will take you to the publicly accessible portal. If you set it to private, you will be asked to sign-in first.',
                anchorId: 'dashboard-visit-portal',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'visibility': {
            state: getGuideState('visibility', account),
            title: "Toggle portal's public visibility",
            steps: {
              'visibility': {
                title: 'Visibility', description: 'Choose whether you want to have your portal publicly available.',
                openPath: '/dashboard/settings/project/onboard',
                showButtonComplete: 'This is fine',
                anchorId: 'settings-onboard-visibility',
              },
              'publish-changes': {
                title: 'Save changes', description: 'Publish your changes live.',
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'onboarding': {
            state: getGuideState('onboarding', account),
            title: 'Choose how users can sign up',
            steps: {
              'methods': {
                title: 'Onboarding', description: 'Choose how your users can sign-up here',
                openPath: '/dashboard/settings/project/onboard',
                showButtonComplete: 'This is fine',
                anchorId: 'settings-onboard-methods',
              },
              'publish-changes': {
                title: 'Save changes', description: 'Publish your changes live.',
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'custom-domain': {
            state: getGuideState('custom-domain', account),
            title: 'Setup a custom domain for your portal',
            steps: {
              'dns-settings': {
                title: 'DNS settings', description: 'First you need to configure your DNS settings to point your domain "example.com" as a CNAME of "sni.clearflask.com"',
                openPath: '/dashboard/settings/project/domain',
                showButtonNext: 'Done',
                anchorId: 'settings-domain-dns-info',
              },
              'custom-domain': {
                title: 'Set domain', description: 'Type in your custom domain here.',
                anchorId: 'settings-domain-custom',
              },
              'publish-changes': {
                title: 'Save changes', description: 'Publish your changes live.',
                anchorId: 'settings-publish-changes',
                showDelay: 500,
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
          'invite-teammates': {
            state: getGuideState('invite-teammates', account),
            title: 'Invite your teammates to explore together',
            steps: {
              'invite': {
                title: 'Type their email', description: 'Send your teammate an invitation by email to join your project.',
                openPath: '/dashboard/settings/project/teammates',
                showButtonNext: "That's enough",
                anchorId: 'settings-teammates-invite',
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
                showButtonNext: 'Got it',
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
            title: 'Add a payment card',
            steps: {
              'review-plan': {
                title: 'Review plan', description: 'Look over your current plan',
                openPath: '/dashboard/settings/account/billing',
                showButtonNext: true,
                anchorId: 'settings-billing-plan',
              },
              'add-payment-btn': {
                title: 'Add a payment here',
                scrollTo: true,
                anchorId: 'settings-add-payment-open',
              },
              'add-payment-popup': {
                title: 'Type in your credit card information',
                anchorId: 'settings-add-payment-popup',
              },
              'payment-review': {
                title: 'Success!', description: 'Thank you for supporting ClearFlask',
                showButtonNext: true,
                anchorId: 'settings-credit-card',
              },
            },
            onComplete: { openPath: '/dashboard' },
          },
        },
        groups: [
          { title: 'How to manage feedback, roadmap and changelog', guideIds: ['feedback-page', 'roadmap-page', 'changelog-page'] },
          { title: 'Customize your portal', guideIds: ['visibility', 'onboarding', 'custom-domain', 'visit-project'] },
          { title: 'Start collecting feedback', guideIds: ['invite-teammates', 'install', 'add-payment'] },
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
