import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import React, { Component } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Server, Unsubscribe } from '../../api/server';

interface State {
  solved?: ((solution: string) => void);
  sitekey?: string;
}
export default class CaptchaChallenger extends Component<{}, State> {
  state: State = {};
  recaptchaRef: React.RefObject<ReCAPTCHA> = React.createRef();
  unsubscribe?: Unsubscribe;

  componentDidMount() {
    this.unsubscribe = Server._subscribeChallenger((challengeStr: string) => new Promise((resolve, reject) => {
      console.log('Server challenge: ' + challengeStr);
      var challenge = JSON.parse(challengeStr);
      if (challenge.version !== 'RECAPTCHA_V2' || !challenge.challenge) {
        reject(`Unknown challenge: ${challenge}`);
        return;
      }
      this.setState({
        solved: resolve,
        sitekey: challenge.challenge,
      });
    }));
  }

  componentWillUnmount() {
    this.unsubscribe && this.unsubscribe();
  }

  render() {
    return (
      <Dialog
        open={!!this.state.solved}
        scroll='body'
        PaperProps={{
          style: {
            width: 'fit-content',
            marginLeft: 'auto',
            marginRight: 'auto',
          },
        }}
      >
        <DialogTitle>Make sure you are human</DialogTitle>
        <DialogContent>
          <DialogContentText>Complete captcha challenge below to continue</DialogContentText>
          {this.state.sitekey && (
            <ReCAPTCHA
              ref={this.recaptchaRef}
              sitekey={this.state.sitekey}
              onChange={result => this.recaptchaOnChange(result)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => this.setState({ solved: undefined, sitekey: undefined })}>Cancel</Button>
        </DialogActions>
      </Dialog>
    );
  }

  recaptchaOnChange(result: string | null) {
    if (!this.state.solved) {
      this.setState({ solved: undefined, sitekey: undefined });
      return;
    }

    if (!result) {
      this.recaptchaRef.current && this.recaptchaRef.current.reset();
      return;
    }

    var solutionStr = JSON.stringify({
      version: 'RECAPTCHA_V2',
      solution: result,
    });

    this.state.solved(solutionStr);
    this.setState({ solved: undefined, sitekey: undefined });
  }
}
