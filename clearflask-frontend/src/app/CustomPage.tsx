import React, { Component } from 'react';
import * as Client from '../api/client';
import Message from './comps/Message';
import { Typography } from '@material-ui/core';
import { connect } from 'react-redux';
import { ReduxState as ReduxState, Server, Status, getSearchKey } from '../api/server';
import Panel, { Direction } from './comps/Panel';
import Loader from './comps/Loader';
import ErrorPage from './ErrorPage';
import PanelWithControls from './comps/PanelWithControls';

interface Props {
  server:Server;
  pageSlug:string;
  pageChanged:(pageUrlName:string)=>void;
  // connect
  pageNotFound:boolean;
  page?:Client.Page;
}

class Page extends Component<Props> {

  render() {
    if(this.props.pageNotFound) {
      return (<ErrorPage msg='Oops, page not found' />);
    }

    var panelsCmpt:any = [];
    var boardCmpt;
    var explorerCmpt;

    if(this.props.page) {
      // ### PANELS
      for(let panel of this.props.page.panels || []) {
        panelsCmpt.push(
          <div>
            <Typography variant='overline'>
              {panel.title}
            </Typography>
            <Panel
              key={getSearchKey(panel.search)}
              direction={Direction.Horizontal}
              panel={panel}
              server={this.props.server} />
          </div>
        );
        // TODO
      }

      // ### BOARD
      if(this.props.page.board) {
        const board = this.props.page.board;
        var panels:any = [];
        for(let panel of board.panels) {
          panels.push(
            <div>
              <Typography variant='overline'>
                {panel.title}
              </Typography>
              <Panel
                key={getSearchKey(panel.search)}
                direction={Direction.Vertical}
                panel={panel}
                server={this.props.server} />
            </div>
          );
        }
        boardCmpt = (
          <div>
            <Typography variant='overline'>
              {board.title}
            </Typography>
            <div style={{
              display: 'flex',
            }}>
              {panels}
            </div>
          </div>
        );
        // TODO
      }

      // ### EXPLORER
      if(this.props.page.explorer) {
        const explorer = this.props.page.explorer;
        explorerCmpt = (
          <div>
            <Typography variant='overline'>
              {explorer.title}
            </Typography>
            <PanelWithControls
              key={getSearchKey(explorer.panel.search)}
              direction={Direction.Wrap}
              panel={explorer.panel}
              server={this.props.server} />
          </div>
        );
        // TODO
      }
    }

    return (
      <Loader key={this.props.page && this.props.page.pageId} loaded={!!this.props.page}>
        <Typography variant='h4' component='h1'>{this.props.page && this.props.page.title}</Typography>
        <Typography variant='body1' component='p'>{this.props.page && this.props.page.description}</Typography>
        {panelsCmpt}
        {boardCmpt}
        {explorerCmpt}
      </Loader>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var newProps:{configver?:string;pageNotFound:boolean;page?:Client.Page;} = {
    configver: state.conf.ver, // force rerender on config change
    pageNotFound: false,
    page: undefined,
  };

  if(state.conf.status === Status.FULFILLED && state.conf.conf) {
    if(ownProps.pageSlug === '') {
      newProps.page = state.conf.conf.layout.pages[0];
    } else {
      newProps.page = state.conf.conf.layout.pages.find(p => p.slug === ownProps.pageSlug);
      if(!newProps.page) newProps.pageNotFound = true;
    }
  }

  return newProps;
})(Page);
