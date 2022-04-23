// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
interface Props {
  val: number;
  credits: Client.Credits;
}
class CreditView extends Component<Props> {
  /** If changed, also change CreditViewUtil.java */
  render() {
    const format = creditGetFormat(this.props.val, this.props.credits);
    const valFormatted = format ? creditFormatVal(this.props.val, format) : this.props.val;
    return (
      <CreditVal
        valFormatted={valFormatted}
        isNegative={this.props.val < 0}
      />
    )
  }
}

/** If changed, also change CreditViewUtil.java */
export const creditGetFormat = (val: number, credits: Client.Credits): Client.CreditFormatterEntry | undefined => {
  if (!credits?.formats) return;
  const valAbs = Math.abs(val);
  return credits.formats.find(format => {
    if (format.greaterOrEqual !== undefined && valAbs < format.greaterOrEqual) {
      return false;
    }
    if (format.lessOrEqual !== undefined && valAbs > format.lessOrEqual) {
      return false;
    }
    return true;
  });
};

/** If changed, also change CreditViewUtil.java */
export const creditFormatVal = (val: number, format: Client.CreditFormatterEntry, suppressSuffix: boolean = false) => {
  var result: any = val;

  result = Math.abs(result);

  if (format.multiplier !== undefined) {
    result *= format.multiplier
  }

  if (format.maximumFractionDigits !== undefined) {
    const exp = Math.pow(10, format.maximumFractionDigits);
    result = Math.floor(result * exp) / exp;
  }

  result = result.toLocaleString('en-US', {
    minimumFractionDigits: format.minimumFractionDigits || undefined,
  });

  result = `${format.prefix || ''}${result}${!!format.suffix && !suppressSuffix ? format.suffix : ''}`;

  return result;
};

/** If changed, also change CreditViewUtil.java */
export const CreditVal = withStyles(styles, { withTheme: true })((props:
  { valFormatted: string, isNegative: boolean }
  & WithStyles<typeof styles, true>) => {
  return (
    <span className={`${props.classes.root} ${props.isNegative ? props.classes.negative : ''}`}>
      {props.isNegative && (<span className={props.classes.negativeBrackets}>(</span>)}
      {props.valFormatted}
      {props.isNegative && (<span className={props.classes.negativeBrackets}>)</span>)}
    </span>
  )
});

export default CreditView;
