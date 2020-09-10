import React from 'react';
import ModStar from './ModStar';
import * as Client from '../api/client';
import { Button, Typography } from '@material-ui/core';
import { withRouter, WithRouterProps, RouteComponentProps } from 'react-router';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme: Theme) => createStyles({
  button: {
    padding: `3px ${theme.spacing(0.5)}px`,
    whiteSpace: 'nowrap',
    minWidth: 'unset',
    textTransform: 'unset',
  },
});
interface Props {
  user: {
    userId: string;
    name?: string;
    isMod?: boolean;
  } | Client.User;
  onClick?: (userId: string) => void;
}
class UserDisplay extends React.Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Button
        key={`user-${this.props.user.userId}`}
        className={this.props.classes.button}
        variant='text'
        onClick={e => this.onClick()}
      >
        <Typography variant='caption'>
          <ModStar name={this.props.user.name} isMod={this.props.user.isMod} />
        </Typography>
      </Button>
    );
  }

  onClick() {
    if(this.props.onClick) {
      this.props.onClick(this.props.user.userId);
    } else {
      this.props.history.push(`/user/${this.props.user.userId}`);
    }
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserDisplay));