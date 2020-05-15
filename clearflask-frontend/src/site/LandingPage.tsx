import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import * as Client from '../api/client';
import CommentList from '../app/comps/CommentList';
import { CreateTemplateOptions, createTemplateOptionsDefault } from '../common/config/configTemplater';
import { description as collectDescription, title as collectTitle } from './CollectPage';
import { transparencyDescription, transparencyTitle } from './EngagePage';
import Block from './landing/Block';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Demos from './landing/Demos';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import { prioritizationDescription, prioritizationTitle } from './PrioritizePage';

const styles = (theme: Theme) => createStyles({
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderCollectFeedback()}
        {this.renderPrioritization(true)}
        {this.renderCaseStudies()}
        {this.renderEngagement(true)}
        {this.renderCustomize()}
        {this.renderSales(true)}
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

  renderCollectFeedback(mirror?: boolean) {
    const opts: CreateTemplateOptions = {
      ...createTemplateOptionsDefault,
      fundingAllowed: false,
    };
    return (
      <React.Fragment>
        <Demo
          title={collectTitle}
          description={collectDescription}
          mirror={mirror}
          type='largeDemo'
          edgeType='outline'
          edgeSpacing
          // scale={0.7}
          demoFixedHeight={500}
          template={templater => templater.demo(opts)}
          mock={mocker => mocker.templateMock(opts)}
          settings={{
            demoMenuAnimate: [
              { path: '' },
              { path: 'ideas' },
            ],
          }}
        />
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
          buttonTitle='Learn about prioritization'
          buttonLink='/prioritization'
          initialSubPath='/embed/demo'
          template={templater => templater.demoPrioritization('all')}
          mock={mocker => mocker.demoPrioritization()}
          settings={{
            demoFlashPostVotingControls: true,
          }}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='md' maxContentWidth='xs' staggerHeight={0}>
          <Demo
            variant='content'
            type='column'
            title='Keep it simple with voting and expressions'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See how it looks'
            buttonLink='/prioritization#simple-voting'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('voteAndExpress')}
            mock={mocker => mocker.demoPrioritization()}
            settings={{
              demoVotingExpressionsAnimate: [
                { type: 'vote', upvote: true },
                { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Set } },
                { type: 'vote', upvote: false },
                { type: 'express', update: { expression: '👍', action: Client.IdeaVoteUpdateExpressionsActionEnum.Remove } },
              ],
            }}
            demoFixedHeight={450}
            containerPortal
          />
          <Demo
            variant='content'
            type='column'
            title='Credit system for advanced prioritization'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See the benefits'
            buttonLink='/prioritization#crowdfunding'
            initialSubPath='/embed/demo'
            template={templater => templater.demoPrioritization('fund')}
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
          title='Support and Feedback for SAAS companies'
          description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
          buttonTitle='See Demo'
          buttonLink='/case-study#saas'
        />
        <BlockContent
          variant='content'
          title='Community-funded Open-Source product'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See Demo'
          buttonLink='/case-study#open-source'
        />
        <BlockContent
          variant='content'
          title='Mobile App monetization strategy'
          description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
          buttonTitle='See Demo'
          buttonLink='/case-study#mobile-social-media'
        />
      </HorizontalPanels>
    );
  }

  renderEngagement(mirror?: boolean) {
    return (
      <React.Fragment>
        <Demos
          title={transparencyTitle}
          description={transparencyDescription}
          buttonTitle='Learn about transparency'
          buttonLink='/transparency'
          mirror={mirror}
          stackProps={{
            contentSpacingVertical: 100,
            ascendingLevel: true,
            topLeftToBottomRight: true,
            raiseOnHover: true,
          }}
          demos={[
            {
              scale: 0.7,
              template: templater => {
                const categoryId = templater.demoCategory();
                templater.supportVoting(categoryId, true);
                templater.workflowFeatures(categoryId);
                templater.styleWhite();
              },
              mock: (mocker, config) => mocker.mockFakeIdeaWithComments('ideaid')
                .then(() => mocker.mockLoggedIn()),
              initialSubPath: '/embed/post/ideaid',
            },
            {
              initialSubPath: '/embed/demo',
              scale: 0.5,
              template: templater => templater.demoBoardPreset('development'),
              mock: mocker => mocker.demoBoard([
                { status: '0', extra: { voteValue: 14, expressions: { '❤️': 4, '🚀': 1 } } },
                { status: '0', extra: { voteValue: 7, expressions: { '👍': 1, '😕': 2 } } },
                { status: '0', extra: { voteValue: 2, expressions: { '👍': 1 } } },
                { status: '1', extra: { funded: 7800, fundGoal: 9000, fundersCount: 12, expressions: { '😍': 2 } } },
                { status: '1', extra: { funded: 500, fundGoal: 5000, fundersCount: 1, expressions: { '👀': 1 } } },
                { status: '2', extra: { funded: 6700, fundGoal: 5000, fundersCount: 32, } },
                { status: '2', extra: { funded: 24300, fundGoal: 20000, fundersCount: 62 } },
              ]),
              settings: {
                demoBlurryShadow: true,
              },
            },
          ]}
        />
        <HorizontalPanels wrapBelow='md' maxWidth='xl' maxContentWidth='xs' staggerHeight={50}>
          <BlockContent
            variant='content'
            title='Roadmap'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#roadmap'
          />
          <BlockContent
            variant='content'
            title='Admin replies and notifications'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/engagement#admin-reply'
          />
          <Demo
            variant='content'
            type='column'
            title='Organized discussion with threaded comments'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/engagement#notifications'
            scale={0.5}
            template={templater => templater.demoCategory()}
            mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaId')
              .then(() => mocker.mockLoggedIn())}
            demo={project => (
              <Provider store={project.server.getStore()}>
                <CommentList
                  server={project.server}
                  ideaId='ideaId'
                  expectedCommentCount={1}
                  logIn={() => Promise.resolve()}
                  newCommentsAllowed
                  loggedInUser={project.server.getStore().getState().users.loggedIn.user}
                />
              </Provider>
            )}
          />
        </HorizontalPanels>
      </React.Fragment>
    );
  }

  renderCustomize(mirror?: boolean) {
    return (
      <React.Fragment>
        <Block
          title='Customization afasdfsdaf fas fdsasf sadf dsaa fs'
          description='fasdfsdaf asf d fdsafds fasf asf asasf asf fa fasd  sad as as asfd asfd'
          mirror={mirror}
          buttonTitle='See templates'
          buttonLink='/customize'
        />
        <HorizontalPanels wrapBelow='sm' maxWidth='xl' maxContentWidth='xs' staggerHeight={50}>
          <BlockContent
            variant='content'
            title='Predefined templates'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#templates'
          />
          <BlockContent
            variant='content'
            title='Content types'
            description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
            buttonTitle='See More'
            buttonLink='/customize#content'
          />
          <BlockContent
            variant='content'
            title='Site layout'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#layout'
          />
          <Demo
            variant='content'
            type='column'
            title='Look and feel'
            description='asdftqegr tre qrg rw gwer grg ewg erg reg rg ewg weg re greg r we sg gwe er ge ger edfg dfs gsdf '
            buttonTitle='See More'
            buttonLink='/customize#look-and-feel'
            initialSubPath={'/post/ideaid'}
            scale={0.7}
            template={templater => {
              const categoryId = templater.demoCategory();
              templater.supportVoting(categoryId, true);
              templater.workflowFeatures(categoryId);
              templater.styleDark();
              // templater.setFontFamily('"Comic Sans MS", cursive, sans-serif');
              templater.setAppName('Smotana', 'https://smotana.com/favicon.ico');
            }}
            mock={(mocker, config) => mocker.mockFakeIdeaWithComments('ideaid')
              .then(() => mocker.mockLoggedIn())}
          />
        </HorizontalPanels>
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
