import React from 'react';
import ErrorMsg from '../app/ErrorMsg';
import Loading, { Props as LoadingProps } from '../app/utils/Loading';

interface Props<T> extends LoadingProps {
  promise: Promise<T>,
  render: (val: T) => React.ReactNode,
  renderError?: (err) => React.ReactNode,
  renderLoading?: () => React.ReactNode,
}

interface State<T> {
  result?: boolean,
  val?: T;
  error?: any;
}

class Promised<T> extends React.Component<Props<T>, State<T>> {
  state: State<T> = {};

  componentDidMount() {
    this.props.promise
      .then(val => this.setState({
        result: true,
        val,
      }));
    this.props.promise
      .catch(error => this.setState({
        result: false,
        error,
      }));
  }

  render() {
    return this.state.result === undefined
      ? (this.props.renderLoading ? this.props.renderLoading() : (<Loading {...this.props} />))
      : (this.state.result
        ? this.renderVal(this.state.val!)
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
