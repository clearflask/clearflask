import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import Block from './landing/Block';
import Demo from './landing/Demo';
import Hero from './landing/Hero';
import PrioritizationControlsCredits from './landing/PrioritizationControlsCredits';
import PrioritizationControlsExpressions from './landing/PrioritizationControlsExpressions';
import PrioritizationControlsVoting from './landing/PrioritizationControlsVoting';

export const prioritizationTitle = 'Give your customers a proportionate voice to drive your product';
export const prioritizationDescription = 'Assign each user voting power based on their value as a customer and let them prioritize your roadmap. Your users will love knowing their voice has been heard.';

const styles = (theme: Theme) => createStyles({
});

class PrioritizePage extends Component<WithStyles<typeof styles, true>> {
  render() {
    return (
      <React.Fragment>
        {this.renderHero()}
        {this.renderRewardCustomers()}
        {this.renderCredit(true)}
        {this.renderCreditUseCases()}
        {this.renderVoting(true)}
        {this.renderExpressions()}
      </React.Fragment>
    );
  }

  renderHero() {
    return (
      <Hero
        title={prioritizationTitle}
        description={prioritizationDescription}
        imagePath='/img/landing/prioritization.svg'
      />
    );
  }

  renderVoting(mirror?: boolean) {
    return (
      <Demo
        title='Voting ideas'
        description='Simple upvote/downvote system with all users having equal voting power.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('vote')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsVoting templater={project.templater} />)}
      />
    );
  }

  renderCredit(mirror?: boolean) {
    return (
      <Demo
        title='Crowd-funding your ideas with real or virtual currency'
        // description='Let your users prioritize ideas by distributing credits. Assign credits to your users based on their value as a customer.'
        description='Assign credits to your users based on their value as a customer and let them prioritize ideas by distributing those credits.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('fund')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsCredits templater={project.templater} />)}
      />
    );
  }

  renderRewardCustomers(mirror?: boolean) {
    return (
      <Block
        title='Reward valuable customers with proportionate voice'
        description='TODO Customer purchases (product purchase, subscription); loyalty, game rank'
        mirror={mirror}
        demo={'Picture of Scale, one side is voice the other is subscription, donation, purchases'}
      />
    );
  }

  renderCreditUseCases(mirror?: boolean) {
    return (
      <Block
        title='Credit use cases'
        description='TODO
        Commercial product, SAAS, Donation-based
         TODO Integrate with paying customers, Patreon, donation, mobile purchases, bounties, crowdfunding'
        mirror={mirror}
      />
    );
  }

  renderExpressions(mirror?: boolean) {
    return (
      <Demo
        title='Expressions'
        description='When you cannnot accurately express your feelings with simple upvotes, weighted emoji expressions is here to help.'
        mirror={mirror}
        initialSubPath='/embed/demo'
        template={templater => templater.demoPrioritization('express')}
        mock={mocker => mocker.demoPrioritization()}
        controls={project => (<PrioritizationControlsExpressions templater={project.templater} />)}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PrioritizePage);
