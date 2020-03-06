import React from 'react';
import { Elements, injectStripe, ReactStripeElements, StripeProvider } from 'react-stripe-elements';

interface Props {
  stripeKey: string;
  onStripeReady?: (stripe: stripe.Stripe) => void;
  onStripeElementsReady?: (stripeElements: ReactStripeElements.StripeProps) => void;
  onError?: OnErrorEventHandler;
}

interface State {
  stripe?: stripe.Stripe;
}

export default class StripeProviderProvider extends React.Component<Props, State> {
  state: State = {};
  static stripeScriptElement;
  stripeElementsReady: boolean = false

  componentDidMount() {
    const onWindowStripeReady = () => {
      const stripe = window['Stripe'](this.props.stripeKey);
      this.setState({
        stripe: stripe,
      });
      this.props.onStripeReady && this.props.onStripeReady(stripe);
    }
    if (window['Stripe']) {
      onWindowStripeReady()
    } else if (StripeProviderProvider.stripeScriptElement) {
      StripeProviderProvider.stripeScriptElement.addEventListener('load', onWindowStripeReady);
    } else {
      this.setState({
        stripe: undefined,
      });
      StripeProviderProvider.stripeScriptElement = document.createElement("script");
      StripeProviderProvider.stripeScriptElement.src = 'https://js.stripe.com/v3/';
      if (this.props.onError) StripeProviderProvider.stripeScriptElement.onerror = this.props.onError;
      StripeProviderProvider.stripeScriptElement.onload = onWindowStripeReady;
      document.body.appendChild(StripeProviderProvider.stripeScriptElement);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.onStripeReady && prevState.stripe === undefined && this.state.stripe !== undefined) {
      this.props.onStripeReady(this.state.stripe);
    }
  }

  render() {
    return (
      <StripeProvider stripe={this.state.stripe || null}>
        <Elements>
          <ExposeStripeElements onElementsStripe={this.onElementsStripe.bind(this)}>
            {this.props.children}
          </ExposeStripeElements>
        </Elements>
      </StripeProvider>
    );
  }

  onElementsStripe(stripeElements: ReactStripeElements.StripeProps) {
    if (!this.stripeElementsReady) {
      this.props.onStripeElementsReady && this.props.onStripeElementsReady(stripeElements);
    }
    this.stripeElementsReady = true;
  }
}

interface ExposeStripeElementsProps extends ReactStripeElements.InjectedStripeProps {
  onElementsStripe?: (stripeElements: ReactStripeElements.StripeProps) => void;
  children: any;
}

const ExposeStripeElements = injectStripe((props: ExposeStripeElementsProps) => {
  if (props.stripe && props.onElementsStripe) {
    props.onElementsStripe(props.stripe);
  }
  return props.children;
});
