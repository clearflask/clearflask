import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import LogIn from '../comps/LogIn';

interface Props {
  children: React.ReactNode,
  server: Server;
}
interface ConnectProps {
  onboardBefore?: Client.Onboarding;
  config?: Client.Config;
  loggedInUser?: Client.UserMe;
}
class PrivateProjectLogin extends Component<Props & ConnectProps> {
  render() {
    const visibility = (this.props.onboardBefore?.visibility || this.props.config?.users.onboarding.visibility);
    const isLoaded = !!visibility;
    const isPrivate = visibility !== Client.OnboardingVisibilityEnum.Public;
    const isLoggedIn = !!this.props.loggedInUser;
    const showContent = !isPrivate || isLoggedIn;
    const showLogin = isLoaded && isPrivate && !isLoggedIn;

    return (
      <>
        {showContent ? this.props.children : null}
        <LogIn
          key='login'
          actionTitle='Project is private'
          server={this.props.server}
          open={showLogin}
          onLoggedInAndClose={() => this.props.server.dispatch().then(d => d.configAndUserBindSlug({
            slug: this.props.server.getStore().getState().conf.conf?.slug!,
            userBind: {},
          }))}
        />
      </>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    loggedInUser: state.users.loggedIn.user,
    onboardBefore: state.conf.onboardBefore,
    config: state.conf.conf,
  };
})(PrivateProjectLogin);
