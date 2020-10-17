import { Badge, Divider, IconButton, Link as MuiLink, Tab, Tabs, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import BalanceIcon from '@material-ui/icons/AccountBalance';
import AccountIcon from '@material-ui/icons/AccountCircle';
import NotificationsIcon from '@material-ui/icons/Notifications';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import * as Client from '../api/client';
import { ReduxState, Server, StateSettings, Status } from '../api/server';
import DropdownTab, { tabHoverApplyStyles } from '../common/DropdownTab';
import InViewObserver from '../common/InViewObserver';
import notEmpty from '../common/util/arrayUtil';
import { animateWrapper } from '../site/landing/animateUtil';
import LogIn from './comps/LogIn';
import TemplateLiquid from './comps/TemplateLiquid';
import NotificationBadge from './NotificationBadge';
import NotificationPopup from './NotificationPopup';

const styles = (theme: Theme) => createStyles({
  header: {
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap-reverse',
    minHeight: 48,
  },
  indicator: {
    borderRadius: '1px',
    // height: 1,
    // Uncomment to flip to the top
    // bottom: 'unset',
    // top: 0,
  },
  logoAndMenu: {
    flex: 100000,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerSpacing: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(2, 4, 2),
    [theme.breakpoints.down('xs')]: {
      padding: theme.spacing(2, 1, 2),
    },
  },
  menu: {
    flex: 1,
    margin: '0px auto',
  },
  tabRoot: {
    minWidth: '0px!important',
    padding: '6px 12px',
    [theme.breakpoints.up('md')]: {
      padding: '6px 24px',
    },
    ...(tabHoverApplyStyles(theme)),
    '&::before': {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      content: '"\\00a0"',
      borderRadius: '1px',
      borderBottom: `1px solid rgba(0, 0, 0, 0)`,
      transition: 'border-bottom-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
    },
    '&:hover::before': {
      borderBottom: '2px solid rgba(0, 0, 0, 0.87)',
    },
  },
  tabsFlexContainer: {
    alignItems: 'center',
  },
  tab: {
    textTransform: 'initial',
  },
  grow: {
    flexGrow: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 2, 0, 2),
    minHeight: 48,
  },
  logoImg: {
    maxHeight: '48px',
    padding: theme.spacing(1),
  },
  logoText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textDecoration: 'none',
  },
  actions: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  actionsContainer: {
    flex: 1,
    // When menu is too big and things wrap,
    // allow actions to overlap to make sure logo and actions are on the same line
    height: 0,
    overflow: 'visible',
  },
  actionButton: {
    margin: theme.spacing(0, 0.5, 0, 0),
    [theme.breakpoints.down('sm')]: {
      margin: 0,
      padding: 8,
    },
    fontSize: '1.2rem',
  },
  menuDivider: {
    marginTop: -1,
  },
});

