import React, { Component } from 'react';
import * as Client from '../api/client';
import { Typography, Grid, Avatar, Tabs, Tab, Button, Hidden, Divider, Badge, IconButton, Select, MenuItem, Input } from '@material-ui/core';
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft';
import ArrowRight from '@material-ui/icons/KeyboardArrowRight';
import Balance from '@material-ui/icons/AccountBalance';
import Notifications from '@material-ui/icons/Notifications';
import { Server } from '../api/server';
import DropdownTab from '../common/DropdownTab';
import RegularTab from '../common/RegularTab';
import { withStyles, StyledComponentProps, Theme, createStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme:Theme) => createStyles({
  indicator: {
    borderRadius: '1px',
  },
});

interface Props extends WithStyles<typeof styles> {
  server:Server;
  conf?:Client.Config;
  page?:Client.Page;
  pageChanged:(pageUrlName:string)=>void;
}

class Header extends Component<Props> {
  readonly styles = {
    container: {
      maxWidth: '1024px',
      margin: '0px auto'
    },
  };

  render() {
    var currentTabValue;
    var tabs;
    if(!this.props.conf) {
      currentTabValue = undefined;
      tabs = undefined;
    } else {
      currentTabValue = this.props.page
        ? this.props.page.slug
        : undefined;
      tabs = this.props.conf.layout.menu.map(menu => {
        if(!menu.pageIds || menu.pageIds.length === 0) return null;
        if(menu.pageIds.length === 1) {
          const page = this.props.conf!.layout.pages.find(p => p.pageId === menu.pageIds[0]);
          if(page === undefined) return null;
          return (
            <RegularTab
              key={page.slug}
              value={page.slug}
              disableRipple
              label={menu.name || page.name}
            />
          );
        }
        const dropdownItems = menu.pageIds.map(pageId => {
          const page = this.props.conf!.layout.pages.find(p => p.pageId === pageId)!;
          if(this.props.page && this.props.page.pageId === page.pageId) {
            currentTabValue = menu.menuId;
          }
          return { name: page.name, val: page.slug };
        });
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
    }

    return (
      <div style={this.styles.container}>
        <Grid
          style={{paddingTop: '12px'}}
          container
          direction='row'
          justify='center'
          alignItems='baseline'
          spacing={16}
        >
          <Grid item xs={6}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
            }}>
              {this.props.conf && this.props.conf.logoUrl && (
                <img src={this.props.conf.logoUrl} style={{maxHeight: '48px'}} />
              )}
              <Typography variant='h6'>
                {this.props.conf && this.props.conf.name || 'ClearFlask'}
              </Typography>
            </div>
          </Grid>
          <Grid item xs={6}>
            <div style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}>
              <IconButton aria-label="Notifications">
                <Badge badgeContent={1} color='secondary'>
                  <Notifications />
                </Badge>
              </IconButton>
              <IconButton aria-label="Account balance">
                <Badge badgeContent='2k' color='primary'>
                  <Balance />
                </Badge>
              </IconButton>
              <Avatar>W</Avatar>
            </div>
          </Grid>
        </Grid>
        <Tabs
          variant='scrollable'
          scrollButtons="auto"
          classes={{
            indicator: this.props.classes.indicator,
          }}
          ScrollButtonComponent={(props) => (
            <Button
              disableRipple
              style={{
                padding: '0px',
                minWidth: props.visible ? '40px' : '0px',
                width: props.visible ? '30px' : '0px',
                transition: 'min-width 100ms ease-out',
                overflow: 'hidden',
                position: 'absolute',
                zIndex: 1000,
                height: '48px',
                WebkitScrollbar: 'none',
                right: props.direction === 'right' ? '0px' : '',
                background: `radial-gradient(ellipse at ${props.direction}, #fafafa 60%, rgba(255,255,255,0) 70%),
                             radial-gradient(ellipse at center, #fafafa 60%, rgba(255,255,255,0) 70%)`,
              }}
              onClick={props.onClick.bind()}
            >
              {props.direction === 'left'
                ? (<ArrowLeft />)
                : (<ArrowRight />)}
            </Button>
          )}
          value={currentTabValue}
          onChange={(event, value) => this.props.pageChanged(value)}
          indicatorColor="primary"
          textColor="primary"
        >
          {tabs}
        </Tabs>
        <Divider />
      </div>
    );
  }

  menuSelected(menuId:string) {

  }
}

export default withStyles(styles, { withTheme: true })(Header);
