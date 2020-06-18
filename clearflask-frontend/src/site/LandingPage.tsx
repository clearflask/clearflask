import { Container } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../api/client';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import { Device } from '../common/DeviceContainer';
import { description as collectDescription, title as collectTitle } from './CollectPage';
import { transparencyDescription, transparencyTitle } from './EngagePage';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';
import { prioritizationDescription, prioritizationTitle } from './PrioritizePage';

const styles = (theme: Theme) => createStyles({
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization()}
        {this.renderEngagement()}
        {this.renderCustomize()}
        {this.renderCaseStudies()}
        {this.renderSales()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='Product Feedback Solution for transparent organizations'
        description='An idea brainstorming tool with cost/benefit prioritization of user feedback to drive your product forward.'
        imagePath='/img/landing/hero.svg'
      />
    );
  }

  renderDemo() {
    const opts: CreateTemplateOptions = {
      ...createTemplateOptionsDefault,
      fundingAllowed: false,
    };
    return (
      <Container maxWidth='lg'>
        <Demo
          type='demoOnly'
          edgeType='outline'
          demoFixedHeight={500}
          template={templater => templater.demo(opts)}
          mock={mocker => mocker.templateMock(opts)}
          settings={{
            demoMenuAnimate: [
              { path: 'feedback' },
              { path: 'roadmap' },
            ],
          }}
        />
      </Container>
    );
  }

  onboardingDemoRef: React.RefObject<any> = React.createRef();
  renderCollectFeedback(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title={collectTitle}
          description={collectDescription}
          mirror={mirror}
          buttonTitle='Learn more'
          buttonLink='/product#collect'
          displayAlign='flex-start'
          demoFixedHeight={400}
          initialSubPath='/embed/demo'
          template={templater => templater.demoExplorer({
            allowCreate: { actionTitle: 'Suggest', actionTitleLong: 'Suggest an idea' },
            allowSearch: { enableSort: false, enableSearchText: true, enableSearchByCategory: false, enableSearchByStatus: false, enableSearchByTag: false },
          }, undefined, undefined, { descriptionTruncateLines: 2 }, { limit: 2 })}
          mock={mocker => mocker.demoFeedbackType()}
          settings={{
            demoForceExplorerCreateHasSpace: false,
            demoDisableExpand: true,
            // demoBlurryShadow: true,
            demoCreateAnimate: {
              title: 'Add Dark Mode',
              description: 'To reduce eye-strain, please add a dark mode option',
              similarSearchTerm: 'theme',
            },
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs' staggerHeight={0}>
          <Demo
            variant='content'
            type='column'
            title='Maximize conversion through frictionless onboarding'
            description='New user sign up is optimized for conversion with several choices of options for users to receive updates. The best experience is using Single Sign-On with your existing account system.'
            initialSubPath='/embed/demo'
            // demoFixedWidth={420}
            template={templater => {
              setInitSignupMethodsTemplate(templater);
              templater.styleWhite();
            }}
            controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
            demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
          />
          <Demo
            variant='content'
            type='column'
            title='Powerful search reduces duplicate submissions'
            description='Search engine powered by ElasticSearch ensures users do not create duplicate feedback.'
            initialSubPath='/embed/demo'
            scale={0.7}
            template={templater => {
              templater.demo();
              templater.demoExplorer({
                search: { limit: 4 },
                allowCreate: undefined,
                allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
              }, undefined, true);
            }}
            mock={mocker => mocker.demoExplorer()}
            settings={{
              demoBlurryShadow: true,
              demoSearchAnimate: [{
                term: 'Trending',
                update: { sortBy: Client.IdeaSearchSortByEnum.Trending },
              }, {
                term: 'Dark Mode',
                update: { searchText: 'Dark Mode' },
              }],
            }}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderPrioritization(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title={prioritizationTitle}
          description={prioritizationDescription}
          mirror={mirror}
          buttonTitle='See the credit system'
          buttonLink='/product#prioritize'
          demoFixedHeight={300}
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
        />
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
            description='Distribute credits to your users based on their value as a customer or monetary contribution. Let them fine-tune prioritization on their own.'
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
      </React.Fragment>
    );
  }

  renderCaseStudies() {
    return (
      <HorizontalPanels wrapBelow='md' maxWidth='lg' maxContentWidth='xs'>
        <BlockContent
          variant='content'
          title='SAAS product support and feedback'
          description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          buttonTitle='See case study and demo'
          buttonLink='/case-study#saas'
        />
        <BlockContent
          variant='content'
          title='Open-Source community-funded product'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See case study and demo'
          buttonLink='/case-study#open-source'
        />
        <BlockContent
          variant='content'
          title='Mobile App monetization strategy'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See case study and demo'
          buttonLink='/case-study#mobile-social-media'
        />
      </HorizontalPanels>
    );
  }

  renderEngagement(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demo
          title={transparencyTitle}
          description={transparencyDescription}
          buttonTitle='See how'
          buttonLink='/product#engage'
          mirror={mirror}
          initialSubPath='/embed/demo'
          demoFixedHeight={300}
          scale={0.7}
          template={templater => templater.demoBoardPreset('development')}
          mock={mocker => mocker.demoBoard([
            { status: '0', extra: { voteValue: 14, expressions: { '❤️': 4, '🚀': 1 } } },
            { status: '0', extra: { voteValue: 7, expressions: { '👍': 1, '😕': 2 } } },
            { status: '0', extra: { voteValue: 2, expressions: { '👍': 1 } } },
            { status: '1', extra: { funded: 7800, fundGoal: 9000, fundersCount: 12, expressions: { '😍': 2 } } },
            { status: '1', extra: { funded: 500, fundGoal: 5000, fundersCount: 1, expressions: { '👀': 1 } } },
            { status: '2', extra: { funded: 6700, fundGoal: 5000, fundersCount: 32, } },
            { status: '2', extra: { funded: 24300, fundGoal: 20000, fundersCount: 62 } },
          ])}
          settings={{
            demoBlurryShadow: true,
          }}
        />
      </React.Fragment>
    );
  }

  renderCustomize(mirror?: boolean) {
    return (
      <React.Fragment>
        <Block
          title='Make it your own'
          description='Custom workflows, prioritization and branding to fit your needs.'
          mirror={mirror}
          buttonTitle='Explore options'
          buttonLink='/customize'
        />
      </React.Fragment>
    );
  }

  renderSales(mirror?: boolean) {
    return (
      <Block
        title='Every customer is different'
        description='Talk to our sales for a demo walkthrough and to determine how our solution can be customized for your needs.'
        buttonTitle='Get in touch'
        buttonLink='/contact/sales'
        mirror={mirror}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
