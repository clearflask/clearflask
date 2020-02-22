import React, { Component } from 'react';
import IdeaExplorer from '../../app/comps/IdeaExplorer';
import { Server } from '../../api/server';

interface Props {
  server:Server;
}

class PostsPage extends Component<Props> {
  render() {
    return (
      <IdeaExplorer
        server={this.props.server}
        explorer={{
          allowSearch: true,
          allowCreate: true,
          panel: {
            search: {},
            display: {},
          },
        }}
      />
    );
  }
}

export default PostsPage;
