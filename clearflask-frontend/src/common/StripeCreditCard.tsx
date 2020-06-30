import React from 'react';
import { CardNumberElement, CardExpiryElement, CardCvcElement } from '@stripe/react-stripe-js';
import CreditCard from './CreditCard';

interface Props {
}
interface State {
  cardBrand?: string;
}
export default class StripeCreditCard extends React.Component<Props, State> {
  state:State = {};
  render() {
    return (
      <CreditCard
        brand={this.state.cardBrand?.toUpperCase()}
        numberInput={(
          <CardNumberElement onChange={e => {
            this.setState({ cardBrand: e.brand === 'unknown' ? undefined : e.brand });
          }} />
        )}
        expiryInput={(
          <CardExpiryElement />
        )}
        cvcInput={(
          <CardCvcElement />
        )}
      />
    );
  }
}
