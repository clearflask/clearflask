import React from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import { ThemeStyle } from '@material-ui/core/styles/createTypography';
import GradientFade from './GradientFade';

const styles = (theme:Theme) => createStyles({
  content: {
  },
});

interface Props {
  variant:ThemeStyle;
  lines?:number;
  isPaper?:boolean;
}

class Truncate extends React.Component<Props&WithStyles<typeof styles, true>> {

  render() {
    if(this.props.lines === undefined) return this.props.children;
    const lineHeight = this.props.theme.typography[this.props.variant]
      && this.props.theme.typography[this.props.variant].lineHeight
      && (typeof this.props.theme.typography[this.props.variant].lineHeight === 'number'
        ? this.props.theme.typography[this.props.variant].lineHeight + 'em'
        : this.props.theme.typography[this.props.variant].lineHeight)
      || '1.1em';
    return (
      <GradientFade
        className={this.props.classes.content}
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
