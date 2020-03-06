import React, { Component } from 'react';
import { Server } from '../../api/server';
import IdeaExplorer from '../../app/comps/IdeaExplorer';

interface Props {
  server: Server;
}

class PostsPage extends Component<Props> {
  render() {
    return (
      <IdeaExplorer
        server={this.props.server}
        explorer={{
          allowSearch: { enableSort: true, enableSearchText: true, enableSearchByCategory: true, enableSearchByStatus: true, enableSearchByTag: true },
          allowCreate: true,
          search: {},
          display: {},
        }}
      />
    );
  }
}

export default PostsPage;
