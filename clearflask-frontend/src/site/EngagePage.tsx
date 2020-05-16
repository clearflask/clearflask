import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import CommentList from '../app/comps/CommentList';
import Block from './landing/Block';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import RoadmapControls from './landing/RoadmapControls';

export const transparencyTitle = 'Create a community around your product roadmap';
export const transparencyDescription = 'Inform your users of your progress at every step with updates and a transparent roadmap. Let them be involved in your decision making and make them feel valued.';

const styles = (theme: Theme) => createStyles({
});

class EngagePage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderRoadmap()}
        {this.renderDiscussion()}
        {this.renderNotifications()}
        {this.renderThread()}
        {this.renderSales(true)}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title={transparencyTitle}
        description={transparencyDescription}
        imagePath='/img/landing/transparency.svg'
      />
    );
  }

  renderThread(mirror?: boolean) {
    return (
      <Demo
        title='Organized discussion threads'
        description='Manage parallel discussions and side-conversations easily using threaded comments'
        mirror={mirror}
        scale={0.7}
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
      // controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
      />
    );
  }
  renderRoadmap(mirror?: boolean) {
    return (
      // TODO add example roadmaps of:
      // - Software development workflow: Planned, In Progress, Recently completed
      // - Crowdfunding: Gathering feedback, Funding, Funded
      // - Custom (language courses): Gaining traction, Beta, Public
      // - Custom (Game ideas): Semi-finals, Selected
      <Demo
        title='Show off your progress with a roadmap'
        description='Customizable roadmaps lets you organize your process. Get your users excited about upcoming improvements.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        scale={0.7}
        type='largeDemo'
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
        controls={project => (<RoadmapControls templater={project.templater} />)}
      />
    );
  }

  renderDiscussion(mirror?: boolean) {
    return (
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
    );
  }

  renderNotifications(mirror?: boolean) {
    return (
      <Block
        title='Admin replies and notifications'
        description='asdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf adasdfasfdsa fasd fdas fads ads asdf ad'
        mirror={mirror}
      />
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

export default withStyles(styles, { withTheme: true })(EngagePage);
