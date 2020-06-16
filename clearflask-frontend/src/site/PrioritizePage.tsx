import { Container, Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import MoneyIcon from '@material-ui/icons/Money';
import React, { Component } from 'react';
import * as Client from '../api/client';
import Block from './landing/Block';
import Demo from './landing/Demo';
import Feature from './landing/Feature';
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
        {this.renderHowDistributeCredits()}
        {this.renderCreditUseCases()}
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

  renderHowDistributeCredits() {
    return (
      <React.Fragment>
        <Block
          variant='heading'
          title='How should you distribute credits?'
          description='It is best to tie credits based on how valuable the customer is to you. Contact us for advice and to discuss which option is best for you.'
        />
        <Container maxWidth='md'>
          <Grid container className={this.props.classes.grid}>
            <Feature icon={<MoneyIcon />} title='Subscription-based' description='' />
            <Feature icon={<MoneyIcon />} title='In-app purchases' description='' />
            <Feature icon={<MoneyIcon />} title='Purchases' description='' />
            <Feature icon={<MoneyIcon />} title='Coffee' description='' />
            <Feature icon={<MoneyIcon />} title='Open-source' description='' />
            <Feature icon={<MoneyIcon />} title='SAAS' description='Depending on the subscription level, you may issue "Dev hours" for customers to choose where you should spend your time.' />
            <Feature icon={<MoneyIcon />} title='Mobile app' description='Assign spending power based on how much your customers spent on your app.' />
            <Feature icon={<MoneyIcon />} title='Crowd-funding' description='You can ask users to pay for ' />
            <Feature icon={<MoneyIcon />} title='Donations' description='Custom tags helps you organize' />
            <Feature icon={<MoneyIcon />} title='Wiki' description='Assign credits based on seniority or amount of work they have done' />
            <Feature icon={<MoneyIcon />} title='Game' description='In-game achievements can unlock more credits' />
          </Grid>
        </Container>
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
