import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Server } from '../api/server';
import { detectEnv, Environment } from '../common/util/detectEnv';
import * as Client from '../api/client';
import Promised from '../common/Promised';
import { Typography, Button } from '@material-ui/core';
import WebNotification from '../common/notification/webNotification';
import OpenIcon from '@material-ui/icons/OpenInNew';

const styles = (theme: Theme) => createStyles({
  buttonTitle: {
    display: 'flex',
    alignItems: 'center',
  },
});
interface Props {
  projectId: string;
  postId: string;
}
interface State {
}
class PostStatus extends Component<Props & WithStyles<typeof styles, true>, State> {
  state:State = {};
  dataPromise: Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]>;

  constructor(props) {
    super(props);

    this.dataPromise = this.fetchData(props);
  }

  async fetchData(props: Props): Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]> {
    var server:Server | undefined;
    if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      const DemoApp = await import('../site/DemoApp'/* webpackChunkName: "demoApp" */);
      const project = await DemoApp.getProject(
        templater => templater.workflowFeatures(templater.demoCategory()),
        mock => mock.mockFakeIdeaWithComments(props.postId, config => ({
          statusId: config.content.categories[0]?.workflow.statuses[3]?.statusId,
        })),
        props.projectId);
      server = project.server;
    } else {
      server = new Server(props.projectId);
    }

    const configAndUserBindPromise = WebNotification.getInstance().getPermission().then(subscriptionResult => server!.dispatch().configGetAndUserBind({
      projectId: props.projectId,
      configGetAndUserBind: {
        browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
        ? subscriptionResult.token : undefined,
      },
    }));

    const postPromise = server.dispatch().ideaGet({
      projectId: props.projectId,
      ideaId: props.postId,
    });

    const [configAndUserBind, post] = await Promise.all([configAndUserBindPromise, postPromise]);

    return [configAndUserBind.config, configAndUserBind.user, post];
  }

  render() {
    return (
      <Promised
        promise={this.dataPromise}
        render={([config, user, post]) => {

          const status = config.config
            .content
            .categories
            .find(c => c.categoryId === post.categoryId)
            ?.workflow
            .statuses
            .find(s => s.statusId === post.statusId);
          if (!status) {
            console.log('Failed to load, post has no status', config, user, post);
            return null;
          };

          return (
            <Button
              variant='text'
              onClick={e => window.open(`${window.location.origin}/post/${post.ideaId}`, '_blank')}
            >
              <div
                className={this.props.classes.buttonTitle}
                style={{ color: status.color }}
              >
                {status.name}
                &nbsp;
                <OpenIcon fontSize='inherit' />
              </div>
            </Button>
          );
        }}
        renderError={err => {
          console.log('Failed to load:', err);
          return null;
        }}
        renderLoading={() => null}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostStatus);
