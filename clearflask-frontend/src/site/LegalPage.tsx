import { NoSsr } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Admin from '../api/admin';
import { Status } from '../api/server';
import ServerAdmin, { ReduxStateAdmin } from '../api/serverAdmin';
import Loader from '../app/utils/Loader';
import MarkdownElement from '../app/utils/MarkdownElement';

const styles = (theme: Theme) => createStyles({
  page: {
    maxWidth: '1024px',
    margin: '0px auto',
  },
});

interface Props {
  type: 'terms' | 'privacy';
}
interface ConnectProps {
  callOnMount?: () => void,
  legal?: Admin.LegalResponse;
  legalStatus?: Status;
}

class LegalPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  constructor(props) {
    super(props);

    props.callOnMount?.();
  }

  render() {
    var doc: string | undefined;
    switch (this.props.type) {
      case 'terms':
        doc = this.props.legal?.terms;
        break;
      case 'privacy':
        doc = this.props.legal?.privacy;
        break;
    }
    return (
      <div className={this.props.classes.page}>
        <Loader status={this.props.legalStatus}>
          <NoSsr>
            <MarkdownElement text={doc} />
          </NoSsr>
        </Loader>
      </div>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  const newProps: ConnectProps = {
    legal: state.legal.legal,
    legalStatus: state.legal.status,
  };
  if (state.legal.status === undefined) {
    newProps.callOnMount = () => {
      ServerAdmin.get().dispatchAdmin({ ssr: true }).then(d => d.legalGet());
    };
  }
  return newProps;
})(withStyles(styles, { withTheme: true })(LegalPage));
