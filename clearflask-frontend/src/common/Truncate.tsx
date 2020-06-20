import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { Variant } from '@material-ui/core/styles/createTypography';
import React from 'react';
import GradientFade from './GradientFade';

const styles = (theme: Theme) => createStyles({
});

interface Props {
  variant?: Variant;
  lines?: number;
  isPaper?: boolean;
}

class Truncate extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    const variant = this.props.variant || 'body1';
    if (this.props.lines === undefined) return this.props.children;
    const lineHeight = this.props.theme.typography[variant]
      && this.props.theme.typography[variant].lineHeight
      && (typeof this.props.theme.typography[variant].lineHeight === 'number'
        ? this.props.theme.typography[variant].lineHeight + 'em'
        : this.props.theme.typography[variant].lineHeight)
      || '1.1em';
    return (
      <GradientFade
        start={`calc(${lineHeight} * ${this.props.lines - 1})`}
        isPaper={this.props.isPaper}
        direction='to bottom'
        style={{
          maxHeight: `calc(${lineHeight} * ${this.props.lines})`,
          overflow: 'hidden',
        }}
      >
        {this.props.children}
      </GradientFade>
    );
  }
}

export default withStyles(styles, { withTheme: true })(Truncate);
