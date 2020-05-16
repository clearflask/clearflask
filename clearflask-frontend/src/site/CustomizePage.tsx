import { Container, Grid } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import AndroidIcon from '@material-ui/icons/Android';
import AppleIcon from '@material-ui/icons/Apple';
import BrightnessIcon from '@material-ui/icons/Brightness4';
import CommentIcon from '@material-ui/icons/Comment';
import EmailIcon from '@material-ui/icons/Email';
import EmojiEmotionsIcon from '@material-ui/icons/EmojiEmotions';
import AnonymousIcon from '@material-ui/icons/Help';
import LibraryAddCheckIcon from '@material-ui/icons/LibraryAddCheck';
import LinkIcon from '@material-ui/icons/Link';
import TaggingIcon from '@material-ui/icons/LocalOffer';
import MoneyIcon from '@material-ui/icons/Money';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import PaletteIcon from '@material-ui/icons/Palette';
import PeopleAltIcon from '@material-ui/icons/PeopleAlt';
import PolicyIcon from '@material-ui/icons/Policy';
import ReplyAllIcon from '@material-ui/icons/ReplyAll';
import SearchIcon from '@material-ui/icons/Search';
import ThumbsUpDownIcon from '@material-ui/icons/ThumbsUpDown';
import BrowserIcon from '@material-ui/icons/Web';
import React, { Component } from 'react';
import DividerCorner from '../app/utils/DividerCorner';
import { Device } from '../common/DeviceContainer';
import BlockContent from './landing/BlockContent';
import Demo from './landing/Demo';
import Feature from './landing/Feature';
import Hero from './landing/Hero';
import HorizontalPanels from './landing/HorizontalPanels';
import OnboardingControls, { setInitSignupMethodsTemplate } from './landing/OnboardingControls';
import OnboardingDemo from './landing/OnboardingDemo';

export const featuresTitle = 'Wide selection of features to fit your needs';
export const featuresDescription = '';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(4),
  },
  grid: {
    margin: theme.spacing(4),
  },
});

class CustomizePage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.page}>
        <Hero
          title={featuresTitle}
          description={featuresDescription}
          imagePath='/img/landing/features.svg'
        />
        {this.renderPanels()}
        {this.renderOnboarding()}
        {this.renderFeatures()}
      </div>
    );
  }

  renderFeatures(mirror?: boolean) {
    return (
      <Container maxWidth='md'>
        <DividerCorner title='Collect ideas'>
          <Grid container className={this.props.classes.grid}>
            <Feature icon={<TaggingIcon />} title='Tagging' description='Custom tags helps you organize' />
            <Feature icon={<CommentIcon />} title='Threaded comments' description='Organized discussion using threaded comments' />
            <Feature icon={<AnonymousIcon />} title='Anonymous' description='Allow submission without sign up' />
            <Feature beta icon={<PeopleAltIcon />} title='SSO' description='Single sign-on to identify your users seamlessly' />
          </Grid>
        </DividerCorner>
        <DividerCorner title='Prioritization'>
          <Grid container className={this.props.classes.grid}>
            <Feature icon={<MoneyIcon />} title='Credit system' description='Credits are distributed to users based on their value. Users assign credits to ideas.' />
            <Feature icon={<ThumbsUpDownIcon />} title='Voting' description='Simple upvoting (and downvoting) prioritizes demand' />
            <Feature icon={<EmojiEmotionsIcon />} title='Expressions' description='👍❤️😆😮😥😠' />
            <Feature icon={<LibraryAddCheckIcon />} title='Custom Statuses' description='Customize statuses with assignable rules' />
            <Feature icon={<SearchIcon />} title='Powerful search' description='Elasticsearch engine to prevent submission of duplicate ideas' />
          </Grid>
        </DividerCorner>
        <DividerCorner title='User feedback'>
          <Grid container className={this.props.classes.grid}>
            <Feature icon={<ReplyAllIcon />} title='Response' description='Quick public responses will notify subscribed users and remain visible' />
            <Feature icon={<EmailIcon />} title='Email' description='Keep your users updated via Email' />
            <Feature icon={<BrowserIcon />} title='Browser Push' description='Keep your users updated via Browser Push' />
            <Feature beta icon={<AndroidIcon />} title='Android Push' description='Keep your users updated via Android Push' />
            <Feature beta icon={<AppleIcon />} title='Apple Push' description='Keep your users updated via Apple Push' />
            <Feature beta icon={<AppleIcon />} title='Sign in with Apple' description='Let your users sign in with Apple' />
          </Grid>
        </DividerCorner>
        <DividerCorner title='Customization'>
          <Grid container className={this.props.classes.grid}>
            <Feature icon={<LinkIcon />} title='Branding' description='Show off your logo and link your users back to your website' />
            <Feature icon={<BrightnessIcon />} title='Dark Mode' description='Invert colors to reduce eye-strain and match your style' />
            <Feature icon={<PaletteIcon />} title='Palette and Fonts' description='Change the colors and fonts to match your style' />
            <Feature icon={<PolicyIcon />} title='Custom Terms' description='Link your own Terms and Privacy policy for users to accept' />
            <Feature icon={<MoreHorizIcon />} title='Need more?' description='We love customization, let us know!' />
          </Grid>
        </DividerCorner>
      </Container>
    );
  }

  renderPanels(mirror?: boolean) {
    return (
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
    );
  }

  onboardingDemoRef: React.RefObject<any> = React.createRef();
  renderOnboarding(mirror?: boolean) {
    return (
      <Demo
        mirror={mirror}
        title='Notify users when their wishes are fulfilled'
        description='It is important to keep a communication channel from users leaving feedback. To minimize friction, users can choose between browser push notifications, mobile push or standard email.'
        initialSubPath='/embed/demo'
        template={templater => setInitSignupMethodsTemplate(templater)}
        controls={project => (<OnboardingControls onboardingDemoRef={this.onboardingDemoRef} templater={project.templater} />)}
        demo={project => (<OnboardingDemo defaultDevice={Device.Desktop} innerRef={this.onboardingDemoRef} server={project.server} />)}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(CustomizePage);
