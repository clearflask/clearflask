// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Box, createStyles, Theme, WithStyles, withStyles } from '@material-ui/core';
import React, { Component } from 'react';
import PageNotFoundImg from '../../public/img/landing/404.svg';
import ImgIso from '../common/ImgIso';
import Message from '../common/Message';

const styles = (theme: Theme) => createStyles({
  message: {
    margin: '80px auto',
    width: 'fit-content',
    minWidth: 'unset',
  },
  pageNotFound: {
    width: 300,
    margin: theme.spacing(4),
  },
});
interface Props {
  msg?: string | React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info';
  height?: string | number | undefined;
  pageNotFound?: boolean;
}
class ErrorPage extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        width='100%'
        height='100%'
      >
        {!!this.props.msg && (
          <Message className={this.props.classes.message}
            message={this.props.msg}
            severity={this.props.variant || 'error'}
          />
        )}
        {!!this.props.pageNotFound && (
          <ImgIso className={this.props.classes.pageNotFound} alt='Page not found' img={PageNotFoundImg} />
        )}
      </Box>
    );
  }
}

export default withStyles(styles, { withTheme: true })(ErrorPage);
