// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import React, { Component } from 'react';
import { RouteComponentProps, withRouter } from 'react-router';
import windowIso from '../windowIso';

export const SCROLL_TO_STATE_KEY = 'scrollTo';

export interface Props {
  scrollNow?: boolean;
  scrollOnNavigate?: boolean;
  scrollOnMount?: boolean;
  scrollOnStateName?: string;
  scrollOnAnchorTag?: string;
  positionVertical?: ScrollLogicalPosition;
  positionHorizontal?: ScrollLogicalPosition;
}
class ScrollAnchor extends Component<Props & RouteComponentProps> {
  readonly scrollToRef: React.RefObject<HTMLDivElement> = React.createRef();
  unlistenHistory?: () => void;

  async scrollNow() {
    if (windowIso.isSsr) {
      return;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 1));
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
      <span id={this.props.scrollOnAnchorTag} ref={this.scrollToRef}>
        {this.props.children}
      </span>
    );
  }

  constructor(props) {
    super(props);

    if (props.scrollOnNavigate || !!props.scrollOnStateName || props.scrollOnAnchorTag) {
      this.unlistenHistory = props.history.listen((location, action) => {
        if (action !== 'POP'
          && !!props.scrollOnStateName
          && props.scrollOnStateName === (location.state as any)?.[SCROLL_TO_STATE_KEY]) {
          this.scrollNow();
          return;
        }

        if (action !== 'POP'
          && props.scrollOnAnchorTag
          && location?.hash.substr(1) === props.scrollOnAnchorTag) {
          this.scrollNow();
          return;
        }

        if (action === 'PUSH'
          && props.scrollOnNavigate
          && !(location.state as any)?.[SCROLL_TO_STATE_KEY]
          && !location?.hash) {
          this.scrollNow();
          return;
        }
      });
    }

    if (props.scrollNow) {
      this.scrollNow();
    }

    if (props.scrollOnMount) {
      this.scrollNow();
    }

    if (!!props.scrollOnStateName
      && props.scrollOnStateName === (props.location.state as any)?.[SCROLL_TO_STATE_KEY]) {
      this.scrollNow();
      return;
    }

    if (props.scrollOnAnchorTag
      && props.location?.hash.substr(1) === props.scrollOnAnchorTag) {
      this.scrollNow();
      return;
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.scrollNow !== true
      && this.props.scrollNow === true) {
      this.scrollNow();
    };
  }

  componentWillUnmount() {
    this.unlistenHistory?.();
  }
}

export default withRouter(ScrollAnchor);
