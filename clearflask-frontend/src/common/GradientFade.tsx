// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  content: {
    display: 'inline-block',
    width: '100%',
    transition: theme.transitions.create(['mask-image']),
  },
});

interface Props {
  className?: string;
  direction?: string;
  start?: string;
  end?: string;
  opacity?: number;
  isPaper?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties,
}

class GradientFade extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.disabled) return this.props.children;
    return (
      <div className={`${this.props.classes.content} ${this.props.className || ''}`} style={{
        ...(this.props.style || {}),
        WebkitMaskImage: `linear-gradient(${this.props.direction || 'to right'}, rgba(0, 0, 0, 1.0) ${this.props.start || '0%'}, rgba(0, 0, 0, ${this.props.opacity || 0}) ${this.props.end || '100%'})`,
        maskImage: `linear-gradient(${this.props.direction || 'to right'}, rgba(0, 0, 0, 1.0) ${this.props.start || '0%'}, rgba(0, 0, 0, ${this.props.opacity || 0}) ${this.props.end || '100%'})`,
      }}>
        {this.props.children}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(GradientFade);
