// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Typography } from '@material-ui/core';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import React, { Component } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Server } from '../../../api/server';
import { ReduxStateAdmin } from '../../../api/serverAdmin';
import setTitle from '../../util/titleUtil';
import * as ConfigEditor from '../configEditor';
import CreditPreview from './injects/CreditPreview';
import WorkflowPreview from './injects/WorkflowPreview';
import PresetWidget from './PresetWidget';
import Property from './Property';

const styles = (theme: Theme) => createStyles({
});
interface Props {
  key: string;
  page: ConfigEditor.Page;
  server: Server;
  editor: ConfigEditor.Editor;
  pageClicked: (path: ConfigEditor.Path) => void;
}
interface ConnectProps {
  accountBasePlanId?: string;
}
class SettingsDynamicPage extends Component<Props & ConnectProps & WithTranslation<'app'> & WithStyles<typeof styles, true>> {
  unsubscribePage?: () => void;
  unsubscribeUsedSettings?: () => void;
  cachedUsedAdvancedSettings?: boolean;

  componentDidMount() {
    this.unsubscribePage = this.props.page.subscribe(this.onChangedPage.bind(this));
    if (!this.props.editor.getProperty<ConfigEditor.BooleanProperty>(['usedAdvancedSettings']).value) {
      this.unsubscribeUsedSettings = this.props.editor.subscribe(this.usedSettings.bind(this));
    }
  }

  componentWillUnmount() {
    this.unsubscribePage?.();
    this.unsubscribeUsedSettings?.();
  }

  render() {
    const translatedDynamicName = this.props.t(this.props.page.getDynamicName() as any);
    setTitle(translatedDynamicName);

    const creditPreview = this.props.page.pathStr === 'users.credits'
      && (<CreditPreview editor={this.props.editor} />);
    var workflowPreview;
    if (this.props.page.path.length > 0 && this.props.page.path[this.props.page.path.length - 1] === 'workflow') {
      workflowPreview = (
        <WorkflowPreview editor={this.props.editor} categoryIndex={this.props.page.path[2] as number} />
      );
    }

    return (
      <div>
        <Typography variant='h4' component='h1'>{translatedDynamicName}</Typography>
        <Typography variant='body1' component='p'>{this.props.page.description}</Typography>
        <PresetWidget page={this.props.page} editor={this.props.editor} />
        {creditPreview}
        {workflowPreview}
        {this.props.page.getChildren().all
          .filter(child => !child.hide)
          .map(child => (
            <Property
              server={this.props.server}
              key={child.key}
              prop={child}
              pageClicked={this.props.pageClicked}
              width={350}
            />
          ))}
      </div>
    );
  }

  onChangedPage() {
    this.forceUpdate();
  }

  usedSettings() {
    this.unsubscribeUsedSettings?.();
    this.props.editor.getProperty<ConfigEditor.BooleanProperty>(['usedAdvancedSettings'])
      .set(true);
  }
}

export default connect<ConnectProps, {}, Props, ReduxStateAdmin>((state, ownProps) => {
  return {
    accountBasePlanId: state.account.account.account?.basePlanId,
  };
})(withStyles(styles, { withTheme: true })(withTranslation('app', { withRef: true })(SettingsDynamicPage)));
