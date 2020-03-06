// Based off of https://gist.github.com/lfalke/1c5e7168424c8b2a65dcfba425fcc310

import { FormControl, FormHelperText, Input, InputLabel } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { PureComponent } from 'react';

interface StripeElementWrapperProps {
  component: any;
  label: string;
  onValidChanged: (isValid) => void;
}

interface StripeElementWrapperState {
  complete: boolean,
  focused: boolean,
  empty: boolean,
  error?: string,
}

export default class StripeElementWrapper extends PureComponent<StripeElementWrapperProps, StripeElementWrapperState> {
  state: StripeElementWrapperState = {
    complete: false,
    focused: false,
    empty: true,
  }

  handleBlur = () => {
    this.setState({ focused: false })
  }

  handleFocus = () => {
    this.setState({ focused: true })
  }

  handleChange = changeObj => {
    if (this.state.complete !== changeObj.complete) {
      this.props.onValidChanged(!!changeObj.complete);
    }
    this.setState({
      complete: !!changeObj.complete,
      error: changeObj.error ? changeObj.error.message || 'Invalid' : undefined,
      empty: !!changeObj.empty,
    })
  }

  render() {
    return (
      <div>
        <FormControl fullWidth required error={!!this.state.error}>
          <InputLabel
            focused={this.state.focused}
            shrink={this.state.focused || !this.state.empty}
            error={!!this.state.error}>
            {this.props.label}
          </InputLabel>
          <Input
            error={!!this.state.error}
            fullWidth
            inputComponent={StripeInput}
            inputProps={{
              onFocus: this.handleFocus,
              onBlur: this.handleBlur,
              onChange: this.handleChange,
              component: this.props.component
            }}
          />
        </FormControl>
        {this.state.error && (<FormHelperText error>{this.state.error}</FormHelperText>)}
      </div>
    );
  }
}

const StripeInputStyles = (theme: Theme) => createStyles({
  root: {
    width: '100%',
    padding: '6px 0 7px',
    cursor: 'text',
  },
});

interface StripeInputProps {
  classes: any,
  component?: any,
  onBlur: any,
  onFocus: any,
  onChange: any,
}

class StripeInputInternal extends PureComponent<StripeInputProps & WithStyles<typeof StripeInputStyles, true>> {

  static defaultProps = {
    onFocus: () => { },
    onBlur: () => { },
    onChange: () => { },
  }

  render() {
    const Component = this.props.component;

    return (
      <Component
        className={this.props.classes.root}
        onFocus={this.props.onFocus}
        onBlur={this.props.onBlur}
        onChange={this.props.onChange}
        placeholder=''
        style={{
          base: {
            fontSize: this.props.theme.typography.fontSize,
            fontFamily: this.props.theme.typography.fontFamily,
            color: '#000000de',
          },
        }}
      />
    )
  }
}
const StripeInput = withStyles(StripeInputStyles, { withTheme: true })(StripeInputInternal);
