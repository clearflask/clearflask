// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { getSearchKey, Server } from '../api/server';
import { BoardContainer, BoardPanel } from '../app/AppDynamicPage';
import { Direction } from '../app/comps/Panel';
import PanelComment from '../app/comps/PanelComment';

const styles = (theme: Theme) => createStyles({
  panelComment: {
    flex: '0 1 100px',
    paddingTop: theme.spacing(3),
    paddingLeft: theme.spacing(2),
  },
});
interface Props {
  userId: string;
  server: Server;
}
class UserContributions extends React.Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    const postsPanel: Client.PagePanelWithHideIfEmpty = {
      search: { filterAuthorId: this.props.userId, sortBy: Client.IdeaSearchSortByEnum.New },
      display: {
        titleTruncateLines: 1,
        descriptionTruncateLines: 2,
        responseTruncateLines: 0,
      },
      title: 'Posts',
      hideIfEmpty: false,
    };
    const commentSearch: Client.CommentSearch = {
      filterAuthorId: this.props.userId,
    };
    return (
      <BoardContainer
        title='Submissions'
        panels={[(
          <BoardPanel
            server={this.props.server}
            panel={postsPanel}
          />
        ), (
          <PanelComment
            key={getSearchKey(commentSearch)}
            className={this.props.classes.panelComment}
            title='Comments'
            server={this.props.server}
            search={commentSearch}
            direction={Direction.Horizontal}
            hideAuthor
          />
        )]}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserContributions));
