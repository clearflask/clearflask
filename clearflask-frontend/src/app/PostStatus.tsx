// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import OpenIcon from '@material-ui/icons/OpenInNew';
import QueryString from 'query-string';
import { Component } from 'react';
import { RouteComponentProps } from 'react-router';
import * as Client from '../api/client';
import { Server } from '../api/server';
import WebNotification from '../common/notification/webNotification';
import Promised from '../common/Promised';
import { detectEnv, Environment } from '../common/util/detectEnv';
import windowIso from '../common/windowIso';

export class PostStatusConfigDef {
  fontSize?: number | string;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  fontWeight?: string | number;
  alignItems?: string;
  justifyContent?: string;
  textTransform?: string;
}

export interface PostStatusConfig extends PostStatusConfigDef {
};

const styles = (theme: Theme) => createStyles({
  linkContainer: {
    flexGrow: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  link: {
    color: 'inherit',
    outline: 0,
    textDecoration: 'inherit',
    display: 'flex',
    alignItems: 'center',
  },
});

interface Props {
  postId: string;
}

interface State {
}

class PostStatus extends Component<Props & RouteComponentProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  dataPromise: Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]>;

  constructor(props) {
    super(props);


    var ssrWait = false;
    var serverPromise: Promise<Server>;
    if (detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
      serverPromise = this.mockData(props);
    } else {
      const server = new Server();
      if (windowIso.isSsr && server.getStore().getState().conf.status === undefined) {
        ssrWait = true;
      }
      serverPromise = Promise.resolve(server);
    }

    this.dataPromise = this.fetchData(props, serverPromise);
    if (windowIso.isSsr && ssrWait) windowIso.awaitPromises.push(this.dataPromise);
  }

  async mockData(props: Props): Promise<Server> {
    const mocker = await import(/* webpackChunkName: "mocker" */'../mocker');
    const serverMock = await import(/* webpackChunkName: "serverMock" */'../api/serverMock');
    const projectId = (await mocker.mock()).config.projectId;
    await mocker.mockIdea(projectId, props.postId);
    return new Server(projectId, { suppressSetTitle: true }, serverMock.default.get());
  }

  async fetchData(props: Props, serverPromise: Promise<Server>): Promise<[Client.VersionedConfig, Client.UserMeWithBalance | undefined, Client.IdeaWithVote]> {
    const server = await serverPromise;
    const subscriptionResult = await WebNotification.getInstance().getPermission();
    const dispatcher = await server.dispatch({ ssr: true, ssrStatusPassthrough: true });
    var configAndUserBind: Client.ConfigBindSlugResult | Client.ConfigAndUserBindSlugResult | undefined;
    if (windowIso.isSsr) {
      configAndUserBind = await dispatcher.configBindSlug({ slug: windowIso.location.hostname });
    } else {
      configAndUserBind = await dispatcher.configAndUserBindSlug({
        slug: windowIso.location.hostname,
        userBind: {
          browserPushToken: (subscriptionResult !== undefined && subscriptionResult.type === 'success')
            ? subscriptionResult.token : undefined,
        },
      });
    }

    if (!configAndUserBind?.config) {
      throw new Error('Permission denied');
    }

    const post = await dispatcher.ideaGet({
      projectId: configAndUserBind.projectId,
      ideaId: props.postId,
    });

    return [configAndUserBind.config, configAndUserBind['user'], post];
  }

  render() {
    const queryParams = QueryString.parse(this.props.location.search);
    const statusConfig = queryParams as PostStatusConfig;

    return (
      <Promised
        promise={this.dataPromise}
        render={([config, user, post]) => {

          var status = config.config
            .content
            .categories
            .find(c => c.categoryId === post.categoryId)
            ?.workflow
            .statuses
            .find(s => s.statusId === post.statusId);
          if (!status && detectEnv() === Environment.DEVELOPMENT_FRONTEND) {
            status = {
              name: 'Planned',
              nextStatusIds: [],
              color: '#3B67AE',
              statusId: 'a',
              disableFunding: false,
              disableExpressions: false,
              disableVoting: false,
              disableComments: false,
              disableIdeaEdits: true,
            };
          }
          if (!status) {
            return null;
          }
          ;

          const src = `${windowIso.location.origin}/post/${post.ideaId}`;

          return (
            <div
              className={this.props.classes.linkContainer}
              style={{
                color: statusConfig.color || status.color,
                fontSize: statusConfig.fontSize,
                fontFamily: statusConfig.fontFamily,
                backgroundColor: statusConfig.backgroundColor || 'transparent',
                fontWeight: statusConfig.fontWeight,
                alignItems: statusConfig.alignItems,
                justifyContent: statusConfig.justifyContent,
                textTransform: statusConfig.textTransform as any,
              }}
            >
              <a // eslint-disable-line react/jsx-no-target-blank
                href={src}
                target="_blank"
                rel="noopener nofollow"
                className={this.props.classes.link}
              >
                {status.name}
                &nbsp;
                <OpenIcon fontSize="inherit" />
              </a>
            </div>
          );
        }}
        renderError={err => {
          return null;
        }}
        renderLoading={() => null}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(PostStatus);
