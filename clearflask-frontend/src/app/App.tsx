import React, { Component } from 'react';
import { Api, Configuration, BASE_PATH, Conf } from '../api/client';
import DataMock from '../api/dataMock';
import { match } from 'react-router';
import Header from './Header';
import {
  Route,
  Switch,
} from 'react-router-dom'
import Page from './Page';

interface Props {
  // Router matching
  match:match;
}

interface State {
  conf?:Conf;
}

class App extends Component<Props, State> {
  api:Api;

  constructor(props) {
    super(props);
    this.state = {};

    this.api = this.getApi();
    this.api.getConfigApi().getConfig().then(conf => {
      this.setState({conf: conf});
    });
  }

  render() {
    return (
      <div>
        <Header api={this.api} conf={this.state.conf} />
        <Switch>
          <Route path={`${this.props.match.url}/:page?`} render={props => (
            <Page {...props} />
          )} />
        </Switch>
      </div>
    );
  }

  getApi():Api {
    if(this.props.match.params.projectName === 'demo') {
      // In-memory demo
      const mockServer = new DataMock().mockServerData();
      return new Api(new Configuration(), mockServer);
    } else {
      // Production
      return new Api(new Configuration({
        basePath: BASE_PATH.replace(/projectId/, this.props.match.params.projectName),
      }));
    }
  }
}

export default App;
