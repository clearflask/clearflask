// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import { notEmpty } from '../../common/util/arrayUtil';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';
import { truncateWithElipsis } from '../../common/util/stringUtil';

const styles = (theme: Theme) => createStyles({
  createFormField: {
    margin: theme.spacing(1),
    width: 'auto',
    flexGrow: 1,
  },
});

interface Props {
  className?: string;
  variant?: 'outlined' | 'filled' | 'standard',
  size?: 'small' | 'medium',
  disabled?: boolean;
  server: Server;
  isMulti?: boolean;
  initialSelectAny?: boolean;
  initialPostIds?: string[];
  onChange?: (postIds: string[]) => void;
  suppressInitialOnChange?: boolean;
  searchIfEmpty?: boolean;
  allowClear?: boolean;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorMsg?: string;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  SelectionPickerProps?: Partial<React.ComponentProps<typeof SelectionPicker>>;
}
interface ConnectProps {
  callOnMount?: () => void,
  initialPostLabels?: Label[];
  anyPostLabel?: Label;
}
interface State {
  input?: string;
  selectedLabels?: Label[];
  options?: Label[];
  searching?: string;
}

class PostSelection extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  state: State = {};
  readonly searchDebounced: (newValue: string) => void;
  anyLabelOnChangeCalled = false;

  constructor(props) {
    super(props);

    this.searchDebounced = debounce(async (newValue: string) => {
      this.setState({ searching: newValue });
      try {
        const ideaSearchResponse = await (await this.props.server.dispatch()).ideaSearch({
          projectId: this.props.server.getProjectId(),
          ideaSearch: { searchText: newValue },
        });
        if (this.state.searching === newValue) {
          const labels = ideaSearchResponse.results.map(idea => PostSelection.mapPostToLabel(idea, this.props.isMulti));
          this.setState({
            options: labels,
            searching: undefined,
          });
        }
      } catch (e) {
        if (this.state.searching === newValue) {
          this.setState({ searching: undefined });
        }
      }
    }, SearchTypeDebounceTime);
  }

  componentDidMount() {
    this.props.callOnMount?.();

    if (this.props.searchIfEmpty && this.state.searching === undefined) {
      this.searchDebounced('');
    }
  }

  render() {
    var selectedPostLabels: Label[] | undefined;
    if (this.state.selectedLabels !== undefined) {
      selectedPostLabels = this.state.selectedLabels;
    } else if (this.props.initialPostLabels !== undefined) {
      selectedPostLabels = this.props.initialPostLabels;
    } else if (this.props.anyPostLabel) {
      selectedPostLabels = [this.props.anyPostLabel];
      if (!this.anyLabelOnChangeCalled) {
        this.anyLabelOnChangeCalled = true;
        this.props.onChange?.([this.props.anyPostLabel.value]);
      }
    }
    const seenIds: Set<string> = new Set((selectedPostLabels || []).map(l => l.value));
    const options: Label[] = [...(selectedPostLabels || [])];

    this.state.options && this.state.options.forEach(option => {
      if (!seenIds.has(option.value)) {
        seenIds.add(option.value);
        options.push(option);
      }
    });

    return (
      <SelectionPicker
        className={this.props.className}
        label={this.props.label}
        placeholder={this.props.placeholder}
        helperText={this.props.helperText}
        errorMsg={!selectedPostLabels?.length && this.props.errorMsg || undefined}
        options={options}
        loading={this.state.searching !== undefined}
        disableClearable={!this.props.allowClear}
        showTags
        isMulti={this.props.isMulti}
        bareTags={!this.props.isMulti}
        disableFilter
        inputMinWidth={0}
        width={this.props.width}
        minWidth={this.props.minWidth}
        maxWidth={this.props.maxWidth}
        disabled={this.props.disabled}
        clearOnBlur
        inputValue={this.state.input || ''}
        onFocus={() => {
          if (this.state.options === undefined
            && this.state.searching === undefined
            && this.state.input === undefined) {
            this.searchDebounced('');
          }
        }}
        onInputChange={(newValue, reason) => {
          this.setState({ input: newValue });
          if (reason === 'input') {
            this.searchDebounced(newValue);
          }
        }}
        value={selectedPostLabels || []}
        onValueChange={(labels) => {
          this.setState({
            selectedLabels: labels,
            input: undefined,
          })
          this.props.onChange?.(labels.map(label => label.value));
        }}
        {...this.props.SelectionPickerProps}
        TextFieldProps={{
          variant: this.props.variant,
          size: this.props.size,
          ...this.props.SelectionPickerProps?.TextFieldProps,
        }}
      />
    );
  }

  static mapPostToLabel(post: Client.Idea, isMulti?: boolean): Label {
    const label: Label = {
      label: truncateWithElipsis(isMulti ? 30 : 50, post.title),
      value: post.ideaId,
    };
    return label;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  var callOnMount;
  var initialPostLabels: Label[] | undefined;
  if (ownProps.initialPostIds) {
    initialPostLabels = [];
    const missingPostIds = ownProps.initialPostIds.map(postId => {
      const post = state.ideas.byId[postId]?.idea;
      if (post) {
        initialPostLabels?.push(PostSelection.mapPostToLabel(post, ownProps.isMulti))
        return undefined;
      } else {
        return postId;
      }
    }).filter(notEmpty) || [];
    if (!missingPostIds.length) {
      callOnMount = () => ownProps.server.dispatch().then(d => d.ideaGetAll({
        projectId: state.projectId!,
        ideaGetAll: {
          postIds: missingPostIds,
        },
      }));
    }
  }

  const anyPost = ownProps.initialSelectAny && Object.values(state.ideas.byId).find(post => !!post.idea)?.idea;
  const anyPostLabel = anyPost ? PostSelection.mapPostToLabel(anyPost, ownProps.isMulti) : undefined;

  const connectProps: ConnectProps = {
    callOnMount,
    initialPostLabels,
    anyPostLabel,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(PostSelection));
