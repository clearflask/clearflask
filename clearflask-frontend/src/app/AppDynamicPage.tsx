// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { CardActionArea, Typography } from '@material-ui/core';
import { createStyles, makeStyles, Theme, useTheme, withStyles, WithStyles } from '@material-ui/core/styles';
import GoIcon from '@material-ui/icons/ArrowRightAlt';
import classNames from 'classnames';
import React, { Component } from 'react';
import { useTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Client from '../api/client';
import { getSearchKey, ReduxState, Server, Status } from '../api/server';
import DynamicMuiIcon from '../common/icon/DynamicMuiIcon';
import RichViewer from '../common/RichViewer';
import { preserveEmbed } from '../common/util/historyUtil';
import { getProjectLink } from '../site/Dashboard';
import IdeaExplorer from './comps/IdeaExplorer';
import { Direction, PanelTitle } from './comps/Panel';
import PanelPost from './comps/PanelPost';
import TemplateLiquid from './comps/TemplateLiquid';
import ErrorPage from './ErrorPage';
import PageFeedback from './PageFeedback';
import DividerCorner from './utils/DividerCorner';
import Loader from './utils/Loader';

const styles = (theme: Theme) => createStyles({
  page: {
    margin: theme.spacing(1),
    '& > *:not(:first-child)': {
      marginTop: theme.spacing(4),
    },
  },
  titleAndDescription: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  spacingTitleAndDescription: {
    margin: theme.spacing(5, 16, 0),
    [theme.breakpoints.down('xs')]: {
      marginLeft: theme.spacing(4),
      marginRight: theme.spacing(4),
    },
    [theme.breakpoints.only('sm')]: {
      marginLeft: theme.spacing(8),
      marginRight: theme.spacing(8),
    },
  },
  title: {
    alignSelf: 'center',
  },
  description: {
    maxWidth: 400,
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
  boardContainerWithTitle: {
    marginTop: theme.spacing(4),
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
    margin: theme.spacing(4, 'auto', 0),
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  landingPaper: {
    flex: '1 1 150px',
    minWidth: 250,
    maxWidth: 250,
    height: 300,
    display: 'flex',
    boxShadow: '-10px 30px 40px 0 rgba(0,0,0,0.1)',
    // border: '1px solid ' + theme.palette.divider,
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingLinkTitle: {
  },
  landingLinkDescription: {
    color: theme.palette.text.secondary,
    margin: theme.spacing(0.5, 1),
  },
  landingLinkIcon: {
    color: theme.palette.text.secondary,
    fontSize: '4em',
    marginBottom: theme.spacing(1),
  },
  landingLinkGo: {
    color: theme.palette.primary.main,
    fontSize: '3em',
    alignSelf: 'flex-end',
    margin: theme.spacing(1, 4, 0, 0),
    [theme.breakpoints.down('xs')]: {
      marginRight: theme.spacing(1),
    },
  },
});
const useStyles = makeStyles(styles);
interface Props {
  server: Server;
  pageSlug: string;
  landingLinkOpenInNew?: boolean;
  ideaExplorerCreateFormAdminControlsDefaultVisibility?: React.ComponentProps<typeof IdeaExplorer>['createFormAdminControlsDefaultVisibility'],
}
interface ConnectProps {
  configver?: string;
  config?: Client.Config;
  pageNotFound: boolean;
  page?: Client.Page;
}
class AppDynamicPage extends Component<Props & ConnectProps & WithStyles<typeof styles, true>> {

  render() {
    if (this.props.pageNotFound) {
      return (<ErrorPage pageNotFound />);
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
      var feedbackCmpt;
      var boardCmpt;
      var explorerCmpt;

      // ### LANDING
      if (!!this.props.page.landing) {
        landingCmpt = (
          <LandingLinkContainer
            server={this.props.server}
            landing={this.props.page.landing}
            config={this.props.config}
            openInNew={this.props.landingLinkOpenInNew}
          />
        );
      }

      // ### PANELS
      if (this.props.page.panels.length > 0) {
        panelsCmpt = (
          <div className={classNames(this.props.classes.singlePanels)}>
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
                      showVoting: false,
                      showVotingCount: true,
                      showFunding: true,
                      showExpression: true,
                    }} />
                </div>
              );
            })}
          </div>
        );
      }

      // ### FEEDBACK
      if (this.props.page.feedback) {
        const pageFeedback = this.props.page.feedback;
        feedbackCmpt = (
          <PageFeedback
            server={this.props.server}
            pageFeedback={pageFeedback}
          />
        );
      }

      // ### BOARD
      if (this.props.page.board) {
        var panels: any = this.props.page.board.panels.map((panel, panelIndex) => (
          <BoardPanel server={this.props.server} panel={panel} />
        ));
        boardCmpt = (
          <BoardContainer title={this.props.page.board.title} panels={panels} />
        );
      }

      // ### EXPLORER
      if (this.props.page.explorer) {
        const explorer = this.props.page.explorer;
        explorerCmpt = (
          <IdeaExplorer
            className={this.props.classes.explorer}
            server={this.props.server}
            explorer={explorer}
            createFormAdminControlsDefaultVisibility={this.props.ideaExplorerCreateFormAdminControlsDefaultVisibility}
          />
        );
      }

      const titleDescription = (
        <PageTitleDescription page={this.props.page} />
      );

      page = (
        <div className={this.props.classes.page}>
          {titleDescription}
          {landingCmpt}
          {panelsCmpt}
          {feedbackCmpt}
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
  title?: string | React.ReactNode,
  panels?: any;
}) => {
  const classes = useStyles();
  const title = typeof props.title !== 'string' ? props.title : (
    <PanelTitle text={props.title} />
  );

  if (title) {
    return (
      <DividerCorner
        suppressDivider
        className={classNames(classes.boardContainer, classes.boardContainerWithTitle)}
        title={title}
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
      <div className={classNames(classes.boardContainer, classes.board)}>
        {props.panels}
      </div>
    );
  }
}

