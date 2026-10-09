// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { NoSsr } from '@material-ui/core';
import DangerouslySetInnerHtmlWithScriptExecution from 'dangerously-set-html-content';
import DOMPurify from 'dompurify';
import React, { Component } from 'react';
import { ReactLiquid } from 'react-liquid';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Status } from '../../api/server';
import { isSelfHostLike } from '../../common/util/detectEnv';
import ErrorBoundary from '../../common/util/ErrorBoundary';
import windowIso from '../../common/windowIso';

/**
 * Custom templates are allowed to contain arbitrary JS, but only on the project's own origin
 * (its subdomain or custom domain) where the JS can reach nothing beyond that project's
 * user session.
 *
 * The dashboard on the parent domain renders the very same templates in its live preview
 * while holding the account (and possibly super-admin "Login As") session. Any project admin
 * or invited collaborator could otherwise plant JS that runs against every other admin who
 * opens the dashboard, so there templates are rendered as static, sanitized HTML.
 *
 * Self-host serves dashboard and portal from one origin by design, so it keeps executing.
 */
export function templateScriptsAllowed(): boolean {
  if (windowIso.isSsr) return false;
  if (isSelfHostLike()) return true;
  return windowIso.location.hostname !== windowIso.parentDomain;
}

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
class TemplateLiquid extends Component<Props & ConnectProps> {
  render() {
    const scriptsAllowed = templateScriptsAllowed();
    return (
      <NoSsr>
        <ErrorBoundary hideOnError>
          <ReactLiquid
            template={this.props.template}
            data={{
              config: this.props.config,
              page: this.props.page,
              loggedInUser: this.props.loggedInUser,
              core: this.props.state,
            }}
            render={(renderedTemplate) => {
              if (!renderedTemplate?.__html) return null;
              return scriptsAllowed
                ? (<DangerouslySetInnerHtmlWithScriptExecution html={renderedTemplate.__html} />)
                : (<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedTemplate.__html) }} />);
            }}
          />
        </ErrorBoundary>
      </NoSsr>
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
