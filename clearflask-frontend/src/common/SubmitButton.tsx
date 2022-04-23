// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, ButtonProps, CircularProgress } from '@material-ui/core';
import classNames from 'classnames';
import React, { Component } from 'react';

interface Props {
  buttonRef?: ButtonProps['ref'];
  isSubmitting?: boolean;
}
interface State {
  clicked?: boolean;
}
export default class SubmitButton extends Component<Props & React.ComponentPropsWithoutRef<typeof Button>, State> {
  state: State = {};

  static getDerivedStateFromProps(props: React.ComponentProps<typeof SubmitButton>, state: State): Partial<State> | null {
    if (!props.isSubmitting && !!state.clicked) {
      return { clicked: undefined };
    }
    return null;
  }

  render() {
    const { isSubmitting, children, ...buttonProps } = this.props;
    return (
      <Button
        ref={this.props.buttonRef}
        {...buttonProps}
        className={classNames(buttonProps.className)}
        disabled={isSubmitting || buttonProps.disabled}
        onClick={e => {
          this.setState({ clicked: true });
          buttonProps.onClick && buttonProps.onClick(e)
        }}
        style={{
          ...buttonProps.style,
          position: 'relative',
        }}
      >
        {(this.state.clicked && this.props.isSubmitting) && (
          <CircularProgress
            color={buttonProps.color !== 'default' && buttonProps.color || 'inherit'}
            size={24}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: -12,
              marginLeft: -12,
            }}
          />
        )}
        {children}
      </Button>
    );
  }
}