export const BoardPanel = (props: {
  className?: string,
  server: Server,
  panel: Client.PagePanelWithHideIfEmpty,
  PanelPostProps?: Partial<React.ComponentProps<typeof PanelPost>>;
}) => {
  const classes = useStyles();
  const theme = useTheme();
  return (
    <PanelPost
      key={getSearchKey(props.panel.search)}
      className={classNames(props.className, classes.boardPanel)}
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
        showVotingCount: false,
        showFunding: false,
        showExpression: false,
      }}
      {...props.PanelPostProps}
    />
  );
}

export const PageTitleDescription = (props: {
  page: Client.Page;
  suppressSpacing?: boolean;
}) => {
  const classes = useStyles();
  const { t } = useTranslation('app');

  var title;
  if (props.page.title) {
    title = (
      <Typography component="h1" variant="h4" color='textSecondary' className={classes.title}>{t(props.page.title as any)}</Typography>
    );
  }

  var desc;
  if (props.page.description) {
    desc = (
      <div className={classes.description}>
        <RichViewer key={props.page.description} iAgreeInputIsSanitized html={props.page.description} />
      </div>
    );
  }

  if (!title && !desc) return null;

  const titleAndDescription = (
    <div className={classNames(
      !props.suppressSpacing && classes.spacingTitleAndDescription,
      classes.titleAndDescription,
    )}>
      {title}
      {desc}
    </div>
  );

  return titleAndDescription;
}

export const LandingLinkContainer = (props: {
  server: Server,
  landing: Client.LayoutLanding;
  config?: Client.Config;
  openInNew?: boolean;
}) => {
  const classes = useStyles();
  return (
    <div className={classes.landing}>
      {props.landing.links?.map((link, index, arr) => (
        <LandingLink
          server={props.server}
          config={props.config}
          link={link}
          openInNew={props.openInNew}
        />
      ))}
    </div>
  );
}

export const LandingLink = (props: {
  server: Server,
  config?: Client.Config;
  link?: Client.LandingLink;
  openInNew?: boolean;
}) => {
  const classes = useStyles();
  const { t } = useTranslation('app');

  if (!props.link) return null;
  var linkToPage = !props.link.linkToPageId ? undefined
    : props.config?.layout.pages.find(p => p.pageId === props.link?.linkToPageId);
  var linkToSlug = linkToPage?.slug;
  var linkUrl = props.link.url;
  if (linkToSlug !== undefined && props.openInNew && props.config) {
    linkUrl = `${getProjectLink(props.config)}/${linkToSlug}`;
    linkToSlug = undefined;
  }
  var linkProps: object | undefined;
  if (linkToSlug) {
    linkProps = {
      component: Link,
      to: preserveEmbed(`/${linkToSlug}`),
    };
  } else if (linkUrl) {
    linkProps = {
      component: 'a',
      color: 'inherit',
      href: linkUrl,
      underline: 'none',
      rel: 'noreferrer noopener',
      ...(props.openInNew ? { target: '_blank' } : {}),
    };
  } else {
    return null;
  }

  const icon: string | undefined = props.link.icon || linkToPage?.icon;

  return (
    <CardActionArea
      key={`${props.link.linkToPageId || props.link.url}`}
      className={classes.landingPaper}
      {...linkProps}
    >
      {!!icon && (
        <DynamicMuiIcon
          name={icon}
          className={classes.landingLinkIcon}
          color='inherit'
          fontSize='inherit'
        />
      )}
      {!!props.link.title && (
        <Typography variant='h5' component='h2' className={classes.landingLinkTitle}>{t(props.link.title as any)}</Typography>
      )}
      {!!props.link.description && (
        <Typography variant='body1' component='div' className={classes.landingLinkDescription}>{t(props.link.description as any)}</Typography>
      )}
      <GoIcon
        className={classes.landingLinkGo}
        color='inherit'
        fontSize='inherit'
      />
    </CardActionArea>
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
})(withStyles(styles, { withTheme: true })(AppDynamicPage));
