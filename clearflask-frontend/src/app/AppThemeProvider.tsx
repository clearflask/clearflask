import React, { Component } from 'react';
import * as Client from '../api/client';
import { ReduxState, Status } from '../api/server';
import { connect } from 'react-redux';
import { CssBaseline, MuiThemeProvider, createMuiTheme, Theme } from '@material-ui/core';
import { ThemeOptions } from '@material-ui/core/styles/createMuiTheme';

interface Props {
  supressCssBaseline?:boolean;
  isInsideContainer?:boolean;
  appRootId:string;
  // connect
  config:Client.Config;
}

class App extends Component<Props> {
  render() {
    var theme:Theme|undefined;
    if(this.props.config) {
      theme = createMuiTheme({
        ...{custom: { // Custom variables
          funding: this.props.config.style.palette.funding
            || this.props.config.style.palette.primary,
            // Optional green color
            // || ( this.props.config.style.palette.darkMode ? '#6ca869' : '#89c586' ),
          isInsideContainer: this.props.isInsideContainer,
        }} as ThemeOptions,
        palette: {
          type: this.props.config.style.palette.darkMode ? 'dark' : 'light',
          ...(this.props.config.style.palette.primary ? { primary: {
            main: this.props.config.style.palette.primary,
          }} : {}),
          ...(this.props.config.style.palette.secondary ? { secondary: {
            main: this.props.config.style.palette.secondary,
          }} : {}),
          ...(this.props.config.style.palette.text ? { text: {
            primary: this.props.config.style.palette.text,
          }} : {}),
          ...((this.props.config.style.palette.background || this.props.config.style.palette.backgroundPaper) ? { background: {
            default: this.props.config.style.palette.background ? this.props.config.style.palette.background : undefined,
            paper: this.props.config.style.palette.backgroundPaper ? this.props.config.style.palette.backgroundPaper : undefined,
          }} : {}),
        },
        typography: {
          fontFamily: this.props.config.style.typography.fontFamily || undefined,
          fontSize: this.props.config.style.typography.fontSize || undefined,
        },
        props: {
          MuiDialog: {
            container: () => document.getElementById(this.props.appRootId)!,
            ...(this.props.isInsideContainer ? {
              style: { position: 'absolute' },
              BackdropProps: { style: { position: 'absolute' } },
            } : {}),
          },
        },
      })
    } else {
      theme = createMuiTheme();
    }

    return (
      <MuiThemeProvider theme={theme}>
        {!this.props.supressCssBaseline && (<CssBaseline />)}
        <div style={{
          height: '100%',
          background: theme.palette.background.default,
        }}>
          {this.props.children}
        </div>
      </MuiThemeProvider>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => { return {
  configver: state.conf.ver, // force rerender on config change
  config: state.conf.conf,
}})(App);
