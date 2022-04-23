// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Breadcrumbs, Link } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Project } from '../../../api/serverAdmin';
import * as ConfigEditor from '../configEditor';

const styles = (theme: Theme) => createStyles({
  link: {
    cursor: 'pointer',
  }
});
interface Props {
  crumbs?: { name: string, slug: string }[];
  activeProjectSlug?: string;
  activeProjectSlugName?: string;
  activeProject?: Project;
  activeSubPath?: ConfigEditor.Path;
  pageClicked: (path: string, subPath?: ConfigEditor.Path) => void;
}
class Crumbs extends Component<Props & WithTranslation<'app'> & WithStyles<typeof styles, true>> {
  unsubscribe: { [pathStr: string]: (() => void) } = {};

  subscribe(item: ConfigEditor.Page | ConfigEditor.PageGroup | ConfigEditor.Property) {
    if (this.unsubscribe[item.pathStr] !== undefined) return;
    this.unsubscribe[item.pathStr] = item.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    Object.values(this.unsubscribe).forEach(u => u());
  }

  render() {
    const crumbs: React.ReactNode[] = [];
    if (this.props.crumbs) {
      this.props.crumbs.map(crumb => this.createCrumb(crumb.name, crumb.slug));
    } else if (this.props.activeProject && this.props.activeProjectSlug) {
      const subpath = this.props.activeSubPath || [];
      for (let i = 0; i <= subpath.length; i++) {
        const currSubPath = subpath.slice(0, i);
        const item = this.props.activeProject.editor.get(currSubPath);
        if (item.type !== ConfigEditor.PageType) continue;
        this.subscribe(item);
        const name = (i === 0 && this.props.activeProjectSlugName)
          ? this.props.activeProjectSlugName : this.props.t(item.getDynamicName() as any);
        crumbs.push(this.createCrumb(name, this.props.activeProjectSlug, item.path));
      }
    }

    return (
      <Breadcrumbs separator="/" arial-label="Breadcrumb">
        {crumbs}
      </Breadcrumbs>
    );
  }

  createCrumb(name: string, path: string, subPath?: ConfigEditor.Path) {
    return (
      <Link
        key={path}
        className={this.props.classes.link}
        color="inherit"
        onClick={() => this.props.pageClicked(path, subPath)}
      >
        {name}
      </Link>
    );
  }
}

export default withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(Crumbs))
