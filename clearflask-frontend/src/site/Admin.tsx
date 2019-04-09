import React, { Component } from 'react';
import * as ConfigEditor from '../common/config/configEditor';
import Menu from '../common/config/settings/Menu';
import Page from '../common/config/settings/Page';
import { match } from 'react-router';
import { History, Location } from 'history';
import Message from '../app/comps/Message';
import DemoApp from './DemoApp';
import Layout from '../common/Layout';
import { Divider, Typography } from '@material-ui/core';
import { Server } from '../api/server';
import * as AdminClient from '../api/admin';
import { detectEnv, Environment } from '../common/util/detectEnv';

interface Props {
  // Router matching
  match:match;
  history:History;
  location:Location;
}

interface State {
  currentPagePath:ConfigEditor.Path;
}

export default class Admin extends Component<Props, State> {
  readonly server:Server;
  editor:ConfigEditor.Editor|undefined;
  
  constructor(props:Props) {
    super(props);

    this.state = {currentPagePath: []}

    const projectId = this.props.match.params['projectId'];
    this.server = new Server(
      projectId,
      detectEnv() === Environment.DEVELOPMENT_FRONTEND);
    if(detectEnv() !== Environment.DEVELOPMENT_FRONTEND) {
      this.server.dispatchAdmin().then(d => d.configGetAdmin({projectId: projectId}).then((conf:AdminClient.ConfigAdmin) => {
        this.editor = new ConfigEditor.EditorImpl(conf);
      }));
    } else {
      this.editor = new ConfigEditor.EditorImpl();
      this.server.overrideConfig(this.editor.getConfig());
    }
  }

  render() {
    const activePath = ConfigEditor.parsePath(this.props.match.params['path'], '/');
    var menu;
    var page;
    var preview;
    if(this.editor) {
      menu = (
        <Menu
          page={this.editor.getPage([])}
          activePath={activePath}
          pageClicked={this.pageClicked.bind(this)}
        />
      );
      try {
        var currentPage = this.editor.getPage(activePath);
      } catch(ex) {
        return (
          <Message innerStyle={{margin: '40px auto'}}
            message='Oops, page failed to load'
            variant='error'
          />
        );
      }
      page = (
        <Page
          page={currentPage}
          pageClicked={this.pageClicked.bind(this)}
        />
      );
      preview = (
        <DemoApp editor={this.editor} server={this.server} />
      );
    }
    return (
      <Layout
        toolbarLeft={(
          <Typography variant="h6" color="inherit" noWrap>
            Admin
          </Typography>
        )}
        preview={preview}
        menu={menu}
      >
        {page}
      </Layout>
    );
  }

  pageClicked(path:ConfigEditor.Path):void {
    this.props.history.push(`/admin/${this.server.getProjectId()}/${path.join('/')}`);
  }
}
