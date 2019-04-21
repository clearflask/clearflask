import React, { Component } from 'react';
import * as Client from '../api/client';
import Loading from './comps/Loading';
import Message from './comps/Message';
import { Typography } from '@material-ui/core';
import { connect } from 'react-redux';
import { StateIdeas, ReduxState as ReduxState, Server, Status } from '../api/server';
import Panel, { Direction } from './comps/Panel';

interface Props extends StateIdeas {
  server:Server;
  pageSlug:string;
  pageChanged:(pageUrlName:string)=>void;
  // connect
  config?:Client.Config;
  page?:Client.Page;
}

class Page extends Component<Props> {
  readonly styles = {
    page: {
      maxWidth: '1024px',
      padding: '40px',
      margin: '0px auto',
    },
  };

  render() {
    if(!this.props.config) {
      return (
        <div style={this.styles.page}>
          <Loading />
        </div>
      );
    }

    if(!this.props.config || !this.props.page) {
      return (
        <div style={this.styles.page}>
          <Message  innerStyle={{margin: '40px auto'}}
            message='Oops, page not found'
            variant='error'
            onClose={() => this.props.pageChanged('')}
          />
        </div>
      );
    }

    // ### PANELS
    var panelsCmpt:any = [];
    for(let panel of this.props.page.panels || []) {
      panelsCmpt.push(
        <div key={panel.search.searchKey}>
          <Typography variant='overline'>
            {panel.title}
          </Typography>
          <Panel
            direction={Direction.Horizontal}
            {...this.props}
            searchKey={panel.search.searchKey}
            ideaCardVariant='full' />
        </div>
      );
      // TODO
    }

    // ### BOARD
    var boardCmpt;
    if(this.props.page.board) {
      const board = this.props.page.board;
      var panels:any = [];
      for(let panel of board.panels) {
        panels.push(
          <div key={panel.search.searchKey}>
            <Typography variant='overline'>
              {panel.title}
            </Typography>
            <Panel
              direction={Direction.Vertical}
              {...this.props}
              searchKey={panel.search.searchKey}
              ideaCardVariant='title' />
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
    var explorerCmpt;
    if(this.props.page.explorer) {
      const explorer = this.props.page.explorer;
      explorerCmpt = (
        <div>
          <Typography variant='overline'>
            {explorer.title}
          </Typography>
          <Panel
            direction={Direction.Wrap}
            {...this.props}
            searchKey={explorer.search.searchKey}
            ideaCardVariant='full' />
        </div>
      );
      // TODO
    }

    return (
      <div style={this.styles.page}>
        <Typography variant='h4' component='h1'>{this.props.page.title}</Typography>
        <Typography variant='body1' component='p'>{this.props.page.description}</Typography>
        {panelsCmpt}
        {boardCmpt}
        {explorerCmpt}
      </div>
    );
  }
}

export default connect<any,any,any,any>((state:ReduxState, ownProps:Props) => {
  var newProps:StateIdeas&{config?:Client.Config;page?:Client.Page;} = {
    byId: {},
    bySearch: {},
    config: state.conf.conf,
    page: undefined,
  };

  if(state.conf.status === Status.FULFILLED && state.conf.conf) {
    if(ownProps.pageSlug === '') {
      newProps.page = state.conf.conf.layout.pages[0];
    } else {
      newProps.page = state.conf.conf.layout.pages.find(p => p.slug === ownProps.pageSlug);
    }
  }

  if(!newProps.page) {
    return newProps;
  }

  const searchQueries:Client.IdeaSearch[] = [
    ...(newProps.page.panels && newProps.page.panels.map(p => p.search) || []),
    ...(newProps.page.board && newProps.page.board.panels.map(p => p.search) || []),
    ...(newProps.page.explorer && [newProps.page.explorer.search] || []),
  ];

  for(let searchQuery of searchQueries) {
    const bySearch = state.ideas.bySearch[searchQuery.searchKey];
    if(!bySearch) {
      ownProps.server.dispatch().ideaSearch({
        projectId: state.projectId,
        search: searchQuery
      });
      continue;
    }
    newProps.bySearch[searchQuery.searchKey] = bySearch;
    (bySearch.ideaIds || []).forEach(ideaId => {
      newProps.byId[ideaId] = state.ideas.byId[ideaId];
    })
  }

  return newProps;
})(Page);
