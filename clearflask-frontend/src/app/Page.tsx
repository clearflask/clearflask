import React, { Component } from 'react';
import { Api, Conf } from '../api/client';
import { match } from 'react-router';
import Loading from './comps/Loading';
import Message from './comps/Message';

interface Props {
  api:Api;
  conf?:Conf;
  // Router matching
  match:match;
}

class Page extends Component<Props> {

  render() {
    if(!this.props.conf) {
      return (
        <Loading />
      );
    }

    const page = this.props.conf.pages!.find(p => p.urlName === this.props.match.params.page);
    if(!page) {
      return (
        <Message
          message='Page not found :/'
          variant='error'
        />
      );
    }

    return (
      <div>
        Page '{this.props.match.params.page}'
      </div>
    );
  }
}

export default Page;
