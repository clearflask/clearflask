import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../api/client';
import Block from './landing/Block';
import Demo from './landing/Demo';
import HorizontalPanels from './landing/HorizontalPanels';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';

export const prioritizationTitle = 'Give your valuable customers a proportionate voice';
export const prioritizationDescription = 'Assign voting power based on customer value and let them prioritize your suggestion box. Your users will love knowing their voice has been heard.';

const styles = (theme: Theme) => createStyles({
  grid: {
    margin: theme.spacing(4),
  },
});

class PrioritizePage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderTypesOfVoting()}
        {this.renderCreditIntegration()}
        {/* TODO {this.renderCreditUseCases()} */}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Demo
        title={prioritizationTitle}
        description={prioritizationDescription}
        type='hero'
        mirror={true}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('all')}
        mock={mocker => mocker.demoPrioritization()}
        settings={{
          demoFlashPostVotingControls: true,
        }}
      />
    );
  }

  renderTypesOfVoting() {
    return (
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={200}>
        <Demo
          variant='content'
          type='column'
          title='Keep it simple with voting'
          description='Most common and simplest to understand by users. Customer value and segmentation can be applied behind the scenes.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('vote')}
          controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoVotingExpressionsAnimate: [
              { type: 'vote', upvote: true },
            ],
          }}
          demoFixedHeight={150}
          containerPortal
        />
        <Demo
          variant='content'
          type='column'
          title='Expressions for a wider range of feedback'
          description='When you cannnot accurately express your feelings with simple upvotes, weighted emoji expressions are here to help.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('express')}
          controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoVotingExpressionsAnimate: [
              { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Set } },
              { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Remove } },
            ],
          }}
          demoFixedHeight={420}
          containerPortal
        />
        <Demo
          variant='content'
          type='column'
          title='Credit system for advanced prioritization'
          description='Distribute credits to your users based on their value as a customer. Let them fine-tune prioritization on their own.'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('fund')}
          controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
          mock={mocker => mocker.demoPrioritization()}
          demoFixedHeight={450}
          containerPortal
          settings={{
            demoFundingControlAnimate: [
              { index: 0, fundDiff: 20 },
              { index: 1, fundDiff: -30 },
              { index: 2, fundDiff: 20 },
            ],
          }}
        />
      </HorizontalPanels>
    );
  }

  renderCreditIntegration() {
    return (
      <React.Fragment>
        <Block
          variant='heading'
          // type='column'
          title='Integrate with your credit system'
          description='When your customer provides value to you, automatically issue credits to their account on ClearFlask.'
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
          <Block
            variant='content'
            type='column'
            title='Payment Provider: Stripe, Apple Store, Play Store'
            marker='BETA'
            description='When a customer completes a purchase, issue them credit.'
          />
          <Block
            variant='content'
            type='column'
            title='Donation framework: Patreon, OpenCollective'
            marker='BETA'
            description='Allow your most valuable supporters voice their suggestion.'
          />
          <Block
            variant='content'
            type='column'
            title='Custom source via API'
            description='Manage credits with granular control via our API'
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCreditUseCases(mirror?: boolean) {
    return (
      <Block
        title='Credit use cases'
        description='TODO
        Showcase use cases: Commercial product, SAAS, Donation-based
         TODO Integrate with paying customers, Patreon, donation, mobile purchases, bounties, crowdfunding, loyalty, game rank'
        mirror={mirror}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizePage);
