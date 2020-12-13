import { Box } from '@material-ui/core';
import React, { Component } from 'react';
import { vh } from '../common/util/vhUtil';
import Loading from './utils/Loading';

export default class LoadingPage extends Component {
  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height={vh(100)}
      >
        <Loading />
      </Box>
    );
  }
}
