import { connect } from 'react-redux';
import { ReduxState, Server } from '../../api/server';

interface Props {
  server: Server;
}

interface ConnectProps {
  ssoEnabled: boolean;
}

const SsoLogin = connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  return {
    ssoEnabled: state.conf.conf && !!state.conf.conf.users.onboarding.notificationMethods/*.singleSignOn*/ || false,
  }
})((props: Props & ConnectProps) => {
  throw new Error("SSO not yet supported");
  // if(!props.ssoEnabled) return null;

  // const url = new URL(window.location.href);
  // const sso = url.searchParams.get('sso');

  // if(!sso) return null;

  // props.server.dispatch().userSsoCreateOrLogin({
  //   projectId: props.server.getProjectId(),
  //   userSsoCreateOrLogin: { token: sso },
  // });

  // return null;
});

export default SsoLogin;
