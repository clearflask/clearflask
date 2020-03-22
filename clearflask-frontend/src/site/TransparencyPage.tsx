import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import Placeholder from './landing/Placeholder';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';

const styles = (theme: Theme) => createStyles({
});

class TransparencyPage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderRoadmap()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title='transparency'
        description='.'
        image={(<Placeholder width={500} height={350} />)}
      />
    );
  }

  renderRoadmap(mirror?: boolean) {
    return (
      // TODO add example roadmaps of:
      // - Software development workflow: Planned, In Progress, Recently completed
      // - Custom: 
      <Demo
        title='Roadmap'
        description=''
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('vote')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(TransparencyPage);
