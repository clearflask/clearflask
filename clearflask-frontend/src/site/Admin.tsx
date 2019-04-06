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
  readonly editor:ConfigEditor.Editor = new ConfigEditor.EditorImpl();

  constructor(props) {
    super(props);
    this.state = {currentPagePath: []}
  }

  render() {
    const activePath = ConfigEditor.parsePath(this.props.match.params['path'], '/');
    const rootPage = this.editor.getPage([]);
    var currentPage:ConfigEditor.Page;
    try {
      currentPage = this.editor.getPage(activePath);
    } catch(ex) {
      return (
        <Message innerStyle={{margin: '40px auto'}}
          message='Oops, page failed to load'
          variant='error'
        />
      );
    }

    return (
      <Layout
        toolbarLeft={(
          <Typography variant="h6" color="inherit" noWrap>
            Admin
          </Typography>
        )}
        preview={(
          <DemoApp editor={this.editor} />
        )}
        menu={(
          <Menu
            page={rootPage}
            activePath={activePath}
            pageClicked={this.pageClicked.bind(this)}
          />
        )}
      >
          <Page
            page={currentPage}
            pageClicked={this.pageClicked.bind(this)}
          />
      </Layout>
    );
  }

  pageClicked(path:ConfigEditor.Path):void {
    this.props.history.push(`/admin/${path.join('/')}`);
  }
}
