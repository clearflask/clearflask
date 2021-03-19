import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../api/server';
import RichViewer from '../common/RichViewer';
import IdeaExplorer from './comps/IdeaExplorer';
import { Direction } from './comps/Panel';
import PanelPost from './comps/PanelPost';
import TemplateLiquid from './comps/TemplateLiquid';
import ErrorPage from './ErrorPage';
import DividerCorner from './utils/DividerCorner';
import Loader from './utils/Loader';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
  },
  spacing: {
    marginTop: theme.spacing(4),
  },
  spacingTitleAndDescription: {
    maxWidth: 400,
    margin: theme.spacing(4, 16, 0),
    [theme.breakpoints.down('xs')]: {
      marginLeft: theme.spacing(4),
      marginRight: theme.spacing(4),
    },
    [theme.breakpoints.only('sm')]: {
      marginLeft: theme.spacing(8),
      marginRight: theme.spacing(8),
    },
  },
  description: {
    marginTop: theme.spacing(1),
  },
  singlePanels: {
    display: 'flex',
    flexDirection: 'column',
  },
  singlePanel: {
    minWidth: '256px',
  },
  boardContainer: {
    // marginLeft: 'auto',
    // marginRight: 'auto',
    width: 'fit-content',
  },
  board: {
    display: 'flex',
    flexWrap: 'wrap',
    transition: theme.transitions.create('flex', {
      duration: theme.transitions.duration.shortest,
    }),
    paddingLeft: theme.spacing(2),
  },
  boardInCorner: {
    paddingLeft: theme.spacing(2),
  },
  boardPanel: {
    flex: '0 1 100px',
    paddingTop: theme.spacing(3),
    paddingLeft: theme.spacing(2),
  },
  explorer: {
    margin: 'auto',
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
      var panelsCmpt;
      var boardCmpt;
      var explorerCmpt;

      // ### PANELS
      if (this.props.page.panels.length > 0) {
        panelsCmpt = (
          <div className={classNames(this.props.classes.singlePanels, this.props.classes.spacing)}>
            {(this.props.page.panels || []).map(panel => {
              return (
                <div className={this.props.classes.singlePanel}>
                  <PanelPost
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
          <PanelPost
            key={getSearchKey(panel.search)}
            className={this.props.classes.boardPanel}
            maxHeight={this.props.theme.vh(80)}
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
        ));
        if (board.title) {
          boardCmpt = (
            <DividerCorner
              className={classNames(this.props.classes.boardContainer, this.props.classes.spacing)}
              title={board.title}
              height='100%'
              maxHeight={120}
            >
              <div className={classNames(this.props.classes.board, this.props.classes.boardInCorner)}>
                {panels}
              </div>
            </DividerCorner>
          );
        } else {
          boardCmpt = (
            <div className={classNames(this.props.classes.boardContainer, this.props.classes.board, this.props.classes.spacing)}>
              {panels}
            </div>
          );
        }
      }

      // ### EXPLORER
      if (this.props.page.explorer) {
        const explorer = this.props.page.explorer;
        explorerCmpt = (
          <div className={this.props.classes.spacing}>
            <IdeaExplorer
              className={this.props.classes.explorer}
              server={this.props.server}
              explorer={explorer}
            />
          </div>
        );
      }

      var title;
      if (this.props.page.title) {
        title = (
          <Typography component="h1" variant="h5" color="textPrimary">{this.props.page.title}</Typography>
        );
      }

      var desc;
      if (this.props.page.description) {
        desc = (
          <div className={this.props.classes.description}>
            <RichViewer key={this.props.page.description} iAgreeInputIsSanitized html={this.props.page.description} />
          </div>
        );
      }

      var top;
      if (title || desc) {
        top = (
          <div className={this.props.classes.spacingTitleAndDescription}>
            {title}
            {desc}
          </div>
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
      <Loader skipFade key={this.props.page && this.props.page.pageId} loaded={!!this.props.page}>
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
