import { Avatar, Badge } from '@material-ui/core';
import { createStyles, darken, lighten, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import StarIcon from '@material-ui/icons/StarRounded';
import classNames from 'classnames';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { DisplayUserName } from './UserDisplay';

export const DeterministicColorFromUser = (user?: Partial<Client.User> | Client.UserMe): string | undefined => {
  const str = user?.['userId'] || user?.['email'] || user?.['name'];
  if (!str) return;
  // https://stackoverflow.com/a/3426956
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var c = (hash & 0x00FFFFFF)
    .toString(16)
    .toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}
export const DeterministicFadeFromUser = (color: string, user?: Partial<Client.User> | Client.UserMe): string => {
  const str = user?.['userId'] || user?.['email'] || user?.['name'];
  if (!str) return color;
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var c = (hash & 0x00FFFFFF)
    .toString(16)
    .toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}
export const Initial = (user?: Partial<Client.User> | Client.UserMe): string | undefined => {
  if (!user) {
    return;
  }
  if (user['name']) {
    return user['name'][0];
  }
  if (user['email']) {
    return user['email'][0];
  }
  if (user['userId']) {
    return user['userId'][0];
  }
  return;
};

const styles = (theme: Theme) => createStyles({
  modAvatarContainer: {
    width: 18,
    height: 18,
  },
  modAvatar: {
    fontSize: '0.8em'
  },
  badge: {
    padding: 0,
  },
  avatar: {
    width: (props: Props) => props.size !== undefined ? props.size : 25,
    height: (props: Props) => props.size !== undefined ? props.size : 25,
    textTransform: 'uppercase',
    backgroundColor: (props: Props) => {
      const color = DeterministicColorFromUser(props.user);
      return !color ? undefined
        : (theme.palette.type === 'dark'
          ? darken(color, 0.5)
          : lighten(color, 0.5));
    },
  },
  backgroundColor: {
    backgroundColor: (props: Props) => props.backgroundColor === 'inherit'
      ? 'inherit'
      : (props.backgroundColor === 'paper') ? theme.palette.background.paper
        : theme.palette.background.default,
    transition: 'inherit',
  },
});
interface Props {
  avatarClassName?: string;
  size?: string | number;
  user?: {
    userId: string;
    name?: string;
    isMod?: boolean;
    pic?: string;
  } | Client.User;
  onClick?: (userId: string) => void;
  disabled?: boolean;
  backgroundColor?: 'default' | 'paper' | 'inherit';
}
class AvatarDisplay extends React.Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    const userName = DisplayUserName(this.props.user);
    var avatar = (
      <Avatar
        variant='rounded'
        className={classNames(this.props.avatarClassName, this.props.classes.avatar)}
        alt={userName}
        src={this.props.user?.pic}
      >{Initial(this.props.user)}</Avatar>
    );
    if (this.props.user?.isMod) {
      avatar = (
        <Badge
          classes={{
            root: this.props.classes.backgroundColor,
            badge: classNames(this.props.classes.badge, this.props.classes.backgroundColor),
          }}
          overlap='circle'
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          badgeContent={(
            <Avatar alt='Moderator' className={classNames(this.props.classes.backgroundColor, this.props.classes.modAvatarContainer)}>
              <StarIcon className={this.props.classes.modAvatar} fontSize='inherit' color='primary' />
            </Avatar>
            // <div className={this.props.classes.modAvatarContainer}>
            // </div>
          )}
        >
          {avatar}
        </Badge>
      );
    }
    return avatar;
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(AvatarDisplay));