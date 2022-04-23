// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import ServerAdmin from '../api/serverAdmin';
import Loader from '../app/utils/Loader';
import setTitle from '../common/util/titleUtil';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  invoiceId: number;
}
interface State {
  invoiceHtml?: string;
  error?: string;
}
class InvoicePage extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};
  constructor(props) {
    super(props);

    setTitle('Invoice');

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
