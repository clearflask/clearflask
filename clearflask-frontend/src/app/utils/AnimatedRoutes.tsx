import React, { PropsWithChildren } from 'react';
import { ReduxState } from '../../api/server';
import { connect } from 'react-redux';
import MuiAnimatedSwitch from '../../common/MuiAnimatedSwitch';
import { WithTheme, withTheme } from '@material-ui/core/styles';
import { Switch } from 'react-router';

interface Props extends WithTheme {
  render:(pageSlug:string) => React.ReactNode;
}

interface ConnectProps {
  customPageSlugs?:string[];
}

const AnimatedPageSwitch = connect<ConnectProps,{},Props,ReduxState>((state) => {return {
  customPageSlugs: state.conf.conf && state.conf.conf.layout.pages.map(p => p.slug),
}})((props:PropsWithChildren<Props&ConnectProps>) => {
  const children = [
    props.children,
    ...(props.customPageSlugs || []).filter(pageSlug => !!pageSlug).map(customPageSlug => props.render(customPageSlug)),
    props.render(''),
  ];
  return props.theme.disableTransitions
    ? <Switch>{children}</Switch>
    : <MuiAnimatedSwitch>{children}</MuiAnimatedSwitch>;
});

export default withTheme(AnimatedPageSwitch);
