import React, { Component } from 'react';
import { Api, Conf, ConfViewPage, ApiInterface } from '../api/client';
import { Typography, Grid, Avatar, Tabs, Tab, Button, Hidden, Divider } from '@material-ui/core';
import ArrowLeft from '@material-ui/icons/KeyboardArrowLeft';
import ArrowRight from '@material-ui/icons/KeyboardArrowRight';

interface Props {
  api:ApiInterface;
  conf?:Conf;
  pageConf?:ConfViewPage;
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
      currentTabValue = this.props.pageConf
        ? this.props.pageConf.urlName
        : undefined;
      tabs = this.props.conf.pages.map(p => 
        (<Tab key={p.urlName} disableRipple label={p.name} value={p.urlName} />));
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
            <Typography variant='h6'>
              ClearFlask
            </Typography>
          </Grid>
          <Grid item xs={6}>
              <Avatar style={{marginLeft: 'auto'}}>W</Avatar>
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
