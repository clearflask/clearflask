// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Avatar as MuiAvatar, Badge } from '@material-ui/core';
import { createStyles, darken, lighten, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import StarIcon from '@material-ui/icons/StarRounded';
import BoringAvatar from 'boring-avatars';
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
  modAvatar: {
    fontSize: '0.8em'
  },
  badge: {
    padding: 0,
    width: 'unset',
    minWidth: 'unset',
    height: 'unset',
  },
  muiAvatar: {
    textTransform: 'uppercase',
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
  type?: 'initials' | 'bauhaus' | 'beam',
  size?: number;
  user?: {
    userId?: string;
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
    const size = this.props.size || 25;
    var avatar;
    switch (this.props.user?.pic ? 'image' : this.props.type) {
      default:
      case 'beam':
        avatar = (
          <BoringAvatar
            name={userName.replace(/ /g, '')}
            variant='beam'
            size={size}
            colors={[
              darken(this.props.theme.palette.primary.main, 0.6),
              darken(this.props.theme.palette.primary.main, 0.3),
              this.props.theme.palette.primary.main,
              lighten(this.props.theme.palette.primary.main, 0.3),
              lighten(this.props.theme.palette.primary.main, 0.6),
            ]}
          />
        );
        break;
      case 'bauhaus':
        avatar = (
          <BoringAvatar
            name={userName.replace(/ /g, '')}
            variant='bauhaus'
            size={size}
            colors={[
              this.props.theme.palette.primary.dark,
              this.props.theme.palette.primary.light,
              lighten(this.props.theme.palette.primary.main, 0.6),
              lighten(this.props.theme.palette.primary.main, 0.8),
            ]}
          />
        );
        break;
      case 'image':
      case 'initials':
        var backgroundColor;
        if (!this.props.user?.pic) {
          backgroundColor = DeterministicColorFromUser(this.props.user);
          backgroundColor = !backgroundColor ? undefined
            : (this.props.theme.palette.type === 'dark'
              ? darken(backgroundColor, 0.5)
              : lighten(backgroundColor, 0.5));
        }
        avatar = (
          <MuiAvatar
            variant='circle'
            className={classNames(this.props.classes.muiAvatar)}
            style={{
              width: size,
              height: size,
              backgroundColor: backgroundColor,
            }}
            alt={userName}
            src={this.props.user?.pic}
          >{Initial(this.props.user)}</MuiAvatar>
        );
        break;
    }
    if (this.props.user?.isMod) {
      const modSize = size * 0.5;
      const starSize = size * 0.6;
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
            <MuiAvatar alt='Moderator' className={classNames(this.props.classes.backgroundColor)} style={{
              width: modSize,
              height: modSize,
              fontSize: starSize,
            }}>
              <StarIcon className={this.props.classes.modAvatar} fontSize='inherit' color='primary' />
            </MuiAvatar>
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