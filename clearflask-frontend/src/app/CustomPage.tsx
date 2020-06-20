import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../api/server';
import RichViewer from '../common/RichViewer';
import setTitle from '../common/util/titleUtil';
import IdeaExplorer from './comps/IdeaExplorer';
import Panel, { Direction } from './comps/Panel';
import TemplateLiquid from './comps/TemplateLiquid';
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
  },
  boardInCorner: {
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
  config?: Client.Config;
  pageNotFound: boolean;
  page?: Client.Page;
}
class CustomPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.pageNotFound) {
      setTitle("Page not found", true);
      return (<ErrorPage msg='Oops, page not found' />);
    }

    const template = (this.props.config?.style.templates?.pages || []).find(p => p.pageId === this.props.page?.pageId)?.template;

    var page;
    if (template) {
      page = (
        <TemplateLiquid
          template={template}
          customPageSlug={this.props.pageSlug}
        />
      );
    } else if (this.props.page) {
      setTitle(this.props.page.name, true);

      var panelsCmpt;
      var boardCmpt;
      var explorerCmpt;

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
          <div className={this.props.classes.board}>
            {panels}
          </div>
        );
        if (board.title) {
          boardCmpt = (
            <DividerCorner title={board.title} height='90%'>
              <div className={classNames(this.props.classes.board, this.props.classes.boardInCorner)}>
                {panels}
              </div>
            </DividerCorner>
          );
        } else {
          boardCmpt = (
            <div className={this.props.classes.board}>
              {panels}
            </div>
          );
        }
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
      }

      var top;
      if (this.props.page.description) {
        top = (
          <div className={this.props.classes.spacing}>
            <RichViewer raw={this.props.page.description} />
          </div>
        );
      }

      if (this.props.page.title) {
        top = (
          <DividerCorner
            height='90%'
            title={this.props.page.title}
          >
            {top}
          </DividerCorner>
        );
      }

      page = (
        <div className={this.props.classes.page}>
          {top}
          {panelsCmpt}
          {boardCmpt}
          {explorerCmpt}
        </div>
      );
    }

    return (
      <Loader key={this.props.page && this.props.page.pageId} loaded={!!this.props.page}>
        {page}
      </Loader>
    );
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var newProps: ConnectProps = {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
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
