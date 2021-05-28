import React from 'react';
import ErrorMsg from '../app/ErrorMsg';
import Loading, { Props as LoadingProps } from '../app/utils/Loading';
import windowIso from './windowIso';

interface Props<T> extends LoadingProps {
  // Use if you want to completely re-render content on promise change
  key?: string,
  // Use if you want to keep the existing content and simply update it using a new promise.
  // Keep in mind undefined and number zero is treated as same
  promiseKey?: string | number,
  promise: Promise<T>,
  render: (val: T) => React.ReactNode,
  renderError?: (err) => React.ReactNode,
  renderLoading?: () => React.ReactNode,
}
interface State<T> {
  resultForPromiseKey?: string | number,
  val?: T;
  error?: any;
}
class Promised<T> extends React.Component<Props<T>, State<T>> {
  state: State<T> = {};
  waitingForPromiseKey?: string | number;

  render() {
    const promiseKey = this.props.promiseKey !== undefined ? this.props.promiseKey : '';
    if (this.waitingForPromiseKey !== promiseKey) {
      this.waitingForPromiseKey = promiseKey;
      if (!windowIso.isSsr) {
        this.props.promise
          .then(val => (this.waitingForPromiseKey === promiseKey) && this.setState({
            resultForPromiseKey: promiseKey,
            val,
            error: undefined,
          }))
          .catch(error => (this.waitingForPromiseKey === promiseKey) && this.setState({
            resultForPromiseKey: promiseKey,
            val: undefined,
            error,
          }));
      }
    }

    return this.state.resultForPromiseKey === undefined
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
