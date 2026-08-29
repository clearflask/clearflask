// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
      } else {
        // Server-side there is no second render to update, so there is nothing
        // to subscribe for — but the rejection still has to be claimed. Node
        // ends the process over a rejection nobody listened for, so without
        // this a post the viewer may not read takes down the worker rendering
        // it, along with every other request that worker is serving.
        promiseCurrent.catch(() => { });
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
