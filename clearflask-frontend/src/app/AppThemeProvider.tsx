import React, { Component } from 'react';
import * as Client from '../api/client';
import { ReduxState, Status } from '../api/server';
import { connect } from 'react-redux';
import { CssBaseline, MuiThemeProvider, createMuiTheme } from '@material-ui/core';

interface Props {
  supressCssBaseline?:boolean;
  // connect
  config:Client.Config;
}

class App extends Component<Props> {
  render() {
    var theme;
    if(this.props.config) {
      theme = createMuiTheme({
        palette: {
          type: this.props.config.style.palette.darkMode ? 'dark' : 'light',
          ...(this.props.config.style.palette.primary ? { primary: {
            main: this.props.config.style.palette.primary,
          }} : {}),
          ...(this.props.config.style.palette.secondary ? { secondary: {
            main: this.props.config.style.palette.secondary,
          }} : {}),
          ...((this.props.config.style.palette.background || this.props.config.style.palette.backgroundPaper) ? { background: {
            default: this.props.config.style.palette.background ? this.props.config.style.palette.background : undefined,
            paper: this.props.config.style.palette.backgroundPaper ? this.props.config.style.palette.backgroundPaper : undefined,
          }} : {}),
        },
        typography: {
          fontFamily: this.props.config.style.typography.fontFamily || undefined,
          fontSize: this.props.config.style.typography.fontSize || undefined,
        }
      })
    } else {
      theme = createMuiTheme();
    }

    return (
      <MuiThemeProvider theme={theme}>
        {!this.props.supressCssBaseline && (<CssBaseline />)}
        <div style={{
          background: theme.palette.background.default,
        }}>
          {this.props.children}
        </div>
      </MuiThemeProvider>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  return state.conf.status === Status.FULFILLED ? { config: state.conf.conf } : {}
})(App);
