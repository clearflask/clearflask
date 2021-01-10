import { Button, Grid, Link as MuiLink, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { vh } from '../../common/util/vhUtil';

const styles = (theme: Theme) => createStyles({
  hero: {
    width: '100vw',
    minHeight: vh(60),
    padding: `${vh(20)}px 10vw`,
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
  buttonAndRemark: {
    alignSelf: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: theme.spacing(4, 10),
    [theme.breakpoints.down('sm')]: {
      margin: theme.spacing(4, 6),
    },
  },
  remark: {
    textAlign: 'center',
    margin: theme.spacing(1),
  },
});

interface Props {
  title?: string;
  description?: string;
  imagePath?: string;
  imageWidth?: string | number;
  imageHeight?: string | number;
  mirror?: boolean;
  buttonTitle?: string;
  buttonLinkExt?: string;
  buttonLink?: string;
  buttonRemark?: React.ReactNode;
}
class Hero extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={this.props.classes.hero}>
        <Grid container
          justify='center'
          wrap='wrap-reverse'
          alignItems='center'
          direction={!!this.props.mirror ? 'row-reverse' : undefined}
        >
          {this.props.imagePath && (
            <Grid item xs={12} md={6}>
              <img
                alt=''
                className={this.props.classes.image}
                src={this.props.imagePath}
                width={this.props.imageWidth}
                height={this.props.imageHeight}
              />
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
              <div
                className={this.props.classes.buttonAndRemark}
              >
                <Button
                  color='primary'
                  variant='contained'
                  disableElevation
                  style={{ fontWeight: 900 }}
                  {...(this.props.buttonLink ? {
                    component: Link,
                    to: this.props.buttonLink,
                  } : {})}
                  {...(this.props.buttonLinkExt ? {
                    component: MuiLink,
                    href: this.props.buttonLinkExt,
                  } : {})}
                >
                  {this.props.buttonTitle}
                </Button>
                {!!this.props.buttonRemark && (
                  <div className={this.props.classes.remark}>
                    <Typography variant='caption' component='div' color='textSecondary'>{this.props.buttonRemark}</Typography>
                  </div>
                )}
              </div>
            )}
          </Grid>
        </Grid>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Hero);
