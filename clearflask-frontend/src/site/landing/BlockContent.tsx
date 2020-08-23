import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import GoIcon from '@material-ui/icons/ArrowRightAlt';
import classNames from 'classnames';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
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
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  button: {
    alignSelf: 'flex-end',
  },
  marker: {
    color: theme.palette.text.secondary,
  },
});

export interface Props {
  className?: string;
  title?: string;
  marker?: string;
  description?: string | React.ReactNode;
  buttonTitle?: string;
  buttonOnClick?: () => void;
  buttonLink?: string;
  buttonState?: any;
  variant?: 'hero' | 'heading-main' | 'heading' | 'content';
  titleCmpt?: string;
  icon?: React.ReactNode;
  scrollAnchor?: ScrollAnchorProps;
}
class BlockContent extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps> {

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
      case 'heading-main':
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
        {this.props.buttonTitle && (
          <Button
            className={this.props.classes.button}
            variant='text'
            onClick={() => {
              this.props.buttonOnClick && this.props.buttonOnClick();
              this.props.buttonLink && this.props.history.push(this.props.buttonLink, this.props.buttonState);
            }}
            color='primary'
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

export default withStyles(styles, { withTheme: true })(withRouter(BlockContent));
