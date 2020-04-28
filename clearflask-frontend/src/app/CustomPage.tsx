import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../api/server';
import IdeaExplorer from './comps/IdeaExplorer';
import Panel, { Direction } from './comps/Panel';
import ErrorPage from './ErrorPage';
import DividerCorner from './utils/DividerCorner';
import Loader from './utils/Loader';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
  },
  spacing: {
    margin: theme.spacing(2),
  },
  singlePanels: {
    display: 'flex',
    flexDirection: 'column',
  },
  singlePanel: {
    minWidth: '256px',
  },
  board: {
    display: 'flex',
    flexWrap: 'wrap',
    transition: theme.transitions.create('flex', {
      duration: theme.transitions.duration.shortest,
    }),
    paddingLeft: theme.spacing(2),
  },
  boardPanel: {
    flex: '0 1 100px',
    paddingTop: theme.spacing(2),
    paddingLeft: theme.spacing(2),
  },
});

interface Props {
  server: Server;
  pageSlug: string;
}

interface ConnectProps {
  configver?: string;
  pageNotFound: boolean;
  page?: Client.Page;
}

class CustomPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.pageNotFound) {
      return (<ErrorPage msg='Oops, page not found' />);
    }

    var panelsCmpt;
    var boardCmpt;
    var explorerCmpt;

    if (this.props.page) {
      // ### PANELS
      if (this.props.page.panels.length > 0) {
        panelsCmpt = (
          <div className={this.props.classes.singlePanels}>
            {(this.props.page.panels || []).map(panel => {
              const searchKey = getSearchKey(panel.search);
              return (
                <div key={searchKey} className={this.props.classes.singlePanel}>
                  <Panel
                    key={searchKey}
                    direction={Direction.Horizontal}
                    panel={panel}
                    server={this.props.server}
                    displayDefaults={{
                      titleTruncateLines: 1,
                      descriptionTruncateLines: 2,
                      showDescription: true,
                      showCommentCount: false,
                      showCategoryName: false,
                      showCreated: false,
                      showAuthor: false,
                      showStatus: false,
                      showTags: false,
                      showVoting: true,
                      showFunding: true,
                      showExpression: true,
                    }} />
                </div>
              );
            })}
          </div>
        );
      }

      // ### BOARD
      if (this.props.page.board) {
        const board = this.props.page.board;
        var panels: any = board.panels.map((panel, panelIndex) => (
          <div key={panelIndex} className={this.props.classes.boardPanel}>
            <Panel
              key={getSearchKey(panel.search)}
              maxHeight='80vh'
              direction={Direction.Vertical}
              panel={panel}
              server={this.props.server}
              displayDefaults={{
                titleTruncateLines: 1,
                descriptionTruncateLines: 0,
                showDescription: false,
                showCommentCount: false,
                showCategoryName: false,
                showCreated: false,
                showAuthor: false,
                showStatus: false,
                showTags: false,
                showVoting: false,
                showFunding: false,
                showExpression: false,
              }} />
          </div>
        ));
        boardCmpt = (
          <div>
            <DividerCorner title={board.title} height='90%'>
              <div className={this.props.classes.board}>
                {panels}
              </div>
            </DividerCorner>
          </div>
        );
        // TODO
      }

      // ### EXPLORER
      if (this.props.page.explorer) {
        const explorer = this.props.page.explorer;
        explorerCmpt = (
          <IdeaExplorer
            server={this.props.server}
            explorer={explorer}
          />
        );
        // TODO
      }
    }

    return (
      <Loader key={this.props.page && this.props.page.pageId} loaded={!!this.props.page}>
        <div className={this.props.classes.page}>
          {this.props.page && (this.props.page.title || this.props.page.description) && (
            <DividerCorner header={this.props.page.title && (
              <Typography className={this.props.classes.spacing} variant='h5' component='h1'>{this.props.page.title}</Typography>
            )}>
              <Typography className={this.props.classes.spacing} variant='body1' component='p'>{this.props.page.description}</Typography>
            </DividerCorner>
          )}
          {panelsCmpt}
          {boardCmpt}
          {explorerCmpt}
        </div>
      </Loader>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    pageNotFound: false,
    page: undefined,
  };

  if (state.conf.status === Status.FULFILLED && state.conf.conf) {
    if (ownProps.pageSlug === '') {
      if (state.conf.conf.layout.pages.length <= 0) {
        newProps.pageNotFound = true;
      } else {
        newProps.page = state.conf.conf.layout.pages[0];
      }
    } else {
      newProps.page = state.conf.conf.layout.pages.find(p => p.slug === ownProps.pageSlug);
      if (!newProps.page) newProps.pageNotFound = true;
    }
  }

  return newProps;
})(withStyles(styles, { withTheme: true })(CustomPage));
