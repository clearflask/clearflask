// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
