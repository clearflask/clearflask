import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';
import * as Client from '../api/client';
import AvatarDisplay from './AvatarDisplay';
import UserDisplay from './UserDisplay';

const styles = (theme: Theme) => createStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  containerClickable: {
    cursor: 'pointer',
  },
  name: {
    marginLeft: theme.spacing(1.5),
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
}) => {
  const classes = useStyles();
  return (
    <div
      className={classNames(
        props.className,
        classes.container,
        !!props.onClick && classes.containerClickable,
      )}
      onClick={() => props.user?.userId && props.onClick?.(props.user.userId)}
    >
      <AvatarDisplay
        user={props.user}
        backgroundColor={props.backgroundColor}
      />
      <UserDisplay
        labelClassName={classes.name}
        suppressTypography
        suppressStar
        variant='text'
        user={props.user}
      />
    </div>
  );
};
export default UserWithAvatarDisplay;