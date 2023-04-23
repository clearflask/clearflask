// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Grid, Typography } from '@material-ui/core';
import { Theme, WithStyles, createStyles, withStyles } from '@material-ui/core/styles';
import GithubIcon from '@material-ui/icons/GitHub';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import ServerAdmin from '../../api/serverAdmin';
import ImgIso from '../../common/ImgIso';
import Vidyard from '../../common/Vidyard';
import GoogleIcon from '../../common/icon/GoogleIcon';
import { OAuthFlow } from '../../common/util/oauthUtil';
import { redirectIso } from '../../common/util/routerUtil';

const styles = (theme: Theme) => createStyles({
  hero: {
    width: '100vw',
    minHeight: theme.vh(40),
    padding: `${theme.vh(10)}px 10vw`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  heroDescription: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  image: {
    width: '100%',
    [theme.breakpoints.up('md')]: {
      padding: theme.spacing(8),
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(8, 2),
    },
  },
  buttonsContainer: {
    display: 'flex',
    alignSelf: 'flex-end',
    margin: theme.spacing(4, 8),
    [theme.breakpoints.down('xs')]: {
      margin: theme.spacing(4, 4),
    },
  },
  buttonContainer: {
    display: 'flex',
    alignItems: 'stretch',
    '& > *:not(:first-child)': {
      marginLeft: 1,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
    '& > *:not(:last-child)': {
      marginRight: 0,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
  },
  buttonMain: {
    position: 'relative', // For remark
    fontWeight: 900,
  },
  buttonOauth: {
    minWidth: 0,
    paddingLeft: theme.spacing(1.5),
    paddingRight: theme.spacing(1.5),
  },
  button2: {
    marginRight: theme.spacing(2),
  },
  remark: {
    position: 'absolute',
    bottom: '-60%',
    left: '50%',
    transform: 'translateX(-50%)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
});

interface Props {
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  image?: Img;
  imagePath?: string;
  vidyard?: {
    image: Img;
    uuid: string;
  };
  mirror?: boolean;
  buttonTitle?: string;
  buttonLinkExt?: string;
  buttonLink?: string;
  buttonRemark?: React.ReactNode;
  buttonAddOauth?: boolean;
  button2Image?: string;
  button2Title?: string;
  button2LinkExt?: string;
  button2Link?: string;
  button2Icon?: React.ReactNode;
}
class Hero extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  readonly oauthFlow = new OAuthFlow({ accountType: 'admin', redirectPath: '/login' });

  render() {
    const imageSrc = this.props.image?.src || this.props.imagePath;
    const media = imageSrc ? (
      <ImgIso
        alt=''
        className={this.props.classes.image}
        src={imageSrc}
        aspectRatio={this.props.image?.aspectRatio}
        width={!this.props.image?.aspectRatio ? '100%' : undefined}
        maxWidth={this.props.image?.width}
        maxHeight={this.props.image?.height}
      />
    ) : (this.props.vidyard ? (
      <Vidyard
        className={this.props.classes.image}
        {...this.props.vidyard}
      />
    ) : undefined);
    return (
      <div className={classNames(this.props.classes.hero)}>
        <Grid container
          justify='center'
          wrap='wrap-reverse'
          alignItems='center'
          direction={!!this.props.mirror ? 'row-reverse' : undefined}
        >
          {media && (
            <Grid item xs={12} md={6}>
              {media}
            </Grid>
          )}
          <Grid item xs={12} md={6} lg={5} xl={4} className={this.props.classes.heroTextContainer}>
            <Typography variant='h3' component='h1'>
              {this.props.title}
            </Typography>
            <Typography variant='h5' component='h2' className={this.props.classes.heroDescription}>
              {this.props.description}
            </Typography>
            {this.props.buttonTitle && (
              <div className={this.props.classes.buttonsContainer}>
                {!!this.props.button2Title && (
                  <Button
                    variant='outlined'
                    size='large'
                    className={this.props.classes.button2}
                    {...(this.props.button2Link ? {
                      component: Link,
                      to: this.props.button2Link,
                    } : {})}
                    {...(this.props.button2LinkExt ? {
                      component: 'a',
                      href: this.props.button2LinkExt,
                    } : {})}
                  >
                    {this.props.button2Icon && (
                      <>
                        {this.props.button2Icon}
                        &nbsp;&nbsp;&nbsp;
                      </>
                    )}
                    {this.props.button2Title}
                  </Button>
                )}
                <div className={this.props.classes.buttonContainer}>
                  <Button
                    className={this.props.classes.buttonMain}
                    color='primary'
                    variant='contained'
                    size='large'
                    disableElevation
                    {...(this.props.buttonLink ? {
                      component: Link,
                      to: this.props.buttonLink,
                    } : {})}
                    {...(this.props.buttonLinkExt ? {
                      component: 'a',
                      href: this.props.buttonLinkExt,
                    } : {})}
                  >
                    {this.props.buttonTitle}
                    {!!this.props.buttonRemark && (
                      <div className={this.props.classes.remark}>
                        <Typography variant='caption' component='div' color='textSecondary'>{this.props.buttonRemark}</Typography>
                      </div>
                    )}
                  </Button>
                  {this.props.buttonAddOauth && (
                    <>
                      <Button
                        color='primary'
                        variant='contained'
                        disableElevation
                        size='large'
                        className={this.props.classes.buttonOauth}
                        onClick={e => this.onOauth('google')}
                      >
                        <GoogleIcon />
                      </Button>
                      <Button
                        color='primary'
                        disableElevation
                        variant='contained'
                        size='large'
                        className={this.props.classes.buttonOauth}
                        onClick={e => this.onOauth('github')}
                      >
                        <GithubIcon />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </Grid>
        </Grid>
      </div>
    );
  }

  onOauth(type: 'google' | 'github') {
    this.oauthFlow.listenForSuccess(async () => {
      const bindResult = await (await ServerAdmin.get().dispatchAdmin()).accountBindAdmin({ accountBindAdmin: {} });
      if (!!bindResult.created) {
        redirectIso('/dashboard/welcome', this.props.history);
      } else if (!!bindResult.account) {
        redirectIso('/dashboard', this.props.history);
      }
    });
    this.oauthFlow.openForAccount(type, 'window');
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(Hero));
