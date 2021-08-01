// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { Box, withTheme, WithTheme } from '@material-ui/core';
import React, { Component } from 'react';
import Loading from './utils/Loading';

class LoadingPage extends Component<WithTheme> {
  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height={this.props.theme.vh(100)}
      >
        <Loading />
      </Box>
    );
  }
}

export default withTheme(LoadingPage);
