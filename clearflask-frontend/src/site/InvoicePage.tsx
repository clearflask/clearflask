import { Box, Button, CardActions, CardHeader, Checkbox, Container, FormControlLabel, Grid, Paper, TextField, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { History } from 'history';
import React, { Component } from 'react';
import { match, Route } from 'react-router';
import ServerAdmin from '../api/serverAdmin';
import BasePage from '../app/BasePage';
import Message from '../common/Message';
import MuiAnimatedSwitch from '../common/MuiAnimatedSwitch';
import SubmitButton from '../common/SubmitButton';
import Loading from '../app/utils/Loading';
import Loader from '../app/utils/Loader';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  invoiceId: string;
}
interface State {
  invoiceHtml?: string;
  error?: string;
}
class InvoicePage extends Component<Props & WithStyles<typeof styles, true>, State> {
  state:State = {};
  constructor(props) {
    super(props);

    ServerAdmin.get().dispatchAdmin().then(d => d.invoiceHtmlGetAdmin({
      invoiceId: props.invoiceId,
    })).then(r => this.setState({
      invoiceHtml: r.invoiceHtml,
    })).catch(e => this.setState({
      error: 'Failed to load'
    }));
  }

  render() {
    return (
      <Loader loaded={!!this.state.invoiceHtml} error={this.state.error}>
        <div dangerouslySetInnerHTML={{ __html: this.state.invoiceHtml || '' }} />
      </Loader>
    );
  }
}

export default withStyles(styles, { withTheme: true })(InvoicePage);
