import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
    color: theme.palette.text.hint,
  },
  icon: {
    position: 'absolute',
    transform: 'translate(-100%, -100%)',
  },
  button: {
    alignSelf: 'flex-end',
  },
});

export interface Props {
  title?: string;
  description?: string;
  buttonTitle?: string;
  buttonLink?: string;
  buttonState?: any;
  variant?: 'hero' | 'heading' | 'content';
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
        titleCmpt = 'h1';
        bodyCmpt = 'div';
        break;
      case 'heading':
        titleVariant = 'h4';
        bodyVariant = 'body1';
        titleCmpt = 'h2';
        bodyCmpt = 'div';
        break;
      default:
      case 'content':
        titleVariant = 'h5';
        bodyVariant = 'body1';
        titleCmpt = 'h3';
        bodyCmpt = 'div';
        break;
    }
    return (
      <div className={this.props.classes.container}>
        {this.props.icon && (
          <div className={this.props.classes.icon}>
            {this.props.icon}
          </div>
        )}
        <Typography variant={titleVariant} component={titleCmpt}>{this.props.title}</Typography>
        {!!this.props.scrollAnchor && (
          <ScrollAnchor {...this.props.scrollAnchor} />
        )}
        <Typography variant={bodyVariant} component={bodyCmpt} className={this.props.classes.description}>{this.props.description}</Typography>
        {this.props.buttonLink && (
          <Button
            className={this.props.classes.button}
            variant='text'
            onClick={() => this.props.history.push(this.props.buttonLink!, this.props.buttonState)}
          >{this.props.buttonTitle}</Button>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(BlockContent));
