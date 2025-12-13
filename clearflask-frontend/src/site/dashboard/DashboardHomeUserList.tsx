// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import DashboardHomeBox from './DashboardHomeBox';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import UserList from './UserList';
import * as Admin from '../../api/admin';

const styles = (theme: Theme) => createStyles({
  box: {
    flexGrow: 1,
    minHeight: 300,
    maxHeight: 500,
  },
});
const useStyles = makeStyles(styles);
const DashboardHomeUserList = (props: {
  title: string;
} & React.ComponentProps<typeof UserList>) => {
  const classes = useStyles();
  const { title, ...userListProps } = props;
  return (
    <DashboardHomeBox
      title={title}
      className={classes.box}
      scroll
      chart={(
        <UserList
          {...userListProps}
          search={{
            sortBy: Admin.UserSearchAdminSortByEnum.Created,
            sortOrder: Admin.UserSearchAdminSortOrderEnum.Desc,
          }}
        />
      )}
    />
  );
};
export default DashboardHomeUserList;
