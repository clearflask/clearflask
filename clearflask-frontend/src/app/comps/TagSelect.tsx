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
  className?: string,
  variant?: 'outlined' | 'filled' | 'standard',
  size?: 'small' | 'medium',
  label?: string;
  placeholder?: string;
  category: Client.Category;
  tagIds?: string[];
  isModOrAdminLoggedIn: boolean;
  onChange: (tagIds: string[], errorStr?: string) => void;
  disabled?: boolean;
  mandatoryTagIds?: string[];
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
  wrapper?: (children: any) => any;
}

class TagSelect extends Component<Props & WithStyles<typeof styles, true>> {
  render() {
    const tagSelection = this.getTagSelection(this.props.category, this.props.tagIds);

    if (tagSelection.options.length <= 0) {
      return null;
    };

    var result = (
      <SelectionPicker
        className={this.props.className}
        label={this.props.label}
        placeholder={this.props.placeholder}
        disabled={this.props.disabled}
        value={tagSelection.values}
        options={tagSelection.options}
        group={tagSelection.group}
        errorMsg={tagSelection.error}
        noOptionsMessage='No options'
        disableInput
        isMulti
        width='100%'
        onValueChange={labels => {
          const newTagIds = [...new Set(labels.map(label => label.value.substr(label.value.indexOf(':') + 1)))];
          const tagSelection = this.getTagSelection(this.props.category, newTagIds);
          this.props.onChange(newTagIds, tagSelection.error);
        }}
        {...this.props.SelectionPickerProps}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
          ...this.props.SelectionPickerProps?.TextFieldProps,
        }}
      />
    );

    if (this.props.wrapper) {
      result = this.props.wrapper(result);
    }

    return result;
  }

  getTagSelection(category: Client.Category, tagIds?: string[]): TagSelection {
    const moreThanOneTag = category.tagging.tagGroups.length > 1;
    const tagSelection: TagSelection = {
      values: [],
      options: [],
      mandatoryTagIds: this.props.mandatoryTagIds || [],
      group: moreThanOneTag,
    };
    const mandatoryTagIds = new Set(this.props.mandatoryTagIds);

    category.tagging.tagGroups
      .forEach(tagGroup => {
        if (!this.props.isModOrAdminLoggedIn && !tagGroup.userSettable) return;

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
            if (tagIds && tagIds.includes(tag.tagId)) {
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
            if (tagGroup.minRequired === 1) {
              tagSelection.error = `Choose at least one ${tagGroup.name} tag`;
            } else {
              tagSelection.error = `Choose at least ${tagGroup.minRequired} ${tagGroup.name} tags`;
            }
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
