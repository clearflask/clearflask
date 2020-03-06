import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@material-ui/core';
import React, { Component } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Server } from '../../api/server';
import ServerAdmin from '../../api/serverAdmin';

export interface Props {
  server: Server | ServerAdmin;
}

interface State {
  solved?: ((solution: string) => void);
  sitekey?: string;
}

export default class CaptchaChallenger extends Component<Props, State> {
  state: State = {};
  recaptchaRef: React.RefObject<ReCAPTCHA> = React.createRef();

  constructor(props) {
    super(props);

    props.server.subscribeChallenger((challengeStr: string) => new Promise((resolve, reject) => {
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
