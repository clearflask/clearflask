import { createStyles, Theme, Typography, withStyles, WithStyles } from '@material-ui/core';
import { red } from '@material-ui/core/colors';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import { creditFormatVal, creditGetFormat, CreditVal } from './CreditView';

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
  numerator: number;
  numeratorClassName?: string;
  denominator?: number;
  denominatorClassName?: string;
  additionalSuffix?: string;
  credits: Client.Credits;
}

class CreditFractionView extends Component<Props> {
  render() {
    const nFormat = creditGetFormat(this.props.numerator, this.props.credits);
    const dFormat = this.props.denominator !== undefined ? creditGetFormat(this.props.denominator, this.props.credits) : undefined;
    const isSuffixSame = !!nFormat && !!dFormat && nFormat.suffix === dFormat.suffix;
    const nValFormatted = nFormat ? creditFormatVal(this.props.numerator, nFormat, isSuffixSame) : this.props.numerator;
    const dValFormatted = this.props.denominator !== undefined && dFormat ? creditFormatVal(this.props.denominator, dFormat) : this.props.denominator;
    return (
      <React.Fragment>
        <Typography variant='body1'>
          <span className={this.props.numeratorClassName}>
            <CreditVal
              valFormatted={nValFormatted}
              isNegative={this.props.numerator < 0}
            />
          </span>
        </Typography>
        <Typography variant='body1'>
          <span className={this.props.denominatorClassName} style={{
            display: 'flex',
            alignItems: 'flex-end',
            lineHeight: 'normal',
          }}>
            {this.props.denominator !== undefined && (
              <React.Fragment>
                &nbsp;/&nbsp;
                <CreditVal
                  valFormatted={dValFormatted}
                  isNegative={this.props.denominator < 0}
                />
              </React.Fragment>
            )}
          &nbsp;{this.props.additionalSuffix}
          </span>
        </Typography>
      </React.Fragment>
    );
  }
}

export default withStyles(styles, { withTheme: true })(CreditFractionView);
