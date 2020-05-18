import { Badge, Divider, IconButton, Link, Tab, Tabs, Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import BalanceIcon from '@material-ui/icons/AccountBalance';
import AccountIcon from '@material-ui/icons/AccountCircle';
import NotificationsIcon from '@material-ui/icons/Notifications';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import * as Client from '../api/client';
import { ReduxState, Server, StateSettings, Status } from '../api/server';
import { contentScrollApplyStyles, Side } from '../common/ContentScroll';
import DropdownTab from '../common/DropdownTab';
import InViewObserver from '../common/InViewObserver';
import notEmpty from '../common/util/arrayUtil';
import { animateWrapper } from '../site/landing/animateUtil';
import LogIn from './comps/LogIn';
import NotificationBadge from './NotificationBadge';

const styles = (theme: Theme) => createStyles({
  indicator: {
    borderRadius: '1px',
    bottom: 'unset',
    top: 0,
    height: 1,
  },
  header: {
    width: '100%',
    maxWidth: '1024px',
    margin: '0px auto',
    padding: theme.spacing(1),
  },
  // TODO figure out how to place these AND allow scroll buttons
  // tabs: {
  // display: 'inline-flex',
  // whiteSpace: 'nowrap',
  // '&:before': {
  //   content: '\'\'',
  //   width: '100%',
  //   minWidth: '0px',
  //   maxWidth: '50px',
  //   display: 'inline-block',
  //   height: '100px',
  // },
  // '&:after': {
  //   content: '\'\'',
  //   width: '100%',
  //   minWidth: '0px',
  //   maxWidth: '50px',
  //   display: 'inline-block',
  //   height: '100px',
  // },
  // },
  tabRoot: {
    minWidth: '0px!important',
    padding: '6px 12px',
    [theme.breakpoints.up('md')]: {
      padding: '6px 24px',
    },
  },
  tabsFlexContainer: {
    alignItems: 'center',
    ...(contentScrollApplyStyles(theme, Side.Left)),
  },
  grow: {
    flexGrow: 1,
  },
  logoAndActions: {
    display: 'flex',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1, 2, 0, 2),
  },
  logoImg: {
    maxHeight: '48px',
    margin: theme.spacing(1),
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: theme.spacing(1, 2, 0, 2),
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
}
class Header extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & RouteComponentProps, State> {
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
    if (this.props.config && this.props.config.layout.menu.length > 0) {
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
            value={menu.menuId}
            selectedValue={this.props.page && this.props.page.slug}
            label={menu.name}
            links={dropdownItems}
            onDropdownTabSelect={value => this.props.pageChanged(value)}
          />
        );
      });
      menu = (
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
      );
    }

    var name: any = this.props.config?.name && (
      <Typography variant='h6'>
        {this.props.config && this.props.config.name}
      </Typography>
    );
    if (this.props.config && this.props.config.website) {
      name = (
        <Link color='inherit' href={this.props.config.website} underline='none' rel='noopener nofollow'>
          {name}
        </Link>
      );
    }
    var logo = this.props.config && (this.props.config.logoUrl || this.props.config.name) ? (
      <div className={this.props.classes.logo}>
        {this.props.config.logoUrl && (
          <img alt='logo' src={this.props.config.logoUrl} className={this.props.classes.logoImg} />
        )}
        {name}
      </div>
    ) : undefined;

    var rightSide;
    if (this.props.config && this.props.loggedInUser) {
      rightSide = (
        <div className={this.props.classes.actions}>
          <IconButton
            aria-label='Notifications'
            onClick={() => this.props.history.push('/notification')}
          >
            <NotificationBadge server={this.props.server}>
              <NotificationsIcon fontSize='small' />
            </NotificationBadge>
          </IconButton>
          {this.props.config.users.credits && (
            <IconButton
              aria-label='Balance'
              onClick={() => this.props.history.push('/transaction')}
            >
              <BalanceIcon fontSize='small' />
            </IconButton>
          )}
          <IconButton
            aria-label='Account'
            onClick={() => this.props.history.push('/account')}
          >
            <Badge
              color='secondary'
              invisible={!!this.props.loggedInUser.email && !!this.props.loggedInUser.name && this.props.loggedInUser.hasPassword}
              variant='dot'
            >
              <AccountIcon fontSize='small' />
            </Badge>
          </IconButton>
        </div>
      );
    } else if (this.props.config && !this.props.loggedInUser) {
      rightSide = (
        <div className={this.props.classes.actions}>
          <IconButton
            aria-label='Account'
            onClick={() => this.setState({ logInOpen: true })}
          >
            <AccountIcon fontSize='small' />
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

    return (
      <InViewObserver ref={this.inViewObserverRef}>
        <div className={this.props.classes.header}>
          <div className={this.props.classes.logoAndActions}>
            {logo}
            <div className={this.props.classes.grow} />
            {rightSide}
          </div>
          <Divider />
          {menu}
        </div>
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
    if (!page && pages.length > 0) {
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
})(withStyles(styles, { withTheme: true })(withRouter(Header)));
