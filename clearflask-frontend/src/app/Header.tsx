import React, { Component } from 'react';
import * as Client from '../api/client';
import { Typography, Grid, Avatar, Tabs, Tab, Button, Hidden, Divider, Badge, IconButton } from '@material-ui/core';
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft';
import ArrowRight from '@material-ui/icons/KeyboardArrowRight';
import Balance from '@material-ui/icons/AccountBalance';
import Notifications from '@material-ui/icons/Notifications';
import { Server } from '../api/server';


interface Props {
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
      tabs = this.props.conf.layout.pages.map(p => 
        (<Tab key={p.slug} disableRipple label={p.name} value={p.slug} />));
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
        <Divider style={{
          marginTop: '-2px',
          height: '2px',
        }} />
      </div>
    );
  }
}

export default Header;
