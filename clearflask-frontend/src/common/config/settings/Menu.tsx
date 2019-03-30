import React, { Component } from 'react';
import * as ConfigEditor from '../configEditor';
import { ListItem, ListItemIcon, ListItemText } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import List, { ListProps } from '@material-ui/core/List';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import ListSubheader from '@material-ui/core/ListSubheader';

interface Props extends ListProps {
  page:ConfigEditor.Page;
  pageClicked:(page:ConfigEditor.Page|ConfigEditor.PageGroup)=>void;
}

interface State {
  expanded:{[groupKey:string]:boolean};
}

export default class Menu extends Component<Props, State> {

  constructor(props:Props) {
    super(props);

    this.state = {
      expanded: {},
    };
  }

  render() {
    var childPages:ConfigEditor.Page[] = this.props.page.getChildren().pages;
    var childPageGroups:ConfigEditor.PageGroup[] = this.props.page.getChildren().groups;

    return (
      <List
        component='nav'
        {...this.props}
      >
        <ListItem button onClick={() => {
          this.props.pageClicked(this.props.page);
        }}>
          <ListItemText primary={this.props.page.name} />
        </ListItem>
        {this.renderPages(childPages)}
        {childPageGroups.map(childPageGroup => {
          const key = childPageGroup.path.join('.');
          const grandChildPages = childPageGroup.getChildPages();
          return [
            <ListItem button onClick={() => {
              this.setState({expanded: {
                ...this.state.expanded,
                [key]: !this.state.expanded[key],
              }});
              this.props.pageClicked(childPageGroup);
            }}>
              <ListItemText primary={childPageGroup.name}/>
              {(grandChildPages.length > 0 || grandChildPages.length > 0)
                && (this.state.expanded ? <ExpandLess /> : <ExpandMore />)}
            </ListItem>,
            <Collapse in={this.state.expanded[key]} timeout="auto" unmountOnExit>
              {this.renderPages(childPageGroup.getChildPages())}
            </Collapse>,
          ];
        })}
      </List>
    );
  }

  renderPages(childPages:ConfigEditor.Page[]) {
    return childPages.map(childPage =>
      <Menu
        page={childPage}
        pageClicked={this.props.pageClicked}
        // TODO component='div'
        disablePadding
      />
    );
  }
}
