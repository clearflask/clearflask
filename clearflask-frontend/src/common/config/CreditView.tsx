import { Table, TableBody, TableCell, createStyles, withStyles, WithStyles, Theme } from '@material-ui/core';
import React, { Component } from 'react';
import * as Client from '../../api/client';

const styles = (theme:Theme) => createStyles({
  root: {
    whiteSpace: 'nowrap',
  },
});

interface Props extends WithStyles<typeof styles> {
  val:number;
  credits:Client.Credits;
}

class CreditView extends Component<Props> {
  render() {
    return (
      <span className={this.props.classes.root}>
        {CreditView.formatCredit(this.props.val, this.props.credits)}
      </span>
    );
  }

  static formatCredit(val, credits:Client.Credits) {
    if(credits.increment === undefined) {
      val = Math.floor(val);
    } else {
      val = Math.floor(val / credits.increment) * credits.increment;
    }
    if(credits.formats) {
      for (let i = 0; i < credits.formats.length; i++) {
        const format = credits.formats[i];
        if(format.greaterOrEqual !== undefined && val < format.greaterOrEqual) {
          continue;
        }
        if(format.lessOrEqual !== undefined && val > format.lessOrEqual) {
          continue;
        }
        if(format.multiplier !== undefined) {
          val *= format.multiplier
        }
        if(format.maximumFractionDigits !== undefined) {
          const exp = Math.pow(10, format.maximumFractionDigits);
          val = Math.floor(val * exp) / exp;
        }
        val = val.toLocaleString('en-US', {
          minimumFractionDigits: format.minimumFractionDigits || undefined,
        });
        return (format.prefix || '')
        + val
        + (format.suffix || '')
      }
    }
    return val;
  }

}

export default withStyles(styles, { withTheme: true })(CreditView);
