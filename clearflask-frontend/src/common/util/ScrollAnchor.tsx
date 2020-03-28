import { History, Location } from 'history';
import React, { Component } from 'react';
import { Route } from 'react-router';

interface Props {
  scrollOnMount?: boolean;
  scrollOnStateName?: string;
  scrollOnAnchorTag?: string;
}

class ScrollAnchor extends Component<Props> {
  static readonly SCROLL_TO_STATE_KEY = 'scrollTo';
  readonly scrollToRef: React.RefObject<HTMLDivElement> = React.createRef();
  location: Location | undefined = undefined;
  history: History | undefined = undefined;

  scrollNow() {
    if (!this.scrollToRef.current) {
      return;
    }
    // TODO polyfill or go back to window.scrollTo
    this.scrollToRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  static scrollToState(anchorName: string) {
    return {
      [ScrollAnchor.SCROLL_TO_STATE_KEY]: anchorName
    }
  }

  render() {
    return (
      <span ref={this.scrollToRef}>
        <Route render={props => {
          this.location = props.location;
          this.history = props.history;
          return null;
        }} />
      </span>
    );
  }

  componentDidMount() {
    if (this.props.scrollOnMount) {
      this.scrollNow();
      return;
    }
    if (this.props.scrollOnStateName
      && this.location
      && this.location.state
      && this.location.state[ScrollAnchor.SCROLL_TO_STATE_KEY] === this.props.scrollOnStateName) {
      this.scrollNow();
      // Clear state so a refresh will not navigate again
      if (this.history) {
        this.history.replace({
          ...this.location,
          state: {
            ...this.location.state,
            [ScrollAnchor.SCROLL_TO_STATE_KEY]: undefined,
          }
        });
      }
      return;
    }
    if (this.props.scrollOnAnchorTag
      && this.location
      && this.location.hash.substr(1) === this.props.scrollOnAnchorTag) {
      this.scrollNow();
      return;
    }
  }
}

export default ScrollAnchor;
