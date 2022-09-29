// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Fade } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  creditCard: {
    border: '1px solid ' + theme.palette.grey[300],
    borderRadius: 10,
    backgroundColor: theme.palette.background.paper,
    display: 'inline-grid',
    gridTemplateColumns: '15px auto auto auto 15px',
    gridTemplateRows: '18px 24px 10px 17px 10px 17px 10px',
    gridTemplateAreas:
      "'. . . . .'"
      + " '. h . b .'"
      + " '. . . . .'"
      + " '. n n n .'"
      + " '. . . . .'"
      + " '. e . c .'"
      + " '. . . . .'",
  },
  numberInput: {
    gridArea: 'n',
    width: 140,
  },
  expiryInput: {
    gridArea: 'e',
    width: 54,
  },
  cvcInput: {
    gridArea: 'c',
    width: 34,
    justifySelf: 'end',
  },
  brand: {
    gridArea: 'b',
    alignSelf: 'center',
    fontSize: '0.8em',
    color: theme.palette.text.secondary,
    // width: 20,
  },
  chip: {
    width: 27,
    height: 20,
    gridArea: 'h',
    border: '1px solid ' + theme.palette.grey[300],
    borderRadius: 5,
    overflow: 'hidden',
    display: 'grid',
    gridTemplateAreas:
      "'. b .'"
      + " 'a b c'"
      + " '. b d'",
  },
  chipA: {
    gridArea: 'a',
    borderTop: '1px solid ' + theme.palette.grey[300],
    borderBottom: '1px solid ' + theme.palette.grey[300],
  },
  chipB: {
    gridArea: 'b',
    borderLeft: '1px solid ' + theme.palette.grey[300],
  },
  chipC: {
    gridArea: 'c',
    borderTop: '1px solid ' + theme.palette.grey[300],
    borderLeft: '1px solid ' + theme.palette.grey[300],
  },
  chipD: {
    gridArea: 'd',
    borderTop: '1px solid ' + theme.palette.grey[300],
    borderLeft: '1px solid ' + theme.palette.grey[300],
  },
});
interface Props {
  className?: string;
  brand?: React.ReactNode;
  numberInput: React.ReactNode;
  expiryInput: React.ReactNode;
  cvcInput: React.ReactNode;
}
class CreditCard extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    return (
      <div className={classNames(this.props.className, this.props.classes.creditCard)}>
        <div className={this.props.classes.numberInput}>{this.props.numberInput}</div>
        <div className={this.props.classes.expiryInput}>{this.props.expiryInput}</div>
        <div className={this.props.classes.cvcInput}>{this.props.cvcInput}</div>
        <div className={this.props.classes.brand}>
          <Fade in={!!this.props.brand}>
            <div>{this.props.brand}</div>
          </Fade>
        </div>
        <div className={this.props.classes.chip}>
          <div className={classNames(this.props.classes.chipA)} />
          <div className={classNames(this.props.classes.chipB)} />
          <div className={classNames(this.props.classes.chipC)} />
          <div className={classNames(this.props.classes.chipD)} />
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(CreditCard);
