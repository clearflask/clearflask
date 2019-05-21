import React from 'react';
import { Server, ReduxState, Status } from '../../api/server';
import { connect } from 'react-redux';

interface Props {
  server:Server;
}

interface ConnectProps {
  ssoEnabled:boolean;
}

const SsoLogin = connect<ConnectProps,{},Props,ReduxState>((state, ownProps) => {return {
  ssoEnabled: state.conf.conf && !!state.conf.conf.users.onboarding.notificationMethods.singleSignOn || false,
}})((props:Props&ConnectProps) => {
  if(!props.ssoEnabled) return null;

  const url = new URL(window.location.href);
  const sso = url.searchParams.get('sso');

  if(!sso) return null;

  props.server.dispatch().userSsoCreateOrLogin({
    projectId: props.server.getProjectId(),
    token: sso,
  });

  return null;
});

export default SsoLogin;
