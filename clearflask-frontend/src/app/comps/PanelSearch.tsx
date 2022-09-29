// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { debounce, isWidthUp, withWidth, WithWidthProps } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import FilterIcon from '@material-ui/icons/TuneSharp';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import * as Client from '../../api/client';
import { ReduxState, Server, StateSettings } from '../../api/server';
import InViewObserver from '../../common/InViewObserver';
import { isFilterControllable, PostFilterType, postLabelsToSearch, postSearchToLabels } from '../../common/search/searchUtil';
import { SearchTypeDebounceTime } from '../../common/util/debounce';
import minmax from '../../common/util/mathutil';
import { initialWidth } from '../../common/util/screenUtil';
import { animateWrapper } from '../../site/landing/animateUtil';
import SelectionPicker from './SelectionPicker';


const styles = (theme: Theme) => createStyles({
  container: {
    margin: theme.spacing(1),
  },
  menuContainer: {
    margin: theme.spacing(2),
  },
  menuList: {
  },
  menuItem: {
    display: 'inline-block',
    width: '100%',
    webkitColumnBreakInside: 'avoid',
    pageBreakInside: 'avoid',
    breakInside: 'avoid',
  },
  inputRootHideBorder: {
    '&::before': {
      borderBottomColor: 'transparent',
    },
  },
});

interface Props {
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  server: Server;
  search?: Partial<Client.IdeaSearch>;
  onSearchChanged: (search: Partial<Client.IdeaSearch>) => void;
  explorer: Client.PageExplorer;
  showInitialBorder?: boolean;
}
interface ConnectProps {
  config?: Client.Config;
  settings: StateSettings;
}
interface State {
  searchValue?: string;
  menuIsOpen?: boolean;
}
class PanelSearch extends Component<Props & ConnectProps & WithStyles<typeof styles, true> & WithWidthProps, State> {
  state: State = {};
  _isMounted: boolean = false;
  readonly updateSearchText = debounce(
    (searchText?: string) => {
      if (!isFilterControllable(this.props.explorer, PostFilterType.Search)) return;
      this.props.onSearchChanged({
        ...this.props.search,
        searchText: searchText,
      });
    },
    SearchTypeDebounceTime);
  readonly inViewObserverRef = React.createRef<InViewObserver>();

  componentDidMount() {
    this._isMounted = true;
    if (!!this.props.settings.demoSearchAnimate) {
      this.demoSearchAnimate(this.props.settings.demoSearchAnimate);
    }
  }

  render() {
    const controls = postSearchToLabels(this.props.config, this.props.explorer, this.props.search);
    const isSearchable = isFilterControllable(this.props.explorer, PostFilterType.Search);
    return (
      <InViewObserver ref={this.inViewObserverRef} disabled={!this.props.settings.demoSearchAnimate}>
        <div className={`${this.props.classes.container} ${this.props.className || ''}`} style={this.props.style}>
          <SelectionPicker
            value={controls.values}
            menuIsOpen={!!this.state.menuIsOpen}
            menuOnChange={open => this.setState({ menuIsOpen: open })}
            inputValue={this.state.searchValue || ''}
            onInputChange={(newValue, reason) => {
              this.setState({ searchValue: newValue });
              if (isSearchable) {
                this.updateSearchText(newValue);
              }
            }}
            placeholder={this.props.placeholder || 'Search'}
            options={controls.options}
            isMulti
            group
            isInExplorer
            width={100}
            autocompleteClasses={{
              inputRoot: this.props.showInitialBorder ? undefined : this.props.classes.inputRootHideBorder,
            }}
            showTags={false}
            disableFilter
            disableCloseOnSelect
            disableClearOnValueChange
            onValueChange={labels => {
              const partialSearch = postLabelsToSearch(labels.map(l => l.value));
              this.props.onSearchChanged(partialSearch);
            }}
            formatHeader={inputValue => !!inputValue ? `Searching for "${inputValue}"` : `Type to search`}
            dropdownIcon={FilterIcon}
            popupColumnCount={minmax(
              1,
              controls.groups,
              !this.props.width || isWidthUp('sm', this.props.width, true) ? 3 : 2)}
            PopperProps={{ placement: 'bottom-end' }}
          />
        </div>
      </InViewObserver>
    );
  }

  async demoSearchAnimate(searchTerms: Array<{
    term: string;
    update: Partial<Client.IdeaSearch>;
  }>) {
    const animate = animateWrapper(
      () => this._isMounted,
      this.inViewObserverRef,
      () => this.props.settings,
      this.setState.bind(this));

    if (await animate({ sleepInMs: 1000 })) return;

    for (; ;) {
      for (const searchTerm of searchTerms) {
        if (await animate({ sleepInMs: 150, setState: { menuIsOpen: true } })) return;

        if (await animate({ sleepInMs: 2000 })) return;
        for (var i = 0; i < searchTerm.term.length; i++) {
          const term = searchTerm.term[i];
          if (await animate({
            sleepInMs: 10 + Math.random() * 30,
            setState: { searchValue: (this.state.searchValue || '') + term, menuIsOpen: true }
          })) return;
        }

        if (await animate({ sleepInMs: 2000, setState: { searchValue: '', menuIsOpen: undefined } })) return;
        this.props.onSearchChanged({ ...this.props.search, ...searchTerm.update });
      }

      if (await animate({ sleepInMs: 300 })) return;
      this.props.onSearchChanged({});
    }
  }
}

export default connect<ConnectProps, {}, Props, ReduxState>((state: ReduxState, ownProps: Props) => {
  return {
    configver: state.conf.ver, // force rerender on config change
    config: state.conf.conf,
    settings: state.settings,
  }
}, null, null, { forwardRef: true })(withWidth({ initialWidth })(withStyles(styles, { withTheme: true })(PanelSearch)));
