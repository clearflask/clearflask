// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  separator: {
    '&:before': {
      color: theme.palette.text.secondary,
      content: '"·"',
    },
    margin: theme.spacing(0.5),
  },
});

interface Props {
  delimiter?: React.ReactNode | string;
  delimiterLast?: React.ReactNode | string;
}

class Delimited extends Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (!Array.isArray(this.props.children)) {
      return this.props.children || null;
    }
    var delimiter: React.ReactNode = this.props.delimiter || (
      <div className={this.props.classes.separator} />
    );
    const result: React.ReactNode[] = [];
    for (let i = 0; i < this.props.children.length; i++) {
      if (i === this.props.children.length - 1 && this.props.delimiterLast !== undefined) {
        delimiter = this.props.delimiterLast;
      }
      const el = this.props.children[i];
      if (!el) continue;
      if (i > 0) result.push(<span key={i}>{delimiter}</span>);
      result.push(el);
    }
    return result;
  }
}

export default withStyles(styles, { withTheme: true })(Delimited);
