// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link as MuiLink,
  Table, TableBody, TableCell, TableRow,
  Typography,
} from '@material-ui/core';
import ServerAdmin from '../../api/serverAdmin';
import * as ConfigEditor from '../../common/config/configEditor';
import Menu, { MenuHeading, MenuItem } from '../../common/config/settings/Menu';
import SettingsDynamicPage from '../../common/config/settings/SettingsDynamicPage';
import { contentScrollApplyStyles, Orientation } from '../../common/ContentScroll';
import { SectionContent } from '../../common/Layout';
import SubmitButton from '../../common/SubmitButton';
import { TourAnchor } from '../../common/tour';
import setTitle from "../../common/util/titleUtil";
import { Dashboard, DashboardPageContext, ProjectSettingsMainSize } from "../Dashboard";
import BillingPage from './BillingPage';
import {
  AccountSettingsNotifications,
  ProjectSettingsAdvancedEnter,
  ProjectSettingsApi,
  ProjectSettingsBase,
  ProjectSettingsBranding,
  ProjectSettingsChangelog,
  ProjectSettingsCookies,
  ProjectSettingsCoupons,
  ProjectSettingsData,
  ProjectSettingsDomain,
  ProjectSettingsFeedback,
  ProjectSettingsGitHub,
  ProjectSettingsGoogleAnalytics,
  ProjectSettingsHotjar,
  ProjectSettingsInstall,
  ProjectSettingsIntercom,
  ProjectSettingsLanding,
  ProjectSettingsLoginAs,
  ProjectSettingsRoadmap,
  ProjectSettingsTeammates,
  ProjectSettingsUsers,
  ProjectSettingsUsersOauth,
  ProjectSettingsUsersSso,
} from './ProjectSettings';
import SettingsPage from './SettingsPage';
import { SelfhostLicensePage } from './SelfhostLicensePage';
import { SelfhostInstallPage } from './SelfhostInstallPage';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { preserveEmbed } from '../../common/util/historyUtil';
import UserWithAvatarDisplay from '../../common/UserWithAvatarDisplay';
import { Server, Status } from '../../api/server';
import Loading from '../../app/utils/Loading';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';


const styles = (theme: Theme) => createStyles({
  table: {
    whiteSpace: 'nowrap',
    ...contentScrollApplyStyles({
      theme,
      orientation: Orientation.Horizontal,
      backgroundColor: theme.palette.background.paper,
    }),
  },
  selectedConvo: {
    fontWeight: 'bold',
  },
});
const useStyles = makeStyles(styles);

export const DashboardTalkConvoList = (props: {
  server: Server;
  selectedConvoId?: string;
  setSelectedConvoId: (convoId: string) => void;
}) => {
  const classes = useStyles();

  // TODO replace with actual data
  const status: Status = Status.FULFILLED;
  const convos = [
    {name: 'What is the most important thing our customers want', id: '1'},
    {name: 'Can you find who was asking for dark-mode feature?', id: '2'},
    {name: 'In the past week, did any customers complain about the status page?', id: '3'},
  ]

  return (
      <div className={classes.table}>
        <Table size='medium'>
          <TableBody>
            {convos.map(convo => (
              <TableRow
                key={convo.id}
                hover
                component={MuiLink}
                onClick={() => props.setSelectedConvoId(convo.id)}
              >
                <TableCell key='convo'>
                  <Typography className={classNames(convo.id === props.selectedConvoId && classes.selectedConvo)}>
                    {convo.name}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {status === Status.PENDING && (
            <TableCell key='pending'>
              <Loading />
            </TableCell>
          )}
          {status === Status.REJECTED && (
            <TableCell key='rejected'>
              Failed to load conversations
            </TableCell>
          )}
        </Table>
      </div>
  );
}
