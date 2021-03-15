import { Button, Link as MuiLink, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import GoIcon from '@material-ui/icons/ArrowRightAlt';
import CheckIcon from '@material-ui/icons/Check';
import classNames from 'classnames';
import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import PostStatusIframe from '../../app/PostStatusIframe';
import ScrollAnchor, { Props as ScrollAnchorProps } from '../../common/util/ScrollAnchor';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  description: {
    marginTop: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  icon: {
    marginBottom: theme.spacing(2),
    // marginLeft: 'auto',
    marginRight: 'auto',
  },
  button: {
    alignSelf: 'flex-end',
  },
  marker: {
    color: theme.palette.text.secondary,
  },
  points: {
    margin: theme.spacing(1, 0),
  },
  point: {
    display: 'flex',
    alignItems: 'center',
    margin: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  pointCheck: {
    color: theme.palette.primary.main,
    marginRight: theme.spacing(1),
  },
});

export interface Props {
  className?: string;
  title?: string;
  marker?: string;
  description?: string | React.ReactNode;
  points?: Array<string | React.ReactNode>;
  postStatusId?: string;
  buttonTitle?: string;
  buttonLinkExt?: string;
  buttonLink?: string;
  buttonState?: any;
  variant?: 'hero' | 'headingMain' | 'heading' | 'content';
  titleCmpt?: string;
  icon?: React.ReactNode;
  scrollAnchor?: ScrollAnchorProps;
}
class BlockContent extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    var titleVariant;
    var bodyVariant;
    var titleCmpt;
    var bodyCmpt;
    switch (this.props.variant) {
      case 'hero':
        titleVariant = 'h3';
        bodyVariant = 'h5';
        titleCmpt = this.props.titleCmpt || 'h1';
        bodyCmpt = 'div';
        break;
      case 'headingMain':
        titleVariant = 'h4';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h2';
        bodyCmpt = 'div';
        break;
      case 'heading':
        titleVariant = 'h5';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h3';
        bodyCmpt = 'div';
        break;
      default:
      case 'content':
        titleVariant = 'h6';
        bodyVariant = 'body1';
        titleCmpt = this.props.titleCmpt || 'h4';
        bodyCmpt = 'div';
        break;
    }
    return (
      <div className={classNames(this.props.classes.container, this.props.className)}>
        {this.props.icon && (
          <div className={this.props.classes.icon}>
            {this.props.icon}
          </div>
        )}
        <Typography variant={titleVariant} component={titleCmpt}>{this.props.title}</Typography>
        {this.props.marker && (
          <Typography variant='caption' className={this.props.classes.marker}>{this.props.marker}</Typography>
        )}
        {!!this.props.scrollAnchor && (
          <ScrollAnchor {...this.props.scrollAnchor} />
        )}
        <Typography variant={bodyVariant} component={bodyCmpt} className={this.props.classes.description}>{this.props.description}</Typography>
        {!!this.props.points && (
          <div className={this.props.classes.points}>
            {this.props.points.map(point => typeof point !== 'string' ? point : (
              <Typography variant={bodyVariant} component='div' className={this.props.classes.point}>
                <CheckIcon color='inherit' fontSize='inherit' className={this.props.classes.pointCheck} />
                {point}
              </Typography>
            ))}
          </div>
        )}
        {this.props.postStatusId && (
          <PostStatusIframe
            className={this.props.classes.button}
            postId={this.props.postStatusId}
            config={{
              fontSize: '1.1em',
              alignItems: 'end',
              justifyContent: 'end',
            }}
          />
        )}
        {this.props.buttonTitle && (
          <Button
            className={this.props.classes.button}
            variant='text'
            color='primary'
            {...(this.props.buttonLink ? {
              component: Link,
              to: {
                pathname: this.props.buttonLink,
                state: this.props.buttonState,
              },
            } : {})}
            {...(this.props.buttonLinkExt ? {
              component: MuiLink,
              href: this.props.buttonLinkExt,
            } : {})}
          >
            {this.props.buttonTitle}
            &nbsp;
            <GoIcon />
          </Button>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(BlockContent);
