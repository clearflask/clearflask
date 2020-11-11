import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import * as Client from '../../api/client';
import SelectionPicker, { Label } from './SelectionPicker';

interface TagSelection {
  values: Label[];
  options: Label[];
  mandatoryTagIds: string[];
  error?: string;
  group: boolean;
}

const styles = (theme: Theme) => createStyles({
  menuContainer: {
    margin: theme.spacing(2),
  },
  menuItem: {
    display: 'inline-block',
    width: '100%',
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
});

interface Props {
  label?: string;
  placeholder?: string;
  category: Client.Category;
  tagIds?: string[];
  onChange: (tagIds: string[]) => void;
  onErrorChange: (hasError: boolean) => void;
  disabled?: boolean;
  mandatoryTagIds?: string[];
}

class TagSelect extends Component<Props & WithStyles<typeof styles, true>> {
  previousHasError: boolean = false;

  render() {
    const tagSelection = this.getTagSelection(this.props.category);

    if (tagSelection.options.length <= 0) {
      return null;
    };

    if (!!tagSelection.error !== this.previousHasError) {
      this.props.onErrorChange(!!tagSelection.error);
      this.previousHasError = !!tagSelection.error;
    }

    return (
      <SelectionPicker
        label={this.props.label}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
        value={tagSelection.values}
        options={tagSelection.options}
        group={tagSelection.group}
        helperText=' ' // Keep it aligned
        errorMsg={tagSelection.error}
        isMulti={true}
        width='100%'
        onValueChange={labels => this.props.onChange(
          [...new Set(labels.map(label => label.value.substr(label.value.indexOf(':') + 1)))]
        )}
        overrideComponents={{
          MenuList: (menuProps) => {
            const tagGroups: { [tagGroupId: string]: React.ReactNode[] } = {};
            const children = Array.isArray(menuProps.children) ? menuProps.children : [menuProps.children];
            children.forEach((child: any) => {
              if (!child.props.data) {
                // child is "No option(s)" text, ignore
              } else {
                const tagGroupId = child.props.data.value.substr(0, child.props.data.value.indexOf(':'));
                if (!tagGroups[tagGroupId]) tagGroups[tagGroupId] = [];
                tagGroups[tagGroupId].push(child);
              }
            });
            const menuItems = Object.keys(tagGroups).map(tagGroupId => (
              <div className={this.props.classes.menuItem}>
                <Typography variant='overline'>{this.props.category.tagging.tagGroups.find(g => g.tagGroupId === tagGroupId)!.name}</Typography>
                {tagGroups[tagGroupId]}
              </div>
            ));
            return (
              <div {...menuProps} className={this.props.classes.menuContainer}>
                <div style={{
                  MozColumns: `150px`,
                  WebkitColumns: `150px`,
                  columns: `150px`,
                }}>
                  {menuItems}
                </div>
              </div>
            );
          },
        }}
      />
    );
  }

  getTagSelection(category: Client.Category): TagSelection {
    const moreThanOneTag = category.tagging.tagGroups.length > 1;
    const tagSelection: TagSelection = {
      values: [],
      options: [],
      mandatoryTagIds: this.props.mandatoryTagIds || [],
      group: moreThanOneTag,
    };
    const mandatoryTagIds = new Set(this.props.mandatoryTagIds);

    category.tagging.tagGroups
      .filter(tagGroup => tagGroup.userSettable)
      .forEach(tagGroup => {
        // Skip groups with tags that have mandatory tags
        if (tagGroup.tagIds.findIndex(t => mandatoryTagIds.has(t)) !== -1) return;

        var selectedCount = 0;
        category.tagging.tags
          .filter(t => tagGroup.tagIds.includes(t.tagId))
          .forEach(tag => {
            const label: Label = {
              label: tag.name,
              filterString: tag.name,
              value: `${tagGroup.tagGroupId}:${tag.tagId}`,
              groupBy: moreThanOneTag ? tagGroup.name : undefined,
              color: tag.color,
            };
            tagSelection.options.push(label);
            if (this.props.tagIds && this.props.tagIds.includes(tag.tagId)) {
              selectedCount++;
              tagSelection.values.push(label);
            }
          })
        if (tagGroup.minRequired !== undefined && selectedCount < tagGroup.minRequired) {
          if (tagGroup.minRequired === tagGroup.maxRequired) {
            if (tagGroup.minRequired === 1) {
              tagSelection.error = `Choose one ${tagGroup.name} tag`;
            } else {
              tagSelection.error = `Choose ${tagGroup.minRequired} ${tagGroup.name} tags`;
            }
          } else {
            tagSelection.error = `Choose at least ${tagGroup.maxRequired} ${tagGroup.name} tags`;
          }
        } else if (tagGroup.maxRequired !== undefined && selectedCount > tagGroup.maxRequired) {
          if (tagGroup.maxRequired === 1) {
            tagSelection.error = `Cannot choose more than one ${tagGroup.name} tag`;
          } else {
            tagSelection.error = `Cannot choose more than ${tagGroup.maxRequired} ${tagGroup.name} tags`;
          }
        }
      });

    return tagSelection;
  }
}

export default withStyles(styles, { withTheme: true })(TagSelect);
