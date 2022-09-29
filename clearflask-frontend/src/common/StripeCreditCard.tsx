// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import CreditCard from './CreditCard';

interface Props {
  onFilledChanged: (isFilled:boolean)=>void;
}
interface State {
  cardBrand?: string;
  numberComplete?: boolean;
  expiryComplete?: boolean;
  cvcComplete?: boolean;
}
export default class StripeCreditCard extends React.Component<Props, State> {
  state:State = {};
  lastIsFilled:boolean = false;

  render() {
    return (
      <CreditCard
        brand={this.state.cardBrand?.toUpperCase()}
        numberInput={(
          <CardNumberElement
            onChange={e => {
              const isFilled = e.complete && !!this.state.expiryComplete && !!this.state.cvcComplete;
              this.lastIsFilled !== isFilled && this.props.onFilledChanged(isFilled);
              this.lastIsFilled = isFilled;
              this.setState({
                cardBrand: e.brand === 'unknown' ? undefined : e.brand,
                numberComplete: e.complete,
              });
            }}
          />
        )}
        expiryInput={(
          <CardExpiryElement
            onChange={e => {
              const isFilled = !!this.state.numberComplete && e.complete && !!this.state.cvcComplete;
              this.lastIsFilled !== isFilled && this.props.onFilledChanged(isFilled);
              this.lastIsFilled = isFilled;
              this.setState({
                expiryComplete: e.complete,
              });
            }}
          />
        )}
        cvcInput={(
          <CardCvcElement
            onChange={e => {
              const isFilled = !!this.state.numberComplete && !!this.state.expiryComplete && e.complete;
              this.lastIsFilled !== isFilled && this.props.onFilledChanged(isFilled);
              this.lastIsFilled = isFilled;
              this.setState({
                cvcComplete: e.complete,
              });
            }}
          />
        )}
      />
    );
  }
}