interface Props {
  server: Server;
  pageSlug: string;
  pageChanged: (pageUrlName: string) => void;
}
interface ConnectProps {
  config?: Client.Config;
  page?: Client.Page;
  loggedInUser?: Client.UserMe;
  settings: StateSettings;
}
interface State {
  logInOpen?: boolean;
  notificationAnchorEl?: HTMLElement;
}
class Header extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  _isMounted: boolean = false;
  readonly inViewObserverRef = React.createRef<InViewObserver>();

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoMenuAnimate) {
      this.demoMenuAnimate(this.props.settings.demoMenuAnimate);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    var menu;
    if (this.props.config?.style.templates?.menu) {
      menu = (
        <TemplateLiquid
          template={this.props.config.style.templates.menu}
          customPageSlug={this.props.pageSlug}
        />
      );
    } else if (this.props.config && this.props.config.layout.menu.length > 0) {
      var currentTabValue = this.props.page
        ? this.props.page.slug
        : false;
      var tabs;
      tabs = this.props.config.layout.menu.map(menu => {
        if (!menu.pageIds || menu.pageIds.length === 0) return null;
        if (menu.pageIds.length === 1) {
          const page = this.props.config!.layout.pages.find(p => p.pageId === menu.pageIds[0]);
          if (page === undefined) return null;
          return (
            <Tab
              key={page.slug}
              className={this.props.classes.tab}
              component={Link}
              to={`/${page.slug}`}
              value={page.slug}
              disableRipple
              label={menu.name || page.name}
              classes={{
                root: this.props.classes.tabRoot,
              }}
            />
          );
        }
        const dropdownItems = menu.pageIds.map(pageId => {
          const page = this.props.config!.layout.pages.find(p => p.pageId === pageId);
          if (!page) {
            return undefined;
          }
          if (this.props.page && this.props.page.pageId === page.pageId) {
            currentTabValue = menu.menuId;
          }
          return { name: page.name, val: page.slug };
        })
          .filter(notEmpty);
        return (
          <DropdownTab
            key={menu.menuId}
            className={this.props.classes.tab}
            value={menu.menuId}
            selectedValue={this.props.page && this.props.page.slug}
            label={menu.name}
            links={dropdownItems}
            onDropdownTabSelect={value => this.props.pageChanged(value)}
          />
        );
      });
      menu = (
        <div className={this.props.classes.menu}>
          <Tabs
            // centered
            variant='standard'
            scrollButtons='off'
            classes={{
              flexContainer: this.props.classes.tabsFlexContainer,
              indicator: this.props.classes.indicator,
            }}
            value={currentTabValue}
            onChange={(event, value) => this.props.pageChanged(value)}
            indicatorColor="primary"
            textColor="primary"
          >
            {tabs}
          </Tabs>
        </div>
      );
    }

    var header;
    if (this.props.config?.style.templates?.header) {
      header = (
        <TemplateLiquid
          template={this.props.config.style.templates.header}
          customPageSlug={this.props.pageSlug}
        />
      );
    } else {
      var name: any = this.props.config?.name && (
        <Typography variant='h6'>
          {this.props.config && this.props.config.name}
        </Typography>
      );
      if (this.props.config && this.props.config.website) {
        name = (
          <MuiLink className={this.props.classes.logoText} color='inherit' href={this.props.config.website} underline='none' rel='noopener nofollow'>
            {name}
          </MuiLink>
        );
      }
      var logo = this.props.config && (this.props.config.logoUrl || this.props.config.name) ? (
        <div className={this.props.classes.logo}>
          {this.props.config.logoUrl && (
            <img alt='' src={this.props.config.logoUrl} className={this.props.classes.logoImg} />
          )}
          {name}
        </div>
      ) : undefined;

      var rightSide;
      if (this.props.config && this.props.loggedInUser) {
        rightSide = (
          <div className={this.props.classes.actions}>
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Notifications'
              onClick={e => this.setState({ notificationAnchorEl: !!this.state.notificationAnchorEl ? undefined : e.currentTarget })}
            >
              <NotificationBadge server={this.props.server}>
                <NotificationsIcon fontSize='inherit' />
                <NotificationPopup
                  server={this.props.server}
                  anchorEl={this.state.notificationAnchorEl}
                  onClose={() => this.setState({ notificationAnchorEl: undefined })}
                />
              </NotificationBadge>
            </IconButton>
            {this.props.config.users.credits && (
              <IconButton
                className={this.props.classes.actionButton}
                aria-label='Balance'
                component={Link}
                to='/transaction'
              >
                <BalanceIcon fontSize='inherit' />
              </IconButton>
            )}
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Account'
              component={Link}
              to='/account'
            >
              <Badge
                color='secondary'
                invisible={!!this.props.loggedInUser.email && !!this.props.loggedInUser.name && this.props.loggedInUser.hasPassword}
                variant='dot'
              >
                <AccountIcon fontSize='inherit' />
              </Badge>
            </IconButton>
          </div>
        );
      } else if (this.props.config && !this.props.loggedInUser) {
        rightSide = (
          <div className={this.props.classes.actions}>
            <IconButton
              className={this.props.classes.actionButton}
              aria-label='Account'
              onClick={() => this.setState({ logInOpen: true })}
            >
              <AccountIcon fontSize='inherit' />
            </IconButton>
            <LogIn
              server={this.props.server}
              open={this.state.logInOpen}
              onClose={() => this.setState({ logInOpen: false })}
              onLoggedInAndClose={() => this.setState({ logInOpen: false })}
            />
          </div>
        );
      }
      rightSide = (
        <div className={this.props.classes.actionsContainer}>
          {rightSide}
        </div>
      );

      header = (
        <div className={this.props.classes.headerSpacing}>
          <div className={this.props.classes.header}>
            <div className={this.props.classes.logoAndMenu}>
              {logo}
              {menu}
            </div>
            {rightSide}
          </div>
          <Divider className={this.props.classes.menuDivider} />
        </div>
      );
    }

    return (
      <InViewObserver ref={this.inViewObserverRef}>
        {header}
      </InViewObserver>
    );
  }

  async demoMenuAnimate(changes: Array<{ path: string }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;

    for (; ;) {
      for (const change of changes) {
        this.props.pageChanged(change.path);

        if (await animate({ sleepInMs: 2000 })) return;
      }
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  var page: Client.Page | undefined = undefined;
  if (state.conf.status === Status.FULFILLED && state.conf.conf) {
    const pages = state.conf.conf.layout.pages;
    page = pages.find(p => p.slug === ownProps.pageSlug);
    if (!page && ownProps.pageSlug === '' && pages.length > 0) {
      page = pages[0];
    }
  }
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    page: page,
    loggedInUser: state.users.loggedIn.user,
    settings: state.settings,
  };
})(withStyles(styles, { withTheme: true })(Header));
