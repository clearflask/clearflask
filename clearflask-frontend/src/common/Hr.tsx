import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  hr: {
    width: '10%',
    margin: '40px auto 30px auto',
    backgroundColor: (props: Props) => props.isInsidePaper ? theme.palette.background.paper : theme.palette.background.default,
    borderBottom: '1px solid #cccccc',
    textAlign: 'center' as 'center',
    lineHeight: '0.1em',
  },
  hrChildren: {
    backgroundColor: (props: Props) => props.isInsidePaper ? theme.palette.background.paper : theme.palette.background.default,
    padding: '0 10px',
  },
  vr: {
    height: '10%',
    borderLeft: '1px solid #eee',
    marginLeft: '40px',
    marginRight: '40px',
    position: 'relative' as 'relative',
  },
  vrContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  vrChildren: {
    backgroundColor: (props: Props) => props.isInsidePaper ? theme.palette.background.paper : theme.palette.background.default,
    padding: '10px 0px',
    position: 'absolute',
    top: '50%',
    left: '-50%',
    transform: 'translate(-50%, -50%)',
    whiteSpace: 'nowrap',
  },
});

interface Props {
  className?: string;
  style?: React.CSSProperties;
  vertical?: boolean;
  margins?: string;
  length?: string;
  isInsidePaper?: boolean;
}

class Hr extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.vertical) {
      return (
        <div className={`${this.props.classes.vrContainer} ${this.props.className}`}>
          <div className={this.props.classes.vr} style={{
            ...(this.props.length && {
              height: this.props.length
            }),
            ...(this.props.margins && {
              marginLeft: this.props.margins,
              marginRight: this.props.margins,
            }),
            ...this.props.style,
          }}>
            {this.props.children ? (
              <span className={this.props.classes.vrChildren}>
                {this.props.children}
              </span>
            ) : ' '}
          </div>
        </div>
      );
    } else {
      return (
        <div className={`${this.props.classes.hr} ${this.props.className}`}
          style={{
            ...(this.props.length && {
              width: this.props.length
            }),
            ...(this.props.margins && {
              marginTop: this.props.margins,
              marginBottom: this.props.margins,
            }),
            ...this.props.style,
          }}
        >
          {this.props.children && (
            <span className={this.props.classes.hrChildren}>
              {this.props.children}
            </span>
          )}
        </div>
      );
    }
  }
}

export default withStyles(styles, { withTheme: true })(Hr);
