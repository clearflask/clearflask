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
import Feature from './landing/Feature';



const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(4),
  },
  grid: {
    margin: theme.spacing(4),
  },
});

class LandingPage extends Component<WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.page}>
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
              <Feature icon={<ReplyAllIcon />} title='Response' description='Quickly respond to ideas' />
              <Feature icon={<EmailIcon />} title='Email' description='Keep your users updated via Email' />
              <Feature icon={<AndroidIcon />} title='Android Push' description='Keep your users updated via Android Push' />
              <Feature beta icon={<AppleIcon />} title='Apple Push' description='Keep your users updated via Apple Push' />
              <Feature beta icon={<BrowserIcon />} title='Browser Push' description='Keep your users updated via Browser Push' />
            </Grid>
          </DividerCorner>
          <DividerCorner title='Customization'>
            <Grid container className={this.props.classes.grid}>
              <Feature icon={<LinkIcon />} title='Logo and Website' description='Show off your logo and link your users back to your website' />
              <Feature icon={<BrightnessIcon />} title='Dark Mode' description='Invert colors to reduce eye-strain and match your style' />
              <Feature icon={<PaletteIcon />} title='Palette and Fonts' description='Change the colors and fonts to match your style' />
              <Feature icon={<PolicyIcon />} title='Terms and Privacy Policy' description='Link your own legal documents' />
              <Feature icon={<MoreHorizIcon />} title='Need more?' description='We love customization, let us know!' />
            </Grid>
          </DividerCorner>
        </Container>
      </div>
    );
  }

  renderFeature() {
    return
  }
}

export default withStyles(styles, { withTheme: true })(LandingPage);
