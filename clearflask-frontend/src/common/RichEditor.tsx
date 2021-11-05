// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import loadable from '@loadable/component';
import { TextField } from '@material-ui/core';
import React, { Component } from 'react';
import Loading from '../app/utils/Loading';
import { importFailed, importSuccess } from '../Main';
import windowIso from './windowIso';

const RichEditorInternal = loadable(() => import(/* webpackChunkName: "RichEditorInternal", webpackPreload: true */'./RichEditorInternal').then(importSuccess).catch(importFailed), { fallback: (<Loading />), ssr: false });

export default class RichEditor extends Component<React.ComponentProps<typeof RichEditorInternal>> {
  render() {
    if (windowIso.isSsr) {
      return this.renderFallback();
    } else {
      return (
        <RichEditorInternal
          {...this.props}
          fallback={this.renderFallback()}
        />
      );
    }
  }

  renderFallback() {
    return (
      <TextField
        {...this.props}
        {...(this.props.minInputHeight !== undefined ? {
          inputProps: {
            ...this.props.inputProps,
            style: {
              ...this.props.inputProps?.style,
              minHeight: this.props.minInputHeight,
            },
          },
        } : {})}
        InputProps={{
          ...this.props.InputProps,
          readOnly: true,
        }}
      />
    );
  }
}
