import React from 'react';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  content: {
    display: 'inline-block',
  },
});

interface Props {
  className?:string;
  direction?:string;
  start?:string;
  end?:string;
  opacity?:number;
  isPaper?:boolean;
  disabled?:boolean;
  style?:React.CSSProperties,
}

class GradientFade extends React.Component<Props&WithStyles<typeof styles, true>> {

  render() {
    if(this.props.disabled) return this.props.children;
    return (
      <div className={`${this.props.classes.content} ${this.props.className || ''}`} style={{
        ...(this.props.style || {}),
        WebkitMaskImage: `linear-gradient(${this.props.direction || 'to right'}, ${this.props.isPaper ? this.props.theme.palette.background.paper : this.props.theme.palette.background.default} ${this.props.start || '0%'}, rgba(0, 0, 0, ${this.props.opacity || 0}) ${this.props.end || '100%'})`,
        maskImage: `linear-gradient(${this.props.direction || 'to right'}, ${this.props.isPaper ? this.props.theme.palette.background.paper : this.props.theme.palette.background.default} ${this.props.start || '0%'}, rgba(0, 0, 0, ${this.props.opacity || 0}) ${this.props.end || '100%'})`,
      }}>
        {this.props.children}
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(GradientFade);
