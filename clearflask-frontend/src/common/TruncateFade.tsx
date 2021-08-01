// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Variant } from '@material-ui/core/styles/createTypography';
import React from 'react';
import GradientFade from './GradientFade';

const styles = (theme: Theme) => createStyles({
  content: {
    overflow: 'hidden',
  },
});

interface Props {
  variant?: Variant;
  lines?: number;
  isPaper?: boolean;
}

class TruncateFade extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const variant = this.props.variant || 'body1';
    const lineHeight = this.props.theme.typography[variant]
      && this.props.theme.typography[variant].lineHeight
      && (typeof this.props.theme.typography[variant].lineHeight === 'number'
        ? this.props.theme.typography[variant].lineHeight + 'em'
        : this.props.theme.typography[variant].lineHeight)
      || '1.1em';
    const collapsedHeight = this.props.lines === undefined ? '100%' : `calc(${lineHeight} * ${this.props.lines})`;
    const fadeStart = this.props.lines === undefined ? collapsedHeight : `calc(${lineHeight} * ${this.props.lines < 1 ? 0 : (this.props.lines - 1)})`;
    return (
      <GradientFade
        className={this.props.classes.content}
        start={fadeStart}
        end={collapsedHeight}
        isPaper={this.props.isPaper}
        direction='to bottom'
        style={{
          maxHeight: collapsedHeight,
        }}
      >
        {this.props.children}
      </GradientFade>
    );
  }
}

export default withStyles(styles, { withTheme: true })(TruncateFade);
