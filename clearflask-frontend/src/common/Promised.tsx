// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import ErrorMsg from '../app/ErrorMsg';
import Loading from '../app/utils/Loading';
import windowIso from './windowIso';

interface Props<T> extends React.ComponentProps<typeof Loading> {
  // Use if you want to completely re-render content on promise change
  key?: string,
  promise: Promise<T>,
  render: (val: T) => React.ReactNode,
  renderError?: (err) => React.ReactNode,
  renderLoading?: () => React.ReactNode,
}
interface State<T> {
  resultForPromise?: object,
  val?: T;
  error?: any;
}
class Promised<T> extends React.Component<Props<T>, State<T>> {
  state: State<T> = {};
  waitingForPromise?: object;

  render() {
    const promiseCurrent = this.props.promise;
    if (this.waitingForPromise !== promiseCurrent) {
      this.waitingForPromise = promiseCurrent;
      if (!windowIso.isSsr) {
        promiseCurrent
          .then(val => (this.waitingForPromise === promiseCurrent) && this.setState({
            resultForPromise: promiseCurrent,
            val,
            error: undefined,
          }))
          .catch(error => (this.waitingForPromise === promiseCurrent) && this.setState({
            resultForPromise: promiseCurrent,
            val: undefined,
            error,
          }));
      }
    }

    return this.state.resultForPromise === undefined
      ? (this.props.renderLoading ? this.props.renderLoading() : (<Loading {...this.props} />))
      : (this.state.val !== undefined
        ? this.renderVal(this.state.val)
        : this.renderError(this.state.error));
  }

  renderVal(val: T) {
    return this.props.render(val);
  }

  renderError(error: any) {
    return this.props.renderError
      ? this.props.renderError(this.state.error)
      : (<ErrorMsg msg='Failed to load' />);
  }
}

export default Promised;
