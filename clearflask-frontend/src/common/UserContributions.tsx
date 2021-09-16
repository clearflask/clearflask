// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { getSearchKey, Server } from '../api/server';
import { BoardPanel } from '../app/AppDynamicPage';
import { Direction } from '../app/comps/Panel';
import PanelComment from '../app/comps/PanelComment';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  sectionClassName?: string;
  userId: string;
  server: Server;
}
class UserContributions extends React.Component<Props & RouteComponentProps & WithStyles<typeof styles, true>> {
  render() {
    const postsPanel: Client.PagePanelWithHideIfEmpty = {
      search: {
        filterAuthorId: this.props.userId,
        sortBy: Client.IdeaSearchSortByEnum.New,
        limit: 2,
      },
      display: {
        titleTruncateLines: 1,
        descriptionTruncateLines: 2,
        responseTruncateLines: 0,
      },
      title: 'Posts',
      hideIfEmpty: true,
    };
    const commentSearch: Client.CommentSearch = {
      filterAuthorId: this.props.userId,
      limit: 2,
    };
    return (
      <>
        <BoardPanel
          className={this.props.sectionClassName}
          server={this.props.server}
          panel={postsPanel}
        />
        <PanelComment
          className={this.props.sectionClassName}
          key={getSearchKey(commentSearch)}
          title='Comments'
          server={this.props.server}
          search={commentSearch}
          direction={Direction.Horizontal}
          hideAuthor
          hideIfEmpty
        />
      </>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserContributions));
