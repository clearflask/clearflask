// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import PostList from './PostList';
import DashboardHomeBox from './DashboardHomeBox';
import { createStyles, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import { MinContentWidth } from '../../app/comps/Post';

const styles = (theme: Theme) => createStyles({
  box: {
    flexGrow: 1,
    minHeight: 300,
    maxHeight: 300, // If changed, also adjust searchOverrideAdmin limit below
  },
  list: {
    minWidth: MinContentWidth,
  },
});
const useStyles = makeStyles(styles);
const DashboardHomePostList = (props: {
  title: string;
} & React.ComponentProps<typeof PostList>) => {
  const classes = useStyles();
  const theme = useTheme();

  const { title, ...postListProps } = props;

  return (
    <DashboardHomeBox
      title={title}
      className={classes.box}
      scroll
      chart={(
        <PostList
          className={classes.list}
          {...postListProps}
          search={{
            limit: 5, // If changed, also adjust box.maxHeight above
              ...postListProps.search,
          }}
          PanelPostProps={{
            widthExpand: false,
            margins: theme.spacing(1),
            ...postListProps.PanelPostProps,
          }}
          displayOverride={{
            titleTruncateLines: 1,
            descriptionTruncateLines: 0,
            responseTruncateLines: 0,
            showCommentCount: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: false,
            showVotingCount: false,
            showFunding: false,
            showExpression: false,
            showEdit: false,
            showCategoryName: false,
            ...postListProps.displayOverride,
          }}
        />
      )}
    />
  );
};
export default DashboardHomePostList;
