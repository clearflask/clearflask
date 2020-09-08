import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';
import * as Client from '../api/client';
import { getSearchKey, Server } from '../api/server';
import Panel, { Direction } from '../app/comps/Panel';
import DividerCorner from '../app/utils/DividerCorner';

const styles = (theme: Theme) => createStyles({
  panels: {
    display: 'flex',
    flexDirection: 'column',
  },
});
interface Props {
  userId: string;
  server: Server;
}
class UserContributions extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const postsPanel: Client.PagePanelWithHideIfEmpty = {
      search: { filterAuthorId: this.props.userId, sortBy: Client.IdeaSearchSortByEnum.New },
      display: {},
      hideIfEmpty: false,
    };
    return (
      <div className={this.props.classes.panels}>
        <DividerCorner
          title='Submissions'
          isExplorer
        >
          <Panel
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
        </DividerCorner>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(UserContributions);
