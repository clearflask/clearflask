import { Avatar, Badge } from '@material-ui/core';
import { createStyles, fade, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
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
    backgroundColor: (props: Props) => props.isInsidePaper ? theme.palette.background.paper : theme.palette.background.default,
  },
  modAvatar: {
    fontSize: '0.8em'
  },
  avatar: {
    width: (props: Props) => props.size !== undefined ? props.size : 25,
    height: (props: Props) => props.size !== undefined ? props.size : 25,
    textTransform: 'uppercase',
    backgroundColor: (props: Props) => {
      const color = DeterministicColorFromUser(props.user);
      return !color ? undefined : fade(color, 0.5)
    },
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
  isInsidePaper?: boolean;
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
          overlap='circle'
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          badgeContent={(
            <Avatar alt='Moderator' className={this.props.classes.modAvatarContainer}>
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