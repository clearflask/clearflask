import React, { Component } from 'react';
import Editor, * as ConfigEditor from '../configEditor';
import { Grid } from '@material-ui/core';
import Menu from './Menu';
import Page from './Page';

interface Props {
  editor:Editor;
}

interface State {
  currentPagePath:ConfigEditor.Path;
}

class Settings extends Component<Props, State> {

  constructor(props) {
    super(props);
  this.state = {currentPagePath: []}
  }

  render() {
    const rootPage = this.props.editor.getPage([]);
    const page = this.props.editor.getPage(this.state.currentPagePath);
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
              pageClicked={this.pageClicked.bind(this)}
            />
          </Grid>
          <Grid item xs={10}>
            <Page
              page={page}
            />
          </Grid>
        </Grid>
      </div>
    );
  }

  pageClicked(page:ConfigEditor.Page) {
    this.setState({currentPagePath: page.path});
  }
}

export default Settings;
