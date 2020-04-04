import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { loremIpsum } from "lorem-ipsum";
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import CommentList from '../app/comps/CommentList';
import Demo from './landing/Demo';
import Hero from './landing/Hero';

const styles = (theme: Theme) => createStyles({
});

class TransparencyPage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderThread()}
        {this.renderRoadmap()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='transparency'
        description='.'
        imagePath='/img/landing/transparency.svg'
      />
    );
  }

  renderThread(mirror?: boolean) {
    return (
      <Demo
        title='Organized discussion threads with your customers'
        description='Using threaded comments, keep track of discussion'
        mirror={mirror}
        scale={0.7}
        template={templater => templater.demoCategory()}
        mock={(mocker, config) => mocker.mockIdea(config.content.categories[0], undefined, undefined, { ideaId: 'idea' }, true)
          .then(idea => mocker.mockDetailedComments([
            {
              content: 'We should also consider adding an audio captcha for blind and visually impaired users', author: 'John', children: [
                {
                  content: 'The problem with audio captchas is that they are usually the easiest to break by spammers', author: 'Charlotte', children: [
                    {
                      content: 'We can always disable them later', author: 'John'
                    },
                  ]
                },
                {
                  content: 'Ah yes, the AudioCaptcha service seems to be a good offer', author: 'Daisy', children: [
                    {
                      content: 'The pricing seems a bit high', author: 'John', children: [
                        { content: 'Let me contact them to see if we can get a better price', author: 'John' }
                      ]
                    }
                  ]
                },
              ]
            },
          ], idea)
            .then(() => mocker.mockLoggedIn()))}
        demo={project => (
          <Provider store={project.server.getStore()}>
            <CommentList
              server={project.server}
              ideaId='idea'
              expectedCommentCount={1}
              logIn={() => Promise.resolve()}
              // TODO make commenting work in demo
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
        title='Roadmap'
        description=''
        mirror={mirror}
        initialSubPath='/embed/demo'
        scale={0.7}
        template={templater => templater.demoBoard('Roadmap', [
          { title: 'Planned' },
          { title: 'In Progress' },
          { title: 'Recently Completed' },
        ])}
        mock={mocker => mocker.demoBoard([
          { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '0', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '1', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '2', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '2', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
          { status: '2', title: loremIpsum({ units: 'words', count: Math.round(Math.random() * 10 + 3) }) },
        ])}
      // controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(TransparencyPage);
