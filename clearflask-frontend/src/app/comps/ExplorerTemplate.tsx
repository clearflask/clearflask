import React, { Component } from 'react';
import { Server, getSearchKey, ReduxState } from '../../api/server';
import { withStyles, Theme, createStyles, WithStyles } from '@material-ui/core/styles';
import * as Client from '../../api/client';
import * as Admin from '../../api/admin';
import Panel, { Direction } from './Panel';
import { Typography, TextField, Grow, Button, Select, MenuItem, FormControl, FormHelperText, Fade, Hidden, Collapse } from '@material-ui/core';
import DividerCorner from '../utils/DividerCorner';
import { connect } from 'react-redux';
import PanelSearch from './PanelSearch';
import SelectionPicker, { ColorLookup, Label } from './SelectionPicker';
import LogIn from './LogIn';
import debounce from '../../common/util/debounce';
import { withRouter, RouteComponentProps } from 'react-router';
import UserSelection from '../../site/dashboard/UserSelection';
import ServerAdmin from '../../api/serverAdmin';

const styles = (theme:Theme) => createStyles({
  explorer: {
    display: 'grid',
    [theme.breakpoints.up('sm')]: {
      gridTemplateColumns: 'auto 1fr',
      gridTemplateRows: 'auto 1fr',
      gridTemplateAreas:
        "'t t'"
        + " 'cc r'",
    },
    [theme.breakpoints.down('xs')]: {
      gridTemplateColumns: 'auto',
      gridTemplateRows: 'auto auto auto auto',
      gridTemplateAreas:
        "'t'"
        + " 'cc'"
        + " 's'"
        + " 'r'",
    },
  },
  top: {
    gridArea: 't',
    alignSelf: 'end',
    display: 'flex',
    [theme.breakpoints.up('sm')]: {
      alignItems: 'flex-end',
    },
    [theme.breakpoints.down('xs')]: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
  },
  results: {
    gridArea: 'r',
  },
  search: {
    gridArea: 's',
    flexGrow: 1,
  },
  createVisible: {
    transition: theme.transitions.create(['min-width', 'width'], {duration: theme.explorerExpandTimeout}),
    maxWidth: '100vw',
    display: 'flex',
  },
  createCollapsible: {
    gridArea: 'cc',
    transition: theme.transitions.create(['max-width', 'width'], {duration: theme.explorerExpandTimeout}),
    maxWidth: '100vw',
  },
});

interface Props {
  createSize?:string;
  createShown?:boolean;
  createVisible?:React.ReactNode;
  createCollapsible?:React.ReactNode;
  search?:React.ReactNode;
  content?:React.ReactNode;
}

interface State {
  hasExpanded?:boolean;
}

class ExplorerTemplate extends Component<Props&WithStyles<typeof styles, true>&RouteComponentProps, State> {
  state:State = {};

  render() {
    const expandInMotion = (this.props.createShown || false) !== (this.state.hasExpanded || false);
    return (
      <div className={this.props.classes.explorer}>
        <div className={this.props.classes.top}>
          {this.props.createVisible && (
            <div className={this.props.classes.createVisible} style={{
              minWidth: this.props.createSize,
              width: this.props.createSize,
            }}>
              {this.props.createVisible}
            </div>
          )}
          {this.props.search && (
            <div className={this.props.classes.search} style={{visibility: expandInMotion ? 'hidden' : 'visible'}}>
              <Hidden xsDown implementation='css'>
                {this.props.search}
              </Hidden>
            </div>
          )}
        </div>
        {this.props.search && (
          <div className={this.props.classes.search} style={{visibility: expandInMotion ? 'hidden' : 'visible'}}>
            <Hidden smUp implementation='css'>
                {this.props.search}
            </Hidden>
          </div>
        )}
        {this.props.createCollapsible && (
          <div
            className={this.props.classes.createCollapsible}
            style={{
              width: this.props.createShown ? this.props.createSize : '0px',
              maxWidth: this.props.createShown ? this.props.createSize : '0px',
            }}
          >
            <Collapse
              in={this.props.createShown || false}
              mountOnEnter
              unmountOnExit
              onEntered={() => this.setState({hasExpanded: true})}
              onExited={() => this.setState({hasExpanded: false})}
              timeout={this.props.theme.explorerExpandTimeout}
              style={{
                minWidth: '120px',
              }}
            >
              {this.props.createCollapsible}
            </Collapse>
          </div>
        )}
        <div className={this.props.classes.results}>
          <DividerCorner
            isExplorer
            width={this.props.createShown ? '80px' : '320px'}
            height={this.props.createShown ? '180px' : '80px'}
          >
            <Fade
              in={!expandInMotion}
              mountOnEnter
              unmountOnExit
              timeout={30}
            >              
              {this.props.content}
            </Fade>
          </DividerCorner>
        </div>
      </div>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withRouter(ExplorerTemplate));
