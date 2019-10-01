import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { Breadcrumbs, Link } from '@material-ui/core';
import { Project } from '../../../api/serverAdmin';

interface Props {
  crumbs?:{name:string, slug:string}[];
  activeProject?: Project;
  activeSubPath?: ConfigEditor.Path;
  pageClicked:(path:string, subPath?:ConfigEditor.Path)=>void;
}

export default class Crumbs extends Component<Props> {
  unsubscribe:{[pathStr:string]:(()=>void)} = {};

  subscribe(item:ConfigEditor.Page|ConfigEditor.PageGroup|ConfigEditor.Property) {
    if(this.unsubscribe[item.pathStr] !== undefined) return;
    this.unsubscribe[item.pathStr] = item.subscribe(this.forceUpdate.bind(this));
  }

  componentWillUnmount() {
    Object.values(this.unsubscribe).forEach(u => u());
  }

  render() {
    const crumbs:React.ReactNode[] = [];
    if(this.props.crumbs) {
      this.props.crumbs.map(crumb => this.createCrumb(crumb.name, crumb.slug));
    } else if(this.props.activeProject) {
      const subpath = this.props.activeSubPath || [];
      for(let i = 0; i <= subpath.length; i++) {
        const currSubPath = subpath.slice(0, i);
        const item = this.props.activeProject.editor.get(currSubPath);
        if(item.type !== ConfigEditor.PageType) continue;
        this.subscribe(item);
        crumbs.push(this.createCrumb(item.getDynamicName(), this.props.activeProject.editor.getConfig().projectId, item.path));
      }
    }

    return (
      <Breadcrumbs separator="›" arial-label="Breadcrumb">
        {crumbs}
      </Breadcrumbs>
    );
  }

  createCrumb(name:string, path:string, subPath?:ConfigEditor.Path) {
    return (
      <Link color="inherit" onClick={() => this.props.pageClicked(path, subPath)}>
        {name}
      </Link>
    );
  }
}
