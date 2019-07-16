import React from 'react';
import { StripeProvider} from 'react-stripe-elements';

interface Props {
  stripeKey:string;
  onReady?:(stripe:stripe.Stripe)=>void;
  onError?:OnErrorEventHandler;
}

interface State {
  stripe?:stripe.Stripe;
}

export default class StripeProviderProvider extends React.Component<Props,State> {
  state:State={};
  static stripeScriptElement;

  componentDidMount() {
    const onWindowStripeReady = () => {
      const stripe = window['Stripe'](this.props.stripeKey);
      this.setState({
        stripe: stripe,
      });
      this.props.onReady && this.props.onReady(stripe);
    }
    if (window['Stripe']) {
      onWindowStripeReady()
    } else if(StripeProviderProvider.stripeScriptElement) {
      StripeProviderProvider.stripeScriptElement.addEventListener('load', onWindowStripeReady);
    } else {
      this.state = {
        stripe: undefined,
      };
      StripeProviderProvider.stripeScriptElement = document.createElement("script");
      StripeProviderProvider.stripeScriptElement.src='https://js.stripe.com/v3/';
      if(this.props.onError)StripeProviderProvider.stripeScriptElement.onerror=this.props.onError;
      StripeProviderProvider.stripeScriptElement.onload=onWindowStripeReady;
      document.body.appendChild(StripeProviderProvider.stripeScriptElement);
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if(this.props.onReady && prevState.stripe === undefined && this.state.stripe !== undefined) {
      this.props.onReady(this.state.stripe);
    }
  }

  render() {
    return (
      <StripeProvider stripe={this.state.stripe || null}>
        {this.props.children}
      </StripeProvider>
    );
  }
}
