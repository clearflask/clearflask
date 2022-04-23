// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
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
          key='rich-editor-internal'
          {...this.props}
          fallback={this.renderFallback()}
        />
      );
    }
  }

  renderFallback() {
    return (
      <TextField
        key='rich-editor-internal-fallback' // Not sure if this is needed, it may fix the spurious bug of disappering text
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
