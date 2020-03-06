import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  hr: {
    width: '10%',
    margin: '40px auto 30px auto',
    backgroundColor: theme.palette.background.default,
    borderBottom: '1px solid #cccccc',
    textAlign: 'center' as 'center',
    lineHeight: '0.1em',
    color: '#777777',
  },
  vr: {
    height: '10%',
    borderLeft: '1px solid #eee',
    marginLeft: '40px',
    marginRight: '40px',
    position: 'relative' as 'relative',
    color: '#777777',
  },
  vrContainer: {
    display: 'flex',
    alignItems: 'center',
  },
});

interface Props {
  className?: string;
  style?: React.CSSProperties;
  vertical?: boolean;
  margins?: string;
  length?: string;
}

class Hr extends React.Component<Props & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.vertical) {
      return (
        <div className={`${this.props.classes.vrContainer} ${this.props.className}`}>
          <div className={this.props.classes.vr} style={{
            ...this.props.style,
            ...(this.props.length && {
              height: this.props.length
            }),
            ...(this.props.margins && {
              marginLeft: this.props.margins,
              marginRight: this.props.margins,
            }),
          }}>
            {this.props.children ? (
              <span style={{
                background: '#fff',
                padding: '10px 0px',
                position: 'absolute',
                top: '50%',
                left: '-50%',
                transform: 'translate(-50%, -50%)',
                whiteSpace: 'nowrap',
              }}>
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
            ...this.props.style,
            ...(this.props.length && {
              width: this.props.length
            }),
            ...(this.props.margins && {
              marginTop: this.props.margins,
              marginBottom: this.props.margins,
            }),
          }}
        >
          {this.props.children && (
            <span style={{
              background: '#fff',
              padding: '0 10px',
            }}>
              {this.props.children}
            </span>
          )}
        </div>
      );
    }
  }
}

export default withStyles(styles, { withTheme: true })(Hr);
