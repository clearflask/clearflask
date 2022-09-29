// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { Provider } from 'react-redux';
import { Server } from '../../api/server';
import AppThemeProvider from '../../app/AppThemeProvider';
import FundingControl from '../../app/comps/FundingControl';

const styles = (theme: Theme) => createStyles({
  content: {
    // position: 'relative',
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    height: '100%',
  },
});

interface Props {
  server: Server;
}
class FundingControlDemo extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <Provider store={this.props.server.getStore()}>
        <AppThemeProvider
          appRootId='fundingControlDemo'
          seed='fundingControlDemo'
          isInsideContainer={true}
          supressCssBaseline={true}
        >
          <div id='fundingControlDemo' className={this.props.classes.content}>
            <FundingControl
              className={this.props.classes.inner}
              server={this.props.server}
            />
          </div>
        </AppThemeProvider>
      </Provider>
    );
  }
}

export default withStyles(styles, { withTheme: true })(FundingControlDemo);
