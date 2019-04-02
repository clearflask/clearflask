import React, { Component } from 'react';
import * as Client from '../api/client';
import Loading from './comps/Loading';
import Message from './comps/Message';
import { Typography } from '@material-ui/core';
import { connect } from 'react-redux';
import { StateIdeas, State } from '../api/server';
import Panel, { Direction } from './comps/Panel';

interface Props extends StateIdeas{
  api:Client.ApiInterface;
  conf?:Client.Config;
  pageConf?:Client.Page;
  pageChanged:(pageUrlName:string)=>void;
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
    if(!this.props.conf) {
      return (
        <div style={this.styles.page}>
          <Loading />
        </div>
      );
    }

    if(!this.props.conf || !this.props.pageConf) {
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
    for(let panel of this.props.pageConf.panels || []) {
      panelsCmpt.push(
        <div key={panel.ideaList.searchKey}>
          <Typography variant='overline'>
            {panel.title}
          </Typography>
          <Panel direction={Direction.Horizontal} {...this.props} searchKey={panel.ideaList.searchKey} />
        </div>
      );
      // TODO
    }

    // ### BOARD
    var boardCmpt;
    if(this.props.pageConf.board) {
      const board = this.props.pageConf.board;
      var panels:any = [];
      for(let panel of board.panels) {
        panels.push(
          <div key={panel.ideaList.searchKey}>
            <Typography variant='overline'>
              {panel.title}
            </Typography>
            <Panel direction={Direction.Vertical} {...this.props} searchKey={panel.ideaList.searchKey} />
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
    if(this.props.pageConf.explorer) {
      const explorer = this.props.pageConf.explorer;
      explorerCmpt = (
        <div>
          <Typography variant='overline'>
            {explorer.title}
          </Typography>
          <Panel direction={Direction.Wrap} {...this.props} searchKey={explorer.ideaList.searchKey} />
        </div>
      );
      // TODO
    }

    return (
      <div style={this.styles.page}>
        {panelsCmpt}
        {boardCmpt}
        {explorerCmpt}
      </div>
    );
  }
}

export default connect<any,any,any,any>((state:State, ownProps:Props) => {
  var newProps = {
    byId: {},
    bySearch: {},
  };

  if(!ownProps.pageConf) {
    return newProps;
  }

  const searchQueries:Client.IdeaSearch[] = [
    ...(ownProps.pageConf.panels && ownProps.pageConf.panels.map(p => p.ideaList) || []),
    ...(ownProps.pageConf.board && ownProps.pageConf.board.panels.map(p => p.ideaList) || []),
    ...(ownProps.pageConf.explorer && [ownProps.pageConf.explorer.ideaList] || []),
  ];

  for(let searchQuery of searchQueries) {
    const bySearch = state.ideas.bySearch[searchQuery.searchKey];
    if(!bySearch) {
      ownProps.api.ideaSearch({
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
