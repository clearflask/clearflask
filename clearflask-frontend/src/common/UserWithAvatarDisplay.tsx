// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';
import * as Client from '../api/client';
import AvatarDisplay from './AvatarDisplay';
import UserDisplay from './UserDisplay';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    justifyContent: 'flex-start',
    margin: theme.spacing(0.5, 1),
  },
  containerClickable: {
    cursor: 'pointer',
  },
  name: {
    marginLeft: theme.spacing(1.5),
  },
  unknownAuthor: {
    fontStyle: 'italic',
  },
});
const useStyles = makeStyles(styles);
const UserWithAvatarDisplay = (props: {
  className?: string;
  onClick?: (userId: string) => void;
  user?: {
    userId: string;
    name?: string;
    isMod?: boolean;
    pic?: string;
  } | Client.User;
  disabled?: boolean;
  backgroundColor?: 'default' | 'paper' | 'inherit';
  avatarSize?: number;
  fontSize?: string | number;
  baseline?: boolean;
  maxChars?: number;
}) => {
  const classes = useStyles();
  return (
    <div
      className={classNames(
        props.className,
        classes.container,
        !!props.onClick && classes.containerClickable,
      )}
      style={{
        alignItems: props.baseline ? 'baseline' : 'center',
      }}
      onClick={() => props.user?.userId && props.onClick?.(props.user.userId)}
    >
      <AvatarDisplay
        user={props.user}
        backgroundColor={props.backgroundColor}
        type={!props.user ? 'initials' : undefined}
        size={props.avatarSize}
      />
      <UserDisplay
        labelClassName={classNames(
          classes.name,
          !props.user && classes.unknownAuthor,
        )}
        style={{
          fontSize: props.fontSize,
        }}
        suppressStar
        variant='text'
        user={props.user}
        maxChars={props.maxChars}
      />
    </div>
  );
};
export default UserWithAvatarDisplay;