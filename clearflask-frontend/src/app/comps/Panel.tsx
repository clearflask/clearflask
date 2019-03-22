import React, { Component } from 'react';
import { StateIdeas } from '../../api/server';
import IdeaCard from './IdeaCard';

export enum Direction {
  Horizontal,
  Vertical,
  Wrap,
}

interface Props extends StateIdeas {
  searchKey?:string;
  direction:Direction
}

export default class Panel extends Component<Props> {
  readonly styles = {
    container: {
      display: 'flex',
    },
  };

  render() {
    const bySearch = this.props.searchKey && this.props.bySearch[this.props.searchKey];
    const ideaIds:(string|undefined)[] = bySearch && bySearch.ideaIds || [undefined];
    const ideas = ideaIds.map(ideaId => {
      const byId = ideaId && this.props.byId[ideaId];
      return (
        <IdeaCard idea={byId && byId.idea || undefined} />
      )
    });

    var directionStyle;
    switch(this.props.direction) {
      case Direction.Horizontal:
        directionStyle = {
        };
        break;
      case Direction.Vertical:
        directionStyle = {
          flexDirection: 'column',
        };
        break;
      default:
      case Direction.Wrap:
        directionStyle = {
          flexWrap: 'wrap',
        };
        break;
    }

    return (
      <div style={{
        ...this.styles.container,
        ...(directionStyle),
      }}>
        {ideas}
      </div>
    );
  }
}
