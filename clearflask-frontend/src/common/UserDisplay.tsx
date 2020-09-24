import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import ModStar from './ModStar';
import { preserveEmbed } from './util/historyUtil';

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
    if (this.props.onClick) {
      this.props.onClick(this.props.user.userId);
    } else {
      this.props.history.push(preserveEmbed(`/user/${this.props.user.userId}`, this.props.location));
    }
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserDisplay));