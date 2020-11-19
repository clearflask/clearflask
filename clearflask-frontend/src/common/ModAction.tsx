import SettingsIcon from '@material-ui/icons/Settings';
import React from 'react';
import ModStar from './ModStar';

interface Props {
  label: string | React.ReactNode;
}
export default class ModAction extends React.Component<Props> {
  render() {
    return (
      <ModStar
        name={this.props.label}
        isMod={true}
        overrideIcon={SettingsIcon}
        overrideIconFontSize='0.9em'
      />
    );
  }
}
