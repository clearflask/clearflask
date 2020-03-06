import { createMuiTheme, CssBaseline, Theme } from '@material-ui/core';
import { MuiThemeProvider } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import { ThemeOptions } from '@material-ui/core/styles/createMuiTheme';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { ReduxState } from '../api/server';

interface ThemeCustomProps {
  disableTransitions?: boolean;
  funding?: string;
  isInsideContainer?: boolean;
  expressionGrayscale?: number;
  explorerExpandTimeout?: number;
}

declare module '@material-ui/core/styles/createMuiTheme' {
  interface Theme extends ThemeCustomProps { }
  interface ThemeOptions extends ThemeCustomProps { }
}

interface Props {
  containerStyle?: React.CSSProperties,
  supressCssBaseline?: boolean;
  isInsideContainer?: boolean;
  breakpoints?: { [key in Breakpoint]: number };
  appRootId: string;
  // connect
  config?: Client.Config;
}

class AppThemeProvider extends Component<Props> {
  render() {
    var expressionGrayscale: number | undefined = undefined;
    switch (this.props.config && this.props.config.style.palette.expressionColor) {
      case Client.PaletteExpressionColorEnum.Gray:
        expressionGrayscale = 100;
        break;
      case Client.PaletteExpressionColorEnum.Washed:
        expressionGrayscale = 50;
        break;
    }
    var theme: Theme | undefined;
    if (this.props.config) {
      theme = createMuiTheme({
        disableTransitions: !this.props.config.style.animation.enableTransitions,
        funding: this.props.config.style.palette.funding
          || this.props.config.style.palette.primary,
        // Optional green color
        // || ( this.props.config.style.palette.darkMode ? '#6ca869' : '#89c586' ),
        isInsideContainer: !!this.props.isInsideContainer,
        expressionGrayscale: expressionGrayscale,
        explorerExpandTimeout: 500,
        palette: {
          type: this.props.config.style.palette.darkMode ? 'dark' : 'light',
          ...(this.props.config.style.palette.primary ? {
            primary: {
              main: this.props.config.style.palette.primary,
            }
          } : {}),
          ...(this.props.config.style.palette.secondary ? {
            secondary: {
              main: this.props.config.style.palette.secondary,
            }
          } : {}),
          ...(this.props.config.style.palette.text ? {
            text: {
              primary: this.props.config.style.palette.text,
            }
          } : {}),
          background: {
            default: this.props.config.style.palette.background ? this.props.config.style.palette.background : '#fff',
            paper: this.props.config.style.palette.backgroundPaper ? this.props.config.style.palette.backgroundPaper : '#fff',
          },
        },
        typography: {
          // TODO sanitize input, currently you can inject custom css with "; inject: me"
          fontFamily: this.props.config.style.typography.fontFamily || '"Roboto", "Helvetica", "Arial", sans-serif',
          fontSize: this.props.config.style.typography.fontSize || 14,
        },
        transitions: {
          ...(this.props.config.style.animation.enableTransitions ? {} : {
            create: () => 'none',
            duration: {
              shortest: 0,
              shorter: 0,
              short: 0,
              standard: 0,
              complex: 0,
              enteringScreen: 0,
              leavingScreen: 0,
            },
          }),
        },
        breakpoints: {
          ...(this.props.breakpoints !== undefined ? {
            values: this.props.breakpoints,
          } : {}),
        },
        props: {
          MuiDialog: {
            container: () => document.getElementById(this.props.appRootId)!,
            ...(this.props.isInsideContainer ? {
              style: { position: 'absolute' },
              BackdropProps: { style: { position: 'absolute' } },
              disableEnforceFocus: true,
            } : {}),
          },
          MuiButtonBase: {
            ...(!this.props.config.style.animation.enableTransitions ? {
              disableRipple: true,
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
          color: theme.palette.text.primary,
          ...(this.props.containerStyle || {}),
        }}>
          {this.props.children}
        </div>
      </MuiThemeProvider>
    );
  }
}

export default connect<any, any, any, any>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
  }
})(AppThemeProvider);
