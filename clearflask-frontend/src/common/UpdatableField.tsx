import { Button, IconButton, TextField, InputAdornment } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import React, { Component } from 'react';

const styles = (theme: Theme) => createStyles({
  wrapper: {
    display: 'flex',
  },
});

interface Props {
  value?: string;
  onSave: (value: string) => Promise<any>;
  isPassword?: boolean;
}

interface State {
  value?: string;
  isSubmitting?: boolean;
  revealPassword?: boolean;
}

class UpdatableField extends Component<Props & WithStyles<typeof styles, true>, State> {
  state: State = {};

  render() {
    return (
      <div className={this.props.classes.wrapper}>
        <TextField
          value={this.state.value === undefined
            ? this.props.value || ''
            : this.state.value || ''}
          onChange={e => this.setState({ value: e.target.value })}
          type={!this.props.isPassword || this.state.revealPassword ? 'text' : 'password'}
          disabled={this.state.isSubmitting}
          InputProps={{
            endAdornment: this.props.isPassword ? (
              <InputAdornment position='end'>
                <IconButton
                  aria-label='Toggle password visibility'
                  onClick={() => this.setState({ revealPassword: !this.state.revealPassword })}
                  disabled={this.state.isSubmitting}
                >
                  {this.state.revealPassword ? <VisibilityIcon fontSize='small' /> : <VisibilityOffIcon fontSize='small' />}
                </IconButton>
              </InputAdornment>
            ) : undefined,
          }}
        />
        <Button
          aria-label="Save"
          color='primary'
          style={{
            visibility: !this.state.value || this.state.value === this.props.value
              ? 'hidden' : undefined
          }}
          disabled={this.state.isSubmitting}
          onClick={() => {
            this.setState({ isSubmitting: true });
            this.props.onSave(this.state.value || '')
              .then(() => this.setState({
                isSubmitting: false,
                value: this.props.value,
              }))
              .catch(e => this.setState({
                isSubmitting: false,
              }));
          }}
        >
          Save
          </Button>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(UpdatableField);
