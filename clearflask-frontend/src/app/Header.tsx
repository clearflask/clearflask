import React, { Component } from 'react';
import { Api, Conf } from '../api/client';

interface Props {
  api:Api;
  conf?:Conf;
}

class Header extends Component<Props> {

  render() {
    return (
      <div>
        ClearFlask
      </div>
    );
  }
}

export default Header;
