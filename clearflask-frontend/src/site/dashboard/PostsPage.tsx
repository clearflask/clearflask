import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Switch } from 'react-router';
import { Route } from 'react-router-dom';
import { Server } from '../../api/server';
import IdeaExplorer from '../../app/comps/IdeaExplorer';
import PostPage from '../../app/comps/PostPage';

const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: 1024,
  },
});

interface Props {
  server: Server;
}

class PostsPage extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div className={this.props.classes.page}>
        <Switch>
          <Route key='post' path={`/dashboard/posts/post/:postId`} render={props => (
            <PostPage
              postId={props.match.params['postId'] || ''}
              server={this.props.server}
            />
          )} />
          <Route key='search' render={props => (
            <IdeaExplorer
              server={this.props.server}
              forceDisablePostExpand
              explorer={{
                allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
                allowCreate: {},
                search: {},
                display: {},
              }}
            />
          )} />
        </Switch>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostsPage);
