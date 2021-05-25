import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server } from '../../api/server';
import SelectionPicker, { Label } from '../../app/comps/SelectionPicker';
import debounce, { SearchTypeDebounceTime } from '../../common/util/debounce';

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
  onChange?: (userLabel?: Label) => void;
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
  anyIdeaLabel?: Label;
}
interface State {
  input?: string;
  selectedLabel?: Label;
  options?: Label[];
  searching?: string;
}

class PostSelection extends Component<Props & ConnectProps & WithStyles<typeof styles, true>, State> {
  readonly searchPosts: (newValue: string) => void;

  constructor(props) {
    super(props);
    const selectedLabel = props.anyIdeaLabel;
    if (selectedLabel && !props.suppressInitialOnChange) {
      props.onChange && props.onChange(selectedLabel);
    }
    const search = (newValue: string, setInitial?: boolean) => this.props.server.dispatch()
      .then(d => d.ideaSearch({
        projectId: this.props.server.getProjectId(),
        ideaSearch: { searchText: newValue },
      }))
      .then(results => {
        const labels = results.results.map(PostSelection.mapPostToLabel);
        const setInitialLabel = (setInitial && !this.state.selectedLabel) ? labels[0] : undefined;
        if (setInitialLabel) {
          this.props.onChange && this.props.onChange(setInitialLabel);
        }
        this.setState({
          options: labels,
          ...(setInitialLabel ? { selectedLabel: setInitialLabel } : {}),
          ...(this.state.searching === newValue ? { searching: undefined } : {}),
        });
      }).catch(e => {
        if (this.state.searching === newValue) this.setState({ searching: undefined });
      });
    const searchDebounced = debounce(search, SearchTypeDebounceTime);
    this.searchPosts = newValue => {
      this.setState({ searching: newValue });
      searchDebounced(newValue);
    }
    if (!selectedLabel && props.searchIfEmpty) {
      this.state = { searching: '' };
      search('', true);
    } else {
      this.state = { selectedLabel };
    }
  }

  render() {
    const seenIds: Set<string> = new Set();
    const options: Label[] = [];
    const selectedLabel = this.state.selectedLabel;

    if (!!this.state.selectedLabel) {
      seenIds.add(this.state.selectedLabel.value);
      options.push(this.state.selectedLabel);
    }

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
        errorMsg={!selectedLabel && this.props.errorMsg || undefined}
        value={selectedLabel ? [selectedLabel] : []}
        options={options}
        loading={this.state.searching !== undefined}
        disableClearable={!this.props.allowClear}
        showTags
        bareTags
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
            this.searchPosts('');
          }
        }}
        onInputChange={(newValue, reason) => {
          this.setState({ input: newValue });
          if (reason === 'input') {
            this.searchPosts(newValue);
          }
        }}
        onValueChange={(labels) => {
          var selectedLabel: Label | undefined = labels[0];
          this.setState({
            selectedLabel: selectedLabel,
            input: undefined,
          })
          this.props.onChange && this.props.onChange(selectedLabel);
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

  static mapPostToLabel(post: Client.Idea): Label {
    const label: Label = {
      label: post.title,
      value: post.ideaId,
    };
    return label;
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state, ownProps) => {
  const anyIdea = state.ideas.byId[0]?.idea;
  const connectProps: ConnectProps = {
    anyIdeaLabel: anyIdea ? PostSelection.mapPostToLabel(anyIdea) : undefined,
  };
  return connectProps;
})(withStyles(styles, { withTheme: true })(PostSelection));
