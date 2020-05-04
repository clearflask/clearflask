import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Variant } from '@material-ui/core/styles/createTypography';
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';

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
  variant?: Variant;
  icon?: React.ReactNode;
}
class BlockContent extends Component<Props & WithStyles<typeof styles, true> & RouteComponentProps> {

  render() {
    return (
      <div className={this.props.classes.container}>
        {this.props.icon && (
          <div className={this.props.classes.icon}>
            {this.props.icon}
          </div>
        )}
        <Typography variant={this.props.variant || 'h4'} >{this.props.title}</Typography>
        <Typography variant='body1' component='div' className={this.props.classes.description}>{this.props.description}</Typography>
        {this.props.buttonLink && (
          <Button
            className={this.props.classes.button}
            variant='text'
            onClick={() => this.props.history.push(this.props.buttonLink!)}
          >{this.props.buttonTitle}</Button>
        )}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(BlockContent));
