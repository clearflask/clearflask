import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Status } from '../../api/server';
import { ReactLiquid } from 'react-liquid';

interface Props {
  template: string;
  customPageSlug?: string;
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  page?: Client.Page;
  loggedInUser?: Client.UserMe;
  state: ReduxState;
}
class TemplateLiquid extends Component<Props & ConnectProps > {
  render() {
    return (
      <ReactLiquid
        html
        template={this.props.template}
        data={{
          config: this.props.config,
          page: this.props.page,
          loggedInUser: this.props.loggedInUser,
          core: this.props.state,
        }}
      />
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var page: Client.Page | undefined = undefined;
  if (ownProps.customPageSlug && state.conf.status === Status.FULFILLED && state.conf.conf) {
    const pages = state.conf.conf.layout.pages;
    page = pages.find(p => p.slug === ownProps.customPageSlug);
    if (!page && pages.length > 0) {
      page = pages[0];
    }
  }
  const connectProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    page: page,
    loggedInUser: state.users.loggedIn.user,
    state: state,
  };
  return connectProps;
}, null, null, { forwardRef: true })(TemplateLiquid);