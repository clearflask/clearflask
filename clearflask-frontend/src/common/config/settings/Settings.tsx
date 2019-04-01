import React, { Component } from 'react';
import Editor, * as ConfigEditor from '../configEditor';
import { Grid } from '@material-ui/core';
import Menu from './Menu';
import Page from './Page';
import { match, withRouter } from 'react-router';
import { History, Location, parsePath } from 'history';
import Message from '../../../app/comps/Message';

interface Props {
  editor:Editor;
  // Router matching
  match:match;
  history:History;
  location:Location;
}

interface State {
  currentPagePath:ConfigEditor.Path;
}

class Settings extends Component<Props, State> {

  constructor(props) {
    super(props);
  this.state = {currentPagePath: []}
  }

  componentDidMount() {
    this.props.editor.subscribe('settings', this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    this.props.editor.unsubscribe('settings');
  }

  render() {
    const activePath = ConfigEditor.parsePath(this.props.match.params['path'], '/');
    const rootPage = this.props.editor.getPage([]);
    var currentPage:ConfigEditor.Page|ConfigEditor.PageGroup;
    try {
      currentPage = this.props.editor.getPageOrPageGroup(activePath);
    } catch(ex) {
      return (
        <Message innerStyle={{margin: '40px auto'}}
          message='Oops, page failed to load'
          variant='error'
        />
      );
    }
    return (
      <div>
        Settings
        <Grid
          style={{paddingTop: '12px'}}
          container
          direction='row'
          justify='center'
          alignItems='baseline'
          spacing={16}
        >
          <Grid item xs={2}>
            <Menu
              page={rootPage}
              activePath={activePath}
              pageClicked={path => {
                this.props.history.push(`/admin/${path.join('/')}`);
              }}
            />
          </Grid>
          <Grid item xs={10}>
            <Page page={currentPage} />
          </Grid>
        </Grid>
        <pre>
          {JSON.stringify(rootPage, null, 2)}
        </pre>
      </div>
    );
  }
}

export default withRouter(Settings);
