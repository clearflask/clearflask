import React, { Component } from 'react';
import { Api, Conf, ConfViewPage, ConfViewIdeaList, Idea, ApiInterface } from '../api/client';
import Loading from './comps/Loading';
import Message from './comps/Message';
import { Typography } from '@material-ui/core';
import { connect } from 'react-redux';
import { StateIdeas, Status } from '../api/server';
import { mapIdeaListToRequest, getSearchKey } from '../api/dataUtil';

interface Props {
  api:ApiInterface;
  conf?:Conf;
  pageConf?:ConfViewPage;
  stateIdeas:StateIdeas;
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
          />
        </div>
      );
    }

    // ### PANELS
    var panelsCmpt:any = [];
    for(var panel of this.props.pageConf.panels || []) {
      const ideaWrapper = this.getIdeaList(
        panel.ideaList,
        panel.ideaLimit
      );
      panelsCmpt.push(
        <div>
          <Typography variant='overline'>
            {panel.titleOpt}
          </Typography>
          {JSON.stringify(ideaWrapper)}
        </div>
      );
      // TODO
    }

    // ### BOARD
    var boardCmpt;
    if(this.props.pageConf.board) {
      const board = this.props.pageConf.board;
      boardCmpt = (
        <div>
          <Typography variant='overline'>
            {board.titleOpt}
          </Typography>
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
            {explorer.titleOpt}
          </Typography>
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

  getIdeaList(
    ideaList:ConfViewIdeaList,
    limit?:number,
    search?:string,
  ):{
    status:Status;
    ideas:{
      status:Status;
      idea?:Idea;
    }[],
    cursor?:string
  }|undefined {
    const ideaRequest = mapIdeaListToRequest(
      ideaList,
      limit,
      search,
    );
    const searchKey = getSearchKey(ideaRequest);
    const ideas = this.props.stateIdeas.bySearch[searchKey];
    if(!ideas) {
      this.props.api.getIdeas(ideaRequest);
    }
    return {
      status: ideas && ideas.status || Status.PENDING,
      cursor: ideas && ideas.cursor,
      ideas: (ideas && ideas.ideaIds || []).map((ideaId) => {
        const idea = this.props.stateIdeas.byId[ideaId];
        if(!idea) {
          this.props.api.getIdea({ideaId: ideaId});
        }
        return {
          status: idea && idea.status || Status.PENDING,
          idea: idea && idea.idea,
        }
      }),
    };
  }
}

export default connect<any,any,any,any>((state, ownProps) => {
  return{ stateIdeas: state.ideas }
})(Page);
