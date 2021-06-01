import { CardActionArea, Link as MuiLink, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, useTheme, withStyles, WithStyles } from '@material-ui/core/styles';
import GoIcon from '@material-ui/icons/ArrowRightAlt';
import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link, RouteComponentProps, withRouter } from 'react-router-dom';
import * as Client from '../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../api/server';
import RichViewer from '../common/RichViewer';
import { preserveEmbed } from '../common/util/historyUtil';
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
  landing: {
    margin: 'auto',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  landingPaper: {
    flex: '1 1 150px',
    marginTop: theme.spacing(6),
    maxWidth: 250,
    height: 300,
    display: 'flex',
    // boxShadow: '-10px 30px 40px 0 rgba(0,0,0,0.1)',
    border: '1px solid ' + theme.palette.grey[300],
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingLinkDescription: {
    margin: theme.spacing(0, 1),
  },
  landingLinkGoIcon: {
    alignSelf: 'flex-end',
    margin: theme.spacing(1, 4, 0, 0),
    fontSize: '3em',
  },
});
const useStyles = makeStyles(styles);
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
class CustomPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps> {

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
      var landingCmpt;
      var panelsCmpt;
      var boardCmpt;
      var explorerCmpt;

      // ### LANDING
      if (!!this.props.page.landing) {
        landingCmpt = (
          <div className={this.props.classes.landing}>
            {this.props.page.landing.links?.map((link, index) => {
              const linkToSlug = !link.linkToPageId ? undefined
                : this.props.config?.layout.pages.find(p => p.pageId === link.linkToPageId)?.slug;
              var linkProps: object | undefined;
              if (linkToSlug) {
                linkProps = {
                  component: Link,
                  to: preserveEmbed(`/${linkToSlug}`, this.props.location),
                };
              } else if (link.url) {
                linkProps = {
                  component: MuiLink,
                  href: link.url,
                  underline: 'none',
                };
              } else {
                return null;
              }
              return (
                <CardActionArea
                  onClick={e => { }}
                  key={`${link.linkToPageId || link.url}`}
                  className={this.props.classes.landingPaper}
                  {...linkProps}
                >
                  {!!link.title && (
                    <Typography variant='h4' component='h2'>{link.title}</Typography>
                  )}
                  {!!link.description && (
                    <Typography variant='body1' component='div' className={this.props.classes.landingLinkDescription}>{link.description}</Typography>
                  )}
                  <GoIcon
                    className={this.props.classes.landingLinkGoIcon}
                    color='inherit'
                    fontSize='inherit'
                  />
                </CardActionArea>
              );
            })}
          </div>
        );
      }

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
        var panels: any = this.props.page.board.panels.map((panel, panelIndex) => (
          <BoardPanel server={this.props.server} panel={panel} />
        ));
        boardCmpt = (
          <BoardContainer server={this.props.server} board={this.props.page.board} panels={panels} />
        );
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
          {landingCmpt}
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

export const BoardContainer = (props: {
  server: Server,
  board: Client.PageBoard,
  panels?: any;
  overrideTitle?: React.ReactNode;
}) => {
  const classes = useStyles();

  if (props.board.title) {
    return (
      <DividerCorner
        className={classNames(classes.boardContainer, classes.spacing)}
        title={props.overrideTitle || props.board.title}
        height='100%'
        maxHeight={120}
      >
        <div className={classNames(classes.board, classes.boardInCorner)}>
          {props.panels}
        </div>
      </DividerCorner>
    );
  } else {
    return (
      <div className={classNames(classes.boardContainer, classes.board, classes.spacing)}>
        {props.panels}
      </div>
    );
  }
}

export const BoardPanel = (props: {
  server: Server,
  panel: Client.PagePanelWithHideIfEmpty,
  PanelPostProps?: Partial<React.ComponentProps<typeof PanelPost>>;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  return (
    <PanelPost
      key={getSearchKey(props.panel.search)}
      className={classes.boardPanel}
      maxHeight={theme.vh(80)}
      direction={Direction.Vertical}
      panel={props.panel}
      server={props.server}
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
      }}
      {...props.PanelPostProps}
    />
  );
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
})(withStyles(styles, { withTheme: true })(withRouter(CustomPage)));
