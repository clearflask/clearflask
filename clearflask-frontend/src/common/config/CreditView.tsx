import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core';
import { red } from '@material-ui/core/colors';
import React, { Component } from 'react';
import * as Client from '../../api/client';

const styles = (theme: Theme) => createStyles({
  root: {
    whiteSpace: 'nowrap',
  },
  negative: {
    color: theme.palette.type === 'light' ? red.A700 : red.A100,
  },
  negativeBrackets: {
    opacity: 0.6,
  },
});

interface Props extends WithStyles<typeof styles, true> {
  val: number;
  credits: Client.Credits;
}

class CreditView extends Component<Props> {
  render() {
    return this.formatCredit(this.props.val, this.props.credits);
  }

  formatCredit(val, credits: Client.Credits) {
    const isNegative = val < 0;
    val = Math.abs(val);
    if (credits.increment === undefined) {
      val = Math.floor(val);
    } else {
      val = Math.floor(val / credits.increment) * credits.increment;
    }
    if (credits.formats) {
      for (let i = 0; i < credits.formats.length; i++) {
        const format = credits.formats[i];
        if (format.greaterOrEqual !== undefined && val < format.greaterOrEqual) {
          continue;
        }
        if (format.lessOrEqual !== undefined && val > format.lessOrEqual) {
          continue;
        }
        if (format.multiplier !== undefined) {
          val *= format.multiplier
        }
        if (format.maximumFractionDigits !== undefined) {
          const exp = Math.pow(10, format.maximumFractionDigits);
          val = Math.floor(val * exp) / exp;
        }
        val = val.toLocaleString('en-US', {
          minimumFractionDigits: format.minimumFractionDigits || undefined,
        });
        val = (format.prefix || '')
          + val
          + (format.suffix || '')
        break;
      }
    }
    return (
      <span className={`${this.props.classes.root} ${isNegative ? this.props.classes.negative : ''}`}>
        {isNegative && (<span className={this.props.classes.negativeBrackets}>(</span>)}
        {val}
        {isNegative && (<span className={this.props.classes.negativeBrackets}>)</span>)}
      </span>
    )
  }
}

export default withStyles(styles, { withTheme: true })(CreditView);
