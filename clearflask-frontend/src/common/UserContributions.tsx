import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { getSearchKey, Server } from '../api/server';
import { Direction } from '../app/comps/Panel';
import PanelComment from '../app/comps/PanelComment';
import PanelPost from '../app/comps/PanelPost';

const styles = (theme: Theme) => createStyles({
  panel: {
    marginTop: theme.spacing(4),
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
      display: {},
      title: 'Recent submissions',
      hideIfEmpty: false,
    };
    const commentSearch: Client.CommentSearch = {
      filterAuthorId: this.props.userId,
    };
    return (
      <React.Fragment>
        <PanelPost
          className={this.props.classes.panel}
          key={getSearchKey(postsPanel.search)}
          direction={Direction.Horizontal}
          panel={postsPanel}
          server={this.props.server}
          displayDefaults={{
            titleTruncateLines: 1,
            descriptionTruncateLines: 2,
            responseTruncateLines: 0,
            showCommentCount: false,
            showCategoryName: false,
            showCreated: false,
            showAuthor: false,
            showStatus: false,
            showTags: false,
            showVoting: true,
            showFunding: true,
            showExpression: true,
          }}
        />
        <PanelComment
          className={this.props.classes.panel}
          key={getSearchKey(commentSearch)}
          title='Recent comments'
          server={this.props.server}
          search={commentSearch}
          direction={Direction.Horizontal}
          hideAuthor
        />
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(UserContributions));
