import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';

export const SCROLL_TO_STATE_KEY = 'scrollTo';

export interface Props {
  scrollOnNavigate?: boolean;
  scrollOnMount?: boolean;
  scrollOnStateName?: string;
  scrollOnAnchorTag?: string;
  positionVertical?: ScrollLogicalPosition;
  positionHorizontal?: ScrollLogicalPosition;
}
class ScrollAnchor extends Component<Props & RouteComponentProps> {
  readonly scrollToRef: React.RefObject<HTMLDivElement> = React.createRef();
  unlisten?: () => void;

  async scrollNow() {
    await new Promise(resolve => setTimeout(resolve, 1));
    if (!this.scrollToRef.current) {
      return;
    }

    // TODO polyfill or go back to window.scrollTo
    this.scrollToRef.current.scrollIntoView({
      behavior: 'smooth',
      block: this.props.positionVertical || 'center',
      inline: this.props.positionHorizontal || 'nearest',
    });
  }

  static scrollToState(anchorName: string) {
    return {
      [SCROLL_TO_STATE_KEY]: anchorName
    }
  }

  render() {
    return (
      <span ref={this.scrollToRef}>
        {this.props.children}
      </span>
    );
  }

  constructor(props) {
    super(props);

    if (this.props.scrollOnNavigate || !!this.props.scrollOnStateName) {
      this.unlisten = this.props.history.listen((location, action) => {
        if (action !== 'PUSH') {
          return;
        }
        if (this.props.scrollOnNavigate
          && !location.state?.[SCROLL_TO_STATE_KEY]
          && !this.props.location?.hash) {
          this.scrollNow();
          return;
        }
        if (!!this.props.scrollOnStateName
          && this.props.scrollOnStateName === location.state?.[SCROLL_TO_STATE_KEY]) {
          this.scrollNow();
          return;
        }
      });
    }

    if (this.props.scrollOnMount) {
      this.scrollNow();
    }

    if (!!this.props.scrollOnStateName
      && this.props.scrollOnStateName === this.props.location.state?.[SCROLL_TO_STATE_KEY]) {
      this.scrollNow();
      return;
    }

    if (this.props.scrollOnAnchorTag
      && this.props.location?.hash.substr(1) === this.props.scrollOnAnchorTag) {
      this.scrollNow();
      return;
    }
  }

  componentWillUnmount() {
    this.unlisten && this.unlisten();
  }
}

export default withRouter(ScrollAnchor);
