import React, { Component } from 'react';
import { Server } from '../api/server';
import LogIn from '../app/comps/LogIn';

export interface Props {
  server: Server;
  asAuthorId?: string;
  actionTitle?: string;
}
interface State {
  logInOpen?: boolean;
}
export default class RichEditorImageUpload extends Component<Props, State> {
  state: State = {};
  onLoggedIn?: () => void;
  render() {
    return (
      <LogIn
        actionTitle={this.props.actionTitle || 'Upload'}
        server={this.props.server}
        open={this.state.logInOpen}
        onClose={() => this.setState({ logInOpen: false })}
        onLoggedInAndClose={async () => {
          this.setState({ logInOpen: false });
          this.onLoggedIn && this.onLoggedIn();
          this.onLoggedIn = undefined;
        }}
      />
    );
  }

  async uploadImage(file: Blob): Promise<string> {
    if (this.props.asAuthorId) {
      const contentUploadAsAdminResponse = await (await this.props.server.dispatchAdmin()).contentUploadAsAdmin({
        projectId: this.props.server.getProjectId(),
        authorId: this.props.asAuthorId,
        body: file,
      });
      return contentUploadAsAdminResponse.url;
    } else {
      if (!this.props.server.getStore().getState().users.loggedIn.user) {
        const logInPromise = new Promise<void>((resolve) => this.onLoggedIn = resolve);
        this.setState({ logInOpen: true });
        await logInPromise;
      }
      const contentUploadResponse = await (await this.props.server.dispatch()).contentUpload({
        projectId: this.props.server.getProjectId(),
        body: file,
      });
      return contentUploadResponse.url;
    }
  }
}
