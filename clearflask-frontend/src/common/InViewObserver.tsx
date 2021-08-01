// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import React, { Component } from 'react';
import { InView } from 'react-intersection-observer';

interface Props {
}
export default class InViewObserver extends Component<Props> {
  promise: Promise<IntersectionObserverEntry | undefined>;
  resolve: (entry: IntersectionObserverEntry | undefined) => void;

  constructor(props) {
    super(props);

    this.resolve = () => { };
    this.promise = new Promise(resolve => { this.resolve = resolve });
  }

  componentWillUnmount() {
    this.resolve(undefined);
  }

  get() {
    return this.promise;
  }

  render() {
    return (
      <InView onChange={(inView, entry) => {
        if (inView) {
          this.resolve(entry);
        } else {
          this.promise = new Promise(resolve => { this.resolve = resolve });
        }
      }}>
        {this.props.children}
      </InView>
    );
  }
}
