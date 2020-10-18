import { Button, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import { Link } from 'react-router-dom';
import * as Client from '../api/client';
import ModStar from './ModStar';
import { preserveEmbed } from './util/historyUtil';

export const DisplayUserName = (user?: Partial<Client.User> | Client.UserMe) => !!user
  ? user['name'] || user['email'] || user['userId']?.substring(0, 5) || 'Nameless'
  : 'Anonymous';

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
  disabled?: boolean;
}
class UserDisplay extends React.Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    const user = (
      <Typography variant='caption'>
        <ModStar name={DisplayUserName(this.props.user)} isMod={this.props.user.isMod} />
      </Typography>
    );
    return this.props.onClick ? (
      <Button
        key={`user-${this.props.user.userId}`}
        className={this.props.classes.button}
        disabled={this.props.disabled}
        variant='text'
        onClick={e => this.props.onClick && this.props.onClick(this.props.user.userId)}
      >
        {user}
      </Button>
    ) : (
        <Button
          key={`user-${this.props.user.userId}`}
          className={this.props.classes.button}
          disabled={this.props.disabled}
          variant='text'
          component={Link}
          to={preserveEmbed(`/user/${this.props.user.userId}`, this.props.location)}
        >
          {user}
        </Button>
      );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserDisplay));