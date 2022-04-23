// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { Button, Checkbox, Collapse, Container, IconButton, Link as MuiLink, Slider, SvgIconTypeMap, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, Tooltip, Typography, useMediaQuery } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, darken, fade, lighten, makeStyles, Theme, useTheme } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import CheckIcon from '@material-ui/icons/Check';
import MobileDesktopIcon from '@material-ui/icons/DevicesRounded';
import FilterIcon from '@material-ui/icons/FilterList';
import AlternativesIcon from '@material-ui/icons/FilterNone';
import DesignIcon from '@material-ui/icons/FormatPaint';
import ImportExportIcon from '@material-ui/icons/ImportExport';
import OpenIcon from '@material-ui/icons/OpenInNew';
import PaymentIcon from '@material-ui/icons/Payment';
import PeopleIcon from '@material-ui/icons/People';
import FeaturesIcon from '@material-ui/icons/PlaylistAddCheck';
import SpeakIcon from '@material-ui/icons/RecordVoiceOver';
import CustomizeIcon from '@material-ui/icons/SettingsRounded';
import AnalyzeIcon from '@material-ui/icons/ShowChart';
import SpeedIcon from '@material-ui/icons/Speed';
import TranslateIcon from '@material-ui/icons/Translate';
import IntegrationsIcon from '@material-ui/icons/Widgets';
import { Alert } from '@material-ui/lab';
import classNames from 'classnames';
import React, { useContext, useState } from 'react';
import ReactGA from 'react-ga';
import { Link } from 'react-router-dom';
import Scrollspy from 'react-scrollspy';
import ClearFlaskImg from '../../public/img/clearflask-logo.png';
import CompareImg from '../../public/img/landing/compare.svg';
import AhaImg from '../../public/img/landing/compare/aha.png';
import AskNicelyImg from '../../public/img/landing/compare/asknicely.png';
import DesktopCannyImg from '../../public/img/landing/compare/canny-desktop.jpg';
import MobileCannyImg from '../../public/img/landing/compare/canny-mobile.jpg';
import CannyImg from '../../public/img/landing/compare/canny.png';
import DesktopClearFlaskImg from '../../public/img/landing/compare/clearflask-desktop.jpg';
import MobileClearFlaskImg from '../../public/img/landing/compare/clearflask-mobile.jpg';
import DesktopConfluxImg from '../../public/img/landing/compare/conflux-desktop.jpg';
import MobileConfluxImg from '../../public/img/landing/compare/conflux-mobile.jpg';
import ConfluxImg from '../../public/img/landing/compare/conflux.png';
import DesktopConvasImg from '../../public/img/landing/compare/convas-desktop.jpg';
import MobileConvasImg from '../../public/img/landing/compare/convas-mobile.jpg';
import ConvasImg from '../../public/img/landing/compare/convas.png';
import ExcelImg from '../../public/img/landing/compare/excel.png';
import DesktopFeatureUpvoteImg from '../../public/img/landing/compare/featureupvote-desktop.jpg';
import MobileFeatureUpvoteImg from '../../public/img/landing/compare/featureupvote-mobile.jpg';
import FeatureUpvoteImg from '../../public/img/landing/compare/featureupvote.png';
import DesktopFiderImg from '../../public/img/landing/compare/fider-desktop.jpg';
import MobileFiderImg from '../../public/img/landing/compare/fider-mobile.jpg';
import FiderImg from '../../public/img/landing/compare/fider.png';
import DesktopHelloNextImg from '../../public/img/landing/compare/hellonext-desktop.jpg';
import MobileHelloNextImg from '../../public/img/landing/compare/hellonext-mobile.jpg';
import HelloNextImg from '../../public/img/landing/compare/hellonext.png';
import DesktopNoltImg from '../../public/img/landing/compare/nolt-desktop.jpg';
import MobileNoltImg from '../../public/img/landing/compare/nolt-mobile.jpg';
import NoltImg from '../../public/img/landing/compare/nolt.png';
import DesktopNooraImg from '../../public/img/landing/compare/noora-desktop.jpg';
import MobileNooraImg from '../../public/img/landing/compare/noora-mobile.jpg';
import NooraImg from '../../public/img/landing/compare/noora.png';
import PendoImg from '../../public/img/landing/compare/pendo.png';
import ProdPadImg from '../../public/img/landing/compare/prodpad.png';
import ProductBoardImg from '../../public/img/landing/compare/productboard.png';
import DesktopRoadmapSpaceImg from '../../public/img/landing/compare/roadmapspace-desktop.jpg';
import MobileRoadmapSpaceImg from '../../public/img/landing/compare/roadmapspace-mobile.jpg';
import RoadmapSpaceImg from '../../public/img/landing/compare/roadmapspace.png';
import SalesforceIdeaExchangeImg from '../../public/img/landing/compare/salesforce.png';
import SheetsImg from '../../public/img/landing/compare/sheets.png';
import ShipRightImg from '../../public/img/landing/compare/shipright.png';
import SimpleFeatureRequestsImg from '../../public/img/landing/compare/simplefeaturerequests.png';
import DesktopSuggestedImg from '../../public/img/landing/compare/suggested-desktop.jpg';
import MobileSuggestedImg from '../../public/img/landing/compare/suggested-mobile.jpg';
import SuggestedImg from '../../public/img/landing/compare/suggested.png';
import TrelloImg from '../../public/img/landing/compare/trello.png';
import DesktopUpvotyImg from '../../public/img/landing/compare/upvoty-desktop.jpg';
import MobileUpvotyImg from '../../public/img/landing/compare/upvoty-mobile.jpg';
import UpvotyImg from '../../public/img/landing/compare/upvoty.png';
import UserbackImg from '../../public/img/landing/compare/userback.png';
import UseResponseImg from '../../public/img/landing/compare/useresponse.png';
import UserReportImg from '../../public/img/landing/compare/userreport.png';
import DesktopUserVoiceImg from '../../public/img/landing/compare/uservoice-desktop.jpg';
import MobileUserVoiceImg from '../../public/img/landing/compare/uservoice-mobile.jpg';
import UserVoiceImg from '../../public/img/landing/compare/uservoice.png';
import { contentScrollApplyStyles, Orientation } from '../common/ContentScroll';
import DeviceContainer, { Device } from '../common/DeviceContainer';
import HoverArea from '../common/HoverArea';
import ImgIso from '../common/ImgIso';
import { vh } from '../common/util/screenUtil';
import { trackingBlock } from '../common/util/trackingDelay';
import windowIso from '../common/windowIso';
import Hero from './landing/Hero';

const PlatformClearFlask = 'clearflask';
const PlatformUserVoice = 'uservoice';
const PlatformCanny = 'canny';
const PlatformUpvoty = 'upvoty';
const PlatformFider = 'fider';
const PlatformHelloNext = 'hellonext';
const PlatformConvas = 'convas';
const PlatformConflux = 'conflux';
const PlatformNolt = 'nolt';
const PlatformSuggested = 'suggested';
const PlatformNoora = 'noora';
const PlatformRoadmapSpace = 'roadmapspace';
const PlatformFeatureUpvote = 'featureupvote';
// Special case for showing other companies
const PlatformOther = 'other';
// Alternative platforms
const PlatformAskNicely = 'asknicely';
const PlatformSimpleFeatureRequests = 'simplefeaturerequests';
const PlatformUserback = 'userback';
const PlatformUserReport = 'userreport';
const PlatformPendo = 'pendo';
const PlatformSalesforceIdeaExchange = 'salesforceideaexchange';
const PlatformAha = 'aha';
const PlatformProductBoard = 'productboard';
const PlatformProdPad = 'prodpad';
const PlatformUseResponse = 'useresponse';
const PlatformShipRight = 'shipright';
const PlatformTrello = 'trello';
const PlatformExcel = 'excel';
const PlatformSheets = 'sheets';

const AlternativePlatforms: { [platformId: string]: AlternativePlatform } = {
  [PlatformAskNicely]: {
    id: PlatformAskNicely,
    name: 'AskNicely',
    logo: AskNicelyImg,
    color: '#a848c1',
    url: 'https://asknicely.com/',
  },
  [PlatformSimpleFeatureRequests]: {
    id: PlatformSimpleFeatureRequests,
    name: 'SimpleFeatureRequests',
    logo: SimpleFeatureRequestsImg,
    color: '#c53656',
    url: 'https://simplefeaturerequests.com/',
  },
  [PlatformUserback]: {
    id: PlatformUserback,
    name: 'Userback',
    logo: UserbackImg,
    color: '#2878f0',
    url: 'https://userback.io/',
  },
  [PlatformUserReport]: {
    id: PlatformUserReport,
    name: 'UserReport',
    logo: UserReportImg,
    color: '#6555ff',
    url: 'https://userreport.com/',
  },
  [PlatformPendo]: {
    id: PlatformPendo,
    name: 'Pendo',
    logo: PendoImg,
    color: '#ec2059',
    url: 'https://pendo.io/',
  },
  [PlatformSalesforceIdeaExchange]: {
    id: PlatformSalesforceIdeaExchange,
    name: 'Salesforce IdeaExchange',
    logo: SalesforceIdeaExchangeImg,
    color: '#00a1e0',
    url: 'https://ideas.salesforce.com/s/about',
  },
  [PlatformAha]: {
    id: PlatformAha,
    name: 'Aha',
    logo: AhaImg,
    color: '#0073cf',
    url: 'https://aha.io/',
  },
  [PlatformProductBoard]: {
    id: PlatformProductBoard,
    name: 'ProductBoard',
    logo: ProductBoardImg,
    color: '#2e73da',
    url: 'https://productboard.com/',
  },
  [PlatformProdPad]: {
    id: PlatformProdPad,
    name: 'ProdPad',
    logo: ProdPadImg,
    color: '#24b4c6',
    url: 'https://prodpad.com/',
  },
  [PlatformUseResponse]: {
    id: PlatformUseResponse,
    name: 'UseResponse',
    logo: UseResponseImg,
    color: '#2b3236',
    url: 'https://useresponse.com/',
  },
  [PlatformShipRight]: {
    id: PlatformShipRight,
    name: 'ShipRight',
    logo: ShipRightImg,
    color: '#226cff',
    url: 'https://shipright.co/',
  },
  [PlatformTrello]: {
    id: PlatformTrello,
    name: 'Trello',
    logo: TrelloImg,
    color: '#0079bf',
    url: 'https://trello.com/',
  },
  [PlatformExcel]: {
    id: PlatformExcel,
    name: 'Microsoft Excel',
    logo: ExcelImg,
    color: '#107c41',
    url: 'https://office.live.com/start/excel.aspx',
  },
  [PlatformSheets]: {
    id: PlatformSheets,
    name: 'Google Sheets',
    logo: SheetsImg,
    color: '#34a853',
    url: 'https://sheets.google.com/',
  },
};

const percTotalUsersAreActive3Months = 0.05;
const percTotalUsersAreActive60Days = 0.05;
const percTotalUsersAreTracked = 0.05;
const euroToUsd = 1.2;

interface PlanPricing {
  basePrice: number;
  baseUsers?: number;
  unitPrice?: number;
  unitUsers?: number;
}
interface AlternativePlatform {
  id: string;
  name: string;
  logo: Img;
  color: string;
  url: string;
}
interface Platform {
  id: string;
  name: string;
  logo: Img;
  color: string;
  url: string;
  desktop: Img;
  mobile: Img;
  pricing: {
    url: string;
    plans: Array<PlanPricing>,
  };
}
const Platforms: { [platformId: string]: Platform } = {
  [PlatformClearFlask]: {
    id: PlatformClearFlask,
    name: 'ClearFlask',
    logo: ClearFlaskImg,
    color: '#218774',
    url: 'https://clearflask.com/',
    desktop: DesktopClearFlaskImg,
    mobile: MobileClearFlaskImg,
    pricing: {
      url: 'https://clearflask.com/pricing',
      plans: [
        { basePrice: 10, baseUsers: 50 / percTotalUsersAreTracked, unitPrice: 10, unitUsers: 50 / percTotalUsersAreTracked },
        { basePrice: 100, baseUsers: 500 / percTotalUsersAreTracked, unitPrice: 50, unitUsers: 500 / percTotalUsersAreTracked },
      ],
    },
  },
  [PlatformUserVoice]: {
    id: PlatformUserVoice,
    name: 'UserVoice',
    logo: UserVoiceImg,
    color: 'rgb(237,112,56)',
    url: 'https://uservoice.com/',
    desktop: DesktopUserVoiceImg,
    mobile: MobileUserVoiceImg,
    pricing: {
      url: 'https://uservoice.com/request-demo',
      plans: [{ basePrice: 1000 }],
    },
  },
  [PlatformCanny]: {
    id: PlatformCanny,
    name: 'Canny',
    logo: CannyImg,
    color: 'rgb(94,98,240)',
    url: 'https://canny.io/',
    desktop: DesktopCannyImg,
    mobile: MobileCannyImg,
    pricing: {
      url: 'https://canny.io/pricing',
      plans: [
        { basePrice: 50, baseUsers: 100 / percTotalUsersAreTracked, unitPrice: 20, unitUsers: 100 / percTotalUsersAreTracked },
        { basePrice: 200, baseUsers: 1000 / percTotalUsersAreTracked, unitPrice: 100, unitUsers: 1000 / percTotalUsersAreTracked },
      ],
    },
  },
  [PlatformFider]: {
    id: PlatformFider,
    name: 'Fider',
    logo: FiderImg,
    color: 'rgb(0,0,0)',
    url: 'https://getfider.com/',
    desktop: DesktopFiderImg,
    mobile: MobileFiderImg,
    pricing: {
      url: 'https://getfider.com/',
      plans: [{ basePrice: 0 }],
    },
  },
  [PlatformNolt]: {
    id: PlatformNolt,
    name: 'Nolt',
    logo: NoltImg,
    color: 'rgb(237,106,102)',
    url: 'https://nolt.io/',
    desktop: DesktopNoltImg,
    mobile: MobileNoltImg,
    pricing: {
      url: 'https://nolt.io/pricing/',
      plans: [{ basePrice: 25 }],
    },
  },
  [PlatformUpvoty]: {
    id: PlatformUpvoty,
    name: 'Upvoty',
    logo: UpvotyImg,
    color: 'rgb(233,134,85)',
    url: 'https://upvoty.com/',
    desktop: DesktopUpvotyImg,
    mobile: MobileUpvotyImg,
    pricing: {
      url: 'https://upvoty.com/pricing/',
      plans: [
        { basePrice: 15, baseUsers: 150 / percTotalUsersAreTracked },
        { basePrice: 25, baseUsers: 1500 / percTotalUsersAreTracked },
        { basePrice: 49 },
      ],
    },
  },
  [PlatformFeatureUpvote]: {
    id: PlatformFeatureUpvote,
    name: 'FeatureUpvote',
    logo: FeatureUpvoteImg,
    color: 'rgb(50,58,70)',
    url: 'https://featureupvote.com/',
    desktop: DesktopFeatureUpvoteImg,
    mobile: MobileFeatureUpvoteImg,
    pricing: {
      url: 'https://featureupvote.com/pricing/',
      plans: [{ basePrice: 99 }],
    },
  },
  [PlatformConvas]: {
    id: PlatformConvas,
    name: 'Convas',
    logo: ConvasImg,
    color: 'rgb(72,166,248)',
    url: 'https://convas.io/',
    desktop: DesktopConvasImg,
    mobile: MobileConvasImg,
    pricing: {
      url: 'https://convas.io/pricing',
      plans: [
        { basePrice: 0, baseUsers: 50 / percTotalUsersAreTracked },
        { basePrice: 15, baseUsers: 100 / percTotalUsersAreTracked, unitPrice: 15, unitUsers: 100 / percTotalUsersAreTracked },
        { basePrice: 150 },
      ],
    },
  },
  [PlatformConflux]: {
    id: PlatformConflux,
    name: 'Conflux',
    logo: ConfluxImg,
    color: 'rgb(81,183,249)',
    url: 'https://getconflux.com/',
    desktop: DesktopConfluxImg,
    mobile: MobileConfluxImg,
    pricing: {
      url: 'https://getconflux.com/pricing',
      plans: [
        { basePrice: 10 * euroToUsd, baseUsers: 50 / percTotalUsersAreActive3Months },
        { basePrice: 50 * euroToUsd, baseUsers: 250 / percTotalUsersAreActive3Months },
        { basePrice: 80 * euroToUsd, baseUsers: 500 / percTotalUsersAreActive3Months },
        { basePrice: 130 * euroToUsd, baseUsers: 1000 / percTotalUsersAreActive3Months },
      ],
    },
  },
  [PlatformHelloNext]: {
    id: PlatformHelloNext,
    name: 'HelloNext',
    logo: HelloNextImg,
    color: 'rgb(10,73,176)',
    url: 'https://hellonext.co/',
    desktop: DesktopHelloNextImg,
    mobile: MobileHelloNextImg,
    pricing: {
      url: 'https://hellonext.co/pricing/#compare-plans',
      plans: [{ basePrice: 50 }],
    },
  },
  [PlatformSuggested]: {
    id: PlatformSuggested,
    name: 'Suggested',
    logo: SuggestedImg,
    color: '#286ffa',
    url: 'https://suggested.co/',
    desktop: DesktopSuggestedImg,
    mobile: MobileSuggestedImg,
    pricing: {
      url: 'https://suggested.co/pricing/',
      plans: [{ basePrice: 50 }],
    },
  },
  [PlatformNoora]: {
    id: PlatformNoora,
    name: 'Noora',
    logo: NooraImg,
    color: 'rgb(234,53,117)',
    url: 'https://noorahq.com/',
    desktop: DesktopNooraImg,
    mobile: MobileNooraImg,
    pricing: {
      url: 'https://noorahq.com/pricing/',
      plans: [{ basePrice: 60 }],
    },
  },
  [PlatformRoadmapSpace]: {
    id: PlatformRoadmapSpace,
    name: 'RoadmapSpace',
    logo: RoadmapSpaceImg,
    color: 'rgb(153,123,247)',
    url: 'https://roadmap.space/',
    desktop: DesktopRoadmapSpaceImg,
    mobile: MobileRoadmapSpaceImg,
    pricing: {
      url: 'https://roadmap.space/plans-pricing/',
      plans: [
        { basePrice: 29, baseUsers: 500 / percTotalUsersAreActive60Days },
        { basePrice: 49, baseUsers: 1500 / percTotalUsersAreActive60Days },
        { basePrice: 99, baseUsers: 3000 / percTotalUsersAreActive60Days },
      ],
    },
  },
};

const dontHoverBelow: Breakpoint = 'sm';
const useStyles = makeStyles((theme: Theme) => createStyles({
  pageContainer: {
    display: 'flex',
    '& h2': {
      margin: theme.spacing(12, 0, 2),
    },
    '& h3': {
      margin: theme.spacing(8, 0, 1),
    },
    '& h4': {
      margin: theme.spacing(4, 0, 0),
    },
    '& p': {
      marginTop: 7,
    },
  },
  appBarSpacer: theme.mixins.toolbar,
  heroBrandList: {
    display: 'flex',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    margin: theme.spacing(2, 0),
  },
  heroBrandListBreak: {
    width: '100%',
  },
  heroBrandImg: {
    maxWidth: 14,
    width: 14,
    maxHeight: 14,
    margin: theme.spacing(1),
  },
  stickyOuterContainer: {
    marginTop: theme.spacing(20),
    minHeight: '100%',
  },
  stickyContainerLeft: {
    marginRight: theme.spacing(6),
  },
  stickyContainerRight: {
    marginLeft: theme.spacing(6),
  },
  stickyContainer: {
    position: 'sticky',
    top: 0,
    maxHeight: vh(100),
    display: 'flex',
    flexDirection: 'column',
  },
  stickyScroll: {
    display: 'flex',
    flexDirection: 'column',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Vertical }),
  },
  competitorSelectReset: {
    alignSelf: 'flex-end',
    margin: theme.spacing(3),
  },
  competitorSelectHeading: {
    margin: theme.spacing(2, 1, 2, 6),
  },
  competitorSelectRow: {
    display: 'flex',
    alignItems: 'center',
  },
  pageContent: {
    minWidth: 0,
    marginBottom: theme.spacing(6),
  },
  emphasize: {
    fontWeight: 'bolder',
  },
  tableHeading: {
    verticalAlign: 'bottom',
    textAlign: 'center',
    [theme.breakpoints.down(dontHoverBelow)]: {
      verticalAlign: 'baseline', // Align the filter icons
    },
  },
  tableDivider: {
    verticalAlign: 'bottom',
    padding: theme.spacing(0, 1),
    '& div': {
      height: theme.spacing(5),
      borderLeft: `1px solid ${
        // From TableCell.js root
        theme.palette.type === 'light'
          ? lighten(fade(theme.palette.divider, 1), 0.88)
          : darken(fade(theme.palette.divider, 1), 0.68)
        }`,
    }
  },
  tableGrouping: {
    textAlign: 'center',
    color: theme.palette.text.hint,
  },
  check: {
    margin: 'auto',
    display: 'block',
    color: theme.palette.primary.main,
  },
  table: {
    maxWidth: '100%',
    width: 'min-content',
    ...contentScrollApplyStyles({ theme, orientation: Orientation.Horizontal }),
  },
  hiddenPlatform: {
    filter: 'grayscale(100%)',
    opacity: 0.4,
  },
  sliderValueHorizontal: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  sliderFloatingInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    position: 'relative',
    transition: theme.transitions.create(['bottom'], {
      duration: theme.transitions.duration.shortest,
      easing: theme.transitions.easing.easeOut,
    }),
    transform: 'translateY(50%)',
    flex: '1',
    overflow: 'visible',
  },
  sliderOuterContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: 400,
    width: 250,
  },
  sliderDisclaimer: {
    marginTop: theme.spacing(1),
    display: 'flex',
    alignItems: 'baseline',
  },
  sliderContainer: {
    flex: '1',
    height: '100%',
    width: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: theme.spacing(4, 0),
  },
  filterButtonAlert: {
    width: 'max-content',
  },
  tocHeading: {
    alignSelf: 'flex-end',
    margin: theme.spacing(2, 3, 2, 2),
  },
  tocIndicator: {
  },
  tocItem: {
    height: 'auto',
    minHeight: 40,
  },
  tocItemRead: {
    opacity: 0.4,
  },
  tocItemIcon: {
    margin: theme.spacing(0, 0, 0, 1),
  },
  tocItemWrapper: {
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
  },
  brandListSelected: {
    '& $brandName': {
      fontWeight: 'bold',
    },
  },
  brandListSmall: {
    margin: theme.spacing(1, 0, 0),
    '& $brandCheckbox': {
      padding: theme.spacing(0.5),
      marginRight: theme.spacing(1),
    },
    '& $brandImg': {
      width: 11,
    },
    '& div': {
      fontSize: '0.8em',
    },
    '& svg': {
      fontSize: 16,
    },
  },
  brandListOther: {
    padding: theme.spacing(0.5, 0, 0, 6),
  },
  brandListContainer: {
    margin: theme.spacing(1, 0, 1, 2),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  transparentTransition: {
    opacity: 1,
    transition: theme.transitions.create('opacity'),
  },
  transparent: {
    opacity: '0!important',
    transition: theme.transitions.create('opacity'),
  },
  brandContainer: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  brandImg: {
    width: 14,
    marginRight: theme.spacing(1),
  },
  brandCheckbox: {
    [theme.breakpoints.down(dontHoverBelow)]: {
      opacity: 0.3,
    },
  },
  brandName: {
    // Used as a ref, don't delete
  },
  platformOther: {
    textAlign: 'center',
    minHeight: 38,
  },
  pricingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flexWrap: 'wrap',
  },
  platformOpenButton: {
    fontSize: '0.9em',
    color: theme.palette.text.hint,
  },
  pricingCell: {
    border: 'none',
  },
  pricingPriceCell: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  priceContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  designContainer: {
    width: '100%',
    maxWidth: 570,
    margin: 'auto',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'flex-end'
  },
  designBrandAndSwitcher: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));

const HiddenPlatformsContext = React.createContext({
  hiddenPlatforms: new Set<string>(),
  toggleHiddenPlatform: (platformId: string) => { },
  setHiddenPlatforms: (platformIds: Set<string>) => { },
});

const Competitors = () => {
  const classes = useStyles();
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));
  const smDown = useMediaQuery(theme.breakpoints.down('sm'));
  const [hiddenPlatforms, setHiddenPlatforms] = useState<Set<string>>(new Set());
  const hiddenPlatformsWrapper = {
    hiddenPlatforms,
    toggleHiddenPlatform: (platformId: string) => {
      if (hiddenPlatforms.has(platformId)) {
        setHiddenPlatforms(new Set<string>([...hiddenPlatforms].filter(id => id !== platformId)))
      } else {
        setHiddenPlatforms(new Set<string>([...hiddenPlatforms, platformId]))
      }
    },
    setHiddenPlatforms,
  };

  const brandListBreaks = new Set([
    1,
    1 + 2,
    1 + 2 + 3,
    1 + 2 + 3 + 4,
    1 + 2 + 3 + 4 + 5,
    1 + 2 + 3 + 4 + 5 + 6,
    1 + 2 + 3 + 4 + 5 + 6 + 7,
  ]);

  return (
    <HiddenPlatformsContext.Provider value={hiddenPlatformsWrapper}>

      <Hero
        title='Customer Feedback Tools comparison'
        description={(
          <>
            There are 30+ tools that we know of in this space that vary by use case, features and price. Let's choose the right tool for your needs.
            <div className={classes.heroBrandList}>
              {[
                ...Object.values(Platforms),
                ...Object.values(AlternativePlatforms),
                Platforms[PlatformClearFlask],
              ].map((platform, index) => (
                <>
                  {brandListBreaks.has(index) && (
                    <div className={classes.heroBrandListBreak} />
                  )}
                  <ImgIso
                    className={classes.heroBrandImg}
                    alt={platform.name}
                    src={platform.logo.src}
                    aspectRatio={platform.logo.aspectRatio}
                    maxWidth={platform.logo.width}
                    maxHeight={platform.logo.height}
                  />
                </>
              ))}
            </div>
          </>
        )}
        image={CompareImg}
      />


      <Container maxWidth='lg' className={classes.pageContainer}>
        {!smDown && (
          <div className={classes.stickyOuterContainer}>
            <div className={classNames(classes.stickyContainer, classes.stickyContainerLeft)}>
              <div className={classes.appBarSpacer} />
              <div className={classes.stickyScroll}>
                <TableOfContents />
              </div>
            </div>
          </div>
        )}
        <div className={classes.pageContent}>
          <Intro />
          <TableOfContentAnchor id='Users'>
            <Volume />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Pricing'>
            <PricingCompare />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Features'>
            <MajorFeatures />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Design'>
            <Design />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Import_Export'>
            <ImportExport />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Customize'>
            <Customize />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Prioritization'>
            <VotingMechanism />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Onboarding'>
            <Onboarding />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Website_health'>
            <PageLoad />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Languages'>
            <Language />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Integrations'>
            <Integrations />
          </TableOfContentAnchor>
          <TableOfContentAnchor id='Alternatives'>
            <OtherAlternatives />
          </TableOfContentAnchor>
          <Disclaimer />
        </div>
        {!xsDown && (
          <div className={classes.stickyOuterContainer}>
            <div className={classNames(classes.stickyContainer, classes.stickyContainerRight)}>
              <div className={classes.appBarSpacer} />
              <div className={classes.stickyScroll}>
                <CompetitorSelect />
              </div>
            </div>
          </div>
        )}
      </Container>
    </HiddenPlatformsContext.Provider>
  );
};

const TableOfContentsAnchors: Array<{ id: string, title: string, icon: OverridableComponent<SvgIconTypeMap> }> = [
  { id: 'Users', title: 'Users', icon: PeopleIcon },
  { id: 'Pricing', title: 'Pricing', icon: PaymentIcon },
  { id: 'Features', title: 'Features', icon: FeaturesIcon },
  { id: 'Design', title: 'Design', icon: DesignIcon },
  { id: 'Import_Export', title: 'Import/Export', icon: ImportExportIcon },
  { id: 'Customize', title: 'Customize', icon: CustomizeIcon },
  { id: 'Prioritization', title: 'Prioritization', icon: AnalyzeIcon },
  { id: 'Onboarding', title: 'Onboarding', icon: SpeakIcon },
  { id: 'Website_health', title: 'Health', icon: SpeedIcon },
  { id: 'Languages', title: 'Languages', icon: TranslateIcon },
  { id: 'Integrations', title: 'Integrations', icon: IntegrationsIcon },
  { id: 'Alternatives', title: 'Alternatives', icon: AlternativesIcon },
];
const TableOfContentAnchor = (props: {
  id: string;
  children: any;
}) => {
  const classes = useStyles();
  return (
    <div id={props.id}>
      <div className={classes.appBarSpacer} />
      {props.children}
    </div>
  );
};

const LinkScroll = (props: {
  anchorId: string;
  children: any;
}) => {
  return (
    <MuiLink
      href={`#${props.anchorId}`}
      underline='none'
      onClick={(e) => {
        e.preventDefault();
        scrollToAnchorId(props.anchorId);
        return false;
      }}
    >
      {props.children}
    </MuiLink>
  );
};
const scrollToAnchorId = (anchorId) => {
  if (windowIso.isSsr) return;
  const el = windowIso.document.getElementById(anchorId);
  if (!el) return;
  windowIso.scrollTo({
    top: el.getBoundingClientRect().top + windowIso.pageYOffset + 10,
    behavior: 'smooth',
  });
};
const TableOfContents = (props: {}) => {
  const classes = useStyles();
  const [anchorId, setAnchorId] = useState<string>();

  var anchorSeen: boolean = !anchorId;

  return (
    <>
      <Typography component='div' variant='h6' className={classes.tocHeading}>Contents</Typography>
      <Scrollspy
        items={TableOfContentsAnchors.map(item => item.id)}
        componentTag='div'
        onUpdate={(el) => { setAnchorId(el?.id); }}
      >
        <Tabs
          orientation='vertical'
          indicatorColor='primary'
          value={anchorId || null}
          classes={{
            indicator: classes.tocIndicator,
          }}
          onChange={(e, newAnchorId) => {
            e.preventDefault();
            scrollToAnchorId(newAnchorId);
            return false;
          }}
        >
          {TableOfContentsAnchors.map(anchor => {
            const Icon = anchor.icon;

            if (!anchorSeen && anchor.id === anchorId) {
              anchorSeen = true;
            }

            return (
              <Tab
                className={classNames(classes.tocItem, !anchorSeen && classes.tocItemRead)}
                classes={{
                  wrapper: classes.tocItemWrapper,
                }}
                key={anchor.id}
                label={anchor.title}
                value={anchor.id}
                icon={(
                  <Icon
                    className={classes.tocItemIcon}
                    fontSize='inherit'
                  />
                )}
              />
            );
          })}
        </Tabs>
      </Scrollspy>
    </>
  );
};

const CompetitorSelect = (props: {}) => {
  const classes = useStyles();
  const { hiddenPlatforms, setHiddenPlatforms } = useContext(HiddenPlatformsContext);

  const rowMapper = isHidden => platform => (
    <HoverArea disableHoverBelow={dontHoverBelow}>
      {(hoverAreaProps, isHovering, isHoverDisabled) => (
        <div key={platform.id} {...hoverAreaProps} className={classNames(classes.competitorSelectRow, isHidden && classes.hiddenPlatform)}>
          <Brand platformId={platform.id} showLogo showCheckbox transparentControls={!(isHovering || isHoverDisabled)} />
          <ExternalLinkPlatform type='home' platform={platform} transparent={!(isHovering || isHoverDisabled)} />
        </div>
      )}
    </HoverArea>
  );

  return (
    <>
      <div>

      </div>
      <Typography component='div' variant='h6' className={classes.competitorSelectHeading}>
        Filter
        &nbsp;<FilterIcon fontSize='inherit' />&nbsp;
      </Typography>
      <div>
        {Object.values(Platforms).filter(platform => !hiddenPlatforms.has(platform.id)).map(rowMapper(false))}
        {Object.values(Platforms).filter(platform => hiddenPlatforms.has(platform.id)).map(rowMapper(true))}
      </div>
      <Button
        className={classes.competitorSelectReset}
        style={{ visibility: hiddenPlatforms.size > 0 ? 'visible' : 'hidden' }}
        onClick={() => setHiddenPlatforms(new Set())}
        size='small'
      >Reset</Button>
    </>
  );
};

const Intro = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>Why do you need feedback?</Typography>
      <p><Typography>So you’ve created a product and now you want to know which area you should focus on.
        A great source of inspiration is your own customers, but the thought of going through the process of gathering, summarizing and prioritizing what your customers want is cumbersome.</Typography></p>
      <p><Typography>This is where customer feedback platforms can help. Most are a drop-in platform you can integrate with your website, app or product to start collecting almost immediately.
      </Typography></p>
      <p><Typography>
        The right tool will not only help in <span className={classes.emphasize}>collecting and grouping ideas</span> together, but also <span className={classes.emphasize}>prioritizing feedback</span> based on customer value or other factors that are important to you.</Typography></p>
      <p><Typography>Your customers will appreciate being involved in your product development and feel their ideas are being heard.</Typography></p>
      <p><Typography>Let's talk about how to choose the right feedback tool for you.</Typography></p>
    </>
  );
};

const Volume = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>
        <PeopleIcon fontSize='inherit' />&nbsp;
        How many users?
      </Typography>
      <p><Typography>The amount of feedback you will receive depends on your current (or predicted) number of customers and how tightly you integrate the feedback tool with your product.</Typography></p>
      <p><Typography>The <span className={classes.emphasize}>coverage rate</span> metric measures the percentage of users that have provided you with feedback. UserVoice <ExternalLink url='https://community.uservoice.com/blog/new-in-uservoice-coverage-rate-reporting/'>reports</ExternalLink> that at least 15% coverage rate is considered satisfactory with typical rate ranging up to 50%. While Canny customers see a typical rate of 5%.</Typography></p>
      <p><Typography>Most platforms can handle collecting large amounts of feedback, but only a handful provide the tools to organize and sort through that feedback afterwards. Typically you will fall under one of the following categories.</Typography></p>

      <Typography component='h3' variant='h5'>High volume</Typography>
      <Typography variant='caption'>{formatNumber(100000)}+ users: Enterprise, B2C, or proven product</Typography>
      <p><Typography>If you have a use case that requires a high-volume of feedback, the answer is simple: request a quote from the following platforms and let the Sales teams guide you.</Typography></p>
      <p><Typography>Your main goal is to find a platform that will analyze your large set of data effectively. UserVoice is the market leader in this space with Canny and ClearFlask as cheaper alternatives.</Typography></p>
      <BrandList
        small
        platformIds={[PlatformUserVoice, PlatformClearFlask, PlatformCanny]}
      />

      <Typography component='h3' variant='h5'>Variable volume</Typography>
      <Typography variant='caption'>Startups or growing product</Typography>
      <p><Typography>Startups or products with growth should look at platforms that can handle high-volume when you need it and provide flexible pricing that scales with you. Beware of unlimited plans. It is typically an indication that the platform has never experienced high-volume and may not be able to handle your future needs.</Typography></p>
      <p><Typography>ClearFlask and Canny are both built for high-volume while only charging you based on your current volume.</Typography></p>
      <BrandList
        small
        platformIds={[PlatformClearFlask, PlatformCanny]}
      />

      <Typography component='h3' variant='h5'>Low volume, multi-project</Typography>
      <Typography variant='caption'>Serial hobbyist</Typography>
      <p><Typography>If you collect feedback across many small separate projects, you don't want to be paying and maintaining separate accounts and billing for each.</Typography></p>
      <p><Typography>At ClearFlask, you can have multiple projects under the same account and you only pay for the combined user count across all of your projects. Convas has a free-tier for projects under 50 users, while Fider is free and open-source for only the cost of hosting and managing your instances.</Typography></p>
      <BrandList
        small
        platformIds={[PlatformClearFlask, PlatformConvas, PlatformFider]}
      />

      <Typography component='h3' variant='h5'>Low volume</Typography>
      <Typography variant='caption'>Up to {formatNumber(1000)} users: Closed group, hobbyist</Typography>
      <p><Typography>For collecting feedback from a small group of users, there are many options available. Keep reading below to find the product based on other factors.</Typography></p>
      <BrandList
        small
        platformIds={Object.keys(Platforms).filter(id => id !== PlatformUserVoice)}
        limit={4}
      />
    </>
  );
};

const sliderMarks = [
  0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
  12000, 14000, 16000, 18000, 20000,
  30000, 40000, 50000, 60000,
];
const PricingCompare = (props: {}) => {
  const classes = useStyles();
  const [markIndex, setMarkIndex] = useState<number>(1);
  return (
    <>
      <Typography component='h2' variant='h4'>
        <PaymentIcon fontSize='inherit' />&nbsp;
        What is your budget?
      </Typography>
      <p><Typography>A naive engineer may see feedback collection a simple functionality. The value of the higher-priced feedback platforms are only visible behind-the-scenes helping you make sense of the data you've collected.</Typography></p>
      <p><Typography>As the complexity of managing feedback increases with volume, many platforms offer flexible pricing based on users.</Typography></p>

      <div className={classes.pricingContainer}>
        <PricingTable totalUsers={sliderMarks[markIndex]} />
        <div>
          <UserCountSlider
            marks={sliderMarks}
            markIndex={markIndex}
            markIndexChanged={setMarkIndex}
            totalUserActiveUserRatio={0.05}
          />
        </div>
      </div>
    </>
  );
};
const getPrice = (platform: Platform, totalUsers: number): { platform: Platform, price: number } => {
  var price: number | undefined;
  for (const plan of platform.pricing.plans) {
    var planPrice = plan.basePrice;
    if (plan.unitPrice && plan.unitUsers) {
      var usersCovered = plan.baseUsers || 0;
      while (usersCovered < totalUsers) {
        usersCovered += plan.unitUsers;
        planPrice += plan.unitPrice;
      }
    } else if (plan.baseUsers && plan.baseUsers < totalUsers) {
      continue;
    }
    if (price !== undefined && price <= planPrice) {
      break;
    }
    price = planPrice;
  }
  return { platform, price: price === undefined ? -1 : price };
};
const PricingTable = (props: {
  totalUsers: number;
}) => {
  const classes = useStyles();
  const { hiddenPlatforms } = useContext(HiddenPlatformsContext);

  const data: Array<{
    platform: Platform,
    price: number,
  }> = Object.values(Platforms).map(platform => getPrice(platform, props.totalUsers)).sort((l, r) =>
    (hiddenPlatforms.has(r.platform.id) ? -1 : 1) - (hiddenPlatforms.has(l.platform.id) ? -1 : 1)
    || (r.price - l.price));

  return (
    <div className={classes.table}>
      <Table size='small'>
        <TableBody>
          {data.map(row => (
            <HoverArea disableHoverBelow={dontHoverBelow}>
              {(hoverAreaProps, isHovering, isHoverDisabled) => (
                <TableRow {...hoverAreaProps} key={row.platform.id} className={classNames(hiddenPlatforms.has(row.platform.id) && classes.hiddenPlatform)}>
                  <TableCell key='platformName' className={classes.pricingCell}>
                    <Brand platformId={row.platform.id} showLogo showCheckbox transparentControls={!(isHovering || isHoverDisabled)} />
                  </TableCell>
                  <TableCell key='price' className={classNames(classes.pricingCell, classes.pricingPriceCell)}>
                    <Price val={row.price} suffix={row.platform.id === PlatformUserVoice ? '+' : undefined} />
                    <ExternalLinkPlatform type='pricing' platform={row.platform} transparent={!(isHovering || isHoverDisabled)} />
                  </TableCell>
                </TableRow>
              )}
            </HoverArea>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
const Price = (props: {
  val: number;
  suffix?: string;
}) => {
  const classes = useStyles();
  if (props.val < 0) return (
    <div className={classes.priceContainer}>
      <Typography component='div' variant='h6'>N/A</Typography>
    </div>
  );
  return (
    <div className={classes.priceContainer}>
      <Typography component='div' variant='subtitle2' color='textSecondary' style={{ alignSelf: 'flex-start' }}>{'$'}</Typography>
      <Typography component='div' variant='h5'>{formatNumber(props.val)}{props.suffix}</Typography>
      <Typography component='div' variant='subtitle2' color='textSecondary'>/&nbsp;mo</Typography>
    </div>
  );
};

// TODO remove dead code; this is a chart of all prices, but it doesn't look good 
// const sliderMarksChart: number[] = [];
// for (var mark = sliderMarks[0]; mark <= sliderMarks[sliderMarks.length - 1]; mark += sliderMarks[1]) {
//   sliderMarksChart.push(mark);
// }
// const pricingChartTransparentPlatforms = new Set([PlatformFider, PlatformNolt, PlatformSuggested, PlatformFeatureUpvote, PlatformNoora, PlatformHelloNext]);
// const PricingChart = (props: {
//   totalUsers: number;
// }) => {
//   const { hiddenPlatforms, toggleHiddenPlatform, setHiddenPlatforms } = useContext(HiddenPlatformsContext);
//   const series = Object.values(Platforms)
//     .filter(platform => !hiddenPlatforms.has(platform.id))
//     .map(platform => {
//       const data: Array<{ x: number, y: number }> = [];
//       for (const mark of sliderMarks) {
//         const price = getPrice(platform, mark);
//         if (price.price >= 0) {
//           data.push({
//             x: mark,
//             y: price.price,
//           });
//         }
//       }
//       return {
//         name: platform.name,
//         color: pricingChartTransparentPlatforms.has(platform.id)
//           ? fade(platform.color, 0.1)
//           : platform.color,
//         data,
//       };
//     });
//   return (
//     Also this would need to be SSR friendly, as in don't SSR
//     <ReactApexChart
//       series={series}
//       options={{
//         tooltip: {
//           x: {
//             formatter: (val) => `${val} total users`,
//           },
//         },
//         grid: {
//         },
//         xaxis: {
//           type: 'numeric',
//           lines: {
//             show: true,
//           },
//         },
//         yaxis: {
//           labels: {
//             formatter: (val) => `$${val}`,
//           },
//         },
//         chart: {
//           type: 'line',
//           height: 350,
//           animations: { enabled: false },
//           toolbar: { show: false },
//         },
//         stroke: {
//           // curve: 'stepline',
//           lineCap: 'butt',
//           curve: 'smooth',
//           width: 2,
//           // dashArray: 5,
//         },
//         legend: { show: false },
//       }}
//       type='line'
//       height={350}
//     />
//   );
// };


const MajorFeatures = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>
        <FeaturesIcon fontSize='inherit' />&nbsp;
        Which features matter to you?
      </Typography>
      <p><Typography>In addition to feedback collection, each platform offers a different set of major functionality.</Typography></p>
      <p><Typography>For niche use cases and for tools where feedback is part of a larger solution, see the <LinkScroll anchorId={'Alternatives'}>Alternatives</LinkScroll>. These include Product Management tools, Customer Relationship Management tools and customer behavior analytics.</Typography></p>

      <Typography><span className={classes.emphasize}>Public Roadmap</span>: Show off your product plan and what you're currently working on.</Typography>
      <Typography><span className={classes.emphasize}>Announcements</span>: Let your users know of recently launched features</Typography>
      <Typography><span className={classes.emphasize}>Knowledge base</span>: Product help articles to describe functionality and address frequent issues</Typography>
      <Typography><span className={classes.emphasize}>Forum</span>: Let your user discuss various topics</Typography>
      <Typography><span className={classes.emphasize}>Blog</span>: Share your thoughts on your own blog and let your users subscribe.</Typography>
      <Typography><span className={classes.emphasize}>Custom content</span>: Flexible content type with custom rules such as Job postings, Employee feedback, Q&amp;A</Typography>

      <ComparisonTable
        headers={[
          { headingId: 'ideas', content: 'Feature voting' },
          { headingId: 'roadmap', content: 'Public Roadmap' },
          { headingId: 'changelog', content: 'Announcements' },
          { headingId: 'knowledge', content: 'Knowledge base' },
          { headingId: 'forum', content: 'Forum' },
          { headingId: 'blog', content: 'Blog' },
          { headingId: 'custom', content: 'Custom content' },
        ]}
        data={[
          { platformId: PlatformClearFlask, headingIds: new Set(['ideas', 'roadmap', 'changelog', 'knowledge', 'forum', 'blog', 'custom']) },
          { platformId: PlatformUserVoice, headingIds: new Set(['ideas', 'roadmap', 'changelog', 'knowledge', 'forum']) },
          { platformId: PlatformNoora, headingIds: new Set(['ideas', 'roadmap', 'changelog', 'knowledge']) },
          { platformId: PlatformConflux, headingIds: new Set(['ideas', 'roadmap', 'changelog', 'forum']) },
          { platformId: PlatformCanny, headingIds: new Set(['ideas', 'roadmap', 'changelog']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['ideas', 'roadmap', 'changelog']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['ideas', 'roadmap', 'changelog']) },
          { platformId: PlatformSuggested, headingIds: new Set(['ideas', 'roadmap', 'changelog']) },
          { platformId: PlatformRoadmapSpace, headingIds: new Set(['ideas', 'roadmap', 'changelog']) },
          { platformId: PlatformConvas, headingIds: new Set(['ideas', 'roadmap']) },
          { platformId: PlatformNolt, headingIds: new Set(['ideas', 'roadmap']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['ideas', 'changelog']) },
          { platformId: PlatformFider, headingIds: new Set(['ideas']) },
        ]}
      />
    </>
  );
};

const VotingMechanism = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h4'>
        <AnalyzeIcon fontSize='inherit' />&nbsp;
        Prioritization of feedback
      </Typography>
      <p><Typography>Most platforms can collect a lot of feedback, while only a few can handle making sense of it all.</Typography></p>
      <p><Typography>To better understand the feedback you collected, you need to consider the value of each of your customers.
        For example, you may want to know which features your highest-paying customers wanted. Or you may want to see what your recently churned customers in your enterprise plan said.</Typography></p>

      <Typography component='h4' variant='h6'>Analyze externally</Typography>
      <p><Typography>One way to accomplish this is to export your data to an external Data Warehouse or analytics tool.
        Correlate feedback with other data you have about your customers.</Typography></p>
      <BrandList small platformIds={[PlatformUserVoice]} />

      <Typography component='h4' variant='h6'>Analyze on-platform (Segmentation)</Typography>
      <p><Typography>Some platforms allow you to attach arbitrary customer data on the platform which allows you to filter, search and assign weights to your customers.</Typography></p>
      <BrandList small platformIds={[PlatformUserVoice, PlatformCanny]} />

      <Typography component='h4' variant='h6'>Credit system / Crowd-funding</Typography>
      <p><Typography>Another approach is to issue credits to your customers based on their value such as monthly spend. Instead of upvotes, they can then spend their credits on the features they want.</Typography></p>
      <BrandList small platformIds={[PlatformClearFlask]} />

      <ComparisonTable
        headers={[
          { headingId: 'up', content: 'Upvote' },
          { headingId: 'down', content: 'Upvote & Downvote' },
          { headingId: 'emoji', content: 'Weighted Emoji' },
          { headingId: 'credit', content: 'Credit System' },
          { headingId: 'fund', content: 'Crowd-funding' },
          { headingId: 'segment', content: 'Segment' },
          { headingId: 'dw', content: 'External DataWarehouse' },
        ]}
        data={[
          { platformId: PlatformUserVoice, headingIds: new Set(['segment', 'up', 'dw']) },
          { platformId: PlatformCanny, headingIds: new Set(['segment', 'up']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['up', 'down', 'emoji', 'credit', 'fund']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['up', 'down']) },
          { platformId: PlatformNolt, headingIds: new Set(['up', 'down']) },
          { platformId: PlatformOther, headingIds: new Set(['up']) },
        ]}
      />
    </>
  );
};

const Onboarding = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>
        <SpeakIcon fontSize='inherit' />&nbsp;
        Engagement channels
      </Typography>
      <p><Typography>The value of feedback is drastically different between a current customer, potential customer, or someone that has no intention in being your customer. One way to ensure that feedback is valuable is to ask to provide a communication channel so they can be notified when their feedback is addressed.</Typography></p>

      <Typography component='h4' variant='h6'>Onboarding friction</Typography>
      <p><Typography>Users are hesitant to provide their personal information including their email address.
        The more personal information you ask will result in less feedback.</Typography></p>
      <p><Typography>If you manage your customer accounts already, <span className={classes.emphasize}>Single Sign-On</span> is the ideal solution as it allows you to seamlessly login your users in the background without ever showing a login screen.</Typography></p>

      <Typography component='h4' variant='h6'>Guest / Anonymous feedback</Typography>
      <p><Typography>Ideal in narrow use cases, allows your users to sign-up without providing any contact information. Use this only as a last resort as it attracts spam and leaves you with no engagement opportunity.</Typography></p>
      <p><Typography><span className={classes.emphasize}>Browser Push Notifications</span> are an alternative where your users don't have to provide their email, but you have a communication channel open.</Typography></p>


      <Typography component='h4' variant='h6'>External service provider</Typography>
      <p><Typography>OAuth and SAML allow you to login with the vast majority of external providers including Facebook, Google, and Github.
        In addition, some platforms have a built-in shared login for specific providers shown below.</Typography></p>

      <ComparisonTable
        headers={[
          { headingId: 'email', content: 'Email' },
          { headingId: 'guest', content: 'Guest' },
          { headingId: 'sso', content: 'SSO' },
          { headingId: 'saml', content: 'SAML' },
          { headingId: 'oauth', content: 'OAuth' },
          { headingId: 'browserpush', content: 'Browser Push' },
          { headingId: 'emaildomain', content: 'Domain Whitelist' },
          { headingId: 'openid', content: 'OpenId' },
          { headingId: 'okta', content: 'Okta' },
          { content: 'Shared' },
          { headingId: 'google', content: 'Google' },
          { headingId: 'fb', content: 'Facebook' },
          { headingId: 'github', content: 'Github' },
          { headingId: 'twitter', content: 'Twitter' },
          { headingId: 'discord', content: 'Discord' },
          { headingId: 'steam', content: 'Steam' },
          { headingId: 'apple', content: 'Apple' },
          { headingId: 'wordpress', content: 'WordPress' },
          { headingId: 'azure', content: 'AzureAD' },
          { headingId: 'gsuite', content: 'GSuite' },
        ]}
        data={[
          { platformId: PlatformUserVoice, headingIds: new Set(['email', 'emaildomain', 'sso', 'saml', 'okta', 'openid', 'fb', 'google']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['guest', 'browserpush', 'email', 'emaildomain', 'sso', 'oauth']) },
          { platformId: PlatformCanny, headingIds: new Set(['email', 'emaildomain', 'sso', 'fb', 'twitter', 'github', 'google', 'azure', 'gsuite']) },
          { platformId: PlatformFider, headingIds: new Set(['email', 'oauth', 'fb', 'github', 'google']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['email', 'saml']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['guest', 'email', 'sso', 'twitter', 'google', 'wordpress']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['guest', 'email', 'sso', 'github', 'google', 'apple']) },
          { platformId: PlatformConflux, headingIds: new Set(['guest', 'email', 'sso', 'fb', 'google', 'discord', 'steam']) },
          { platformId: PlatformSuggested, headingIds: new Set(['guest', 'email', 'sso', 'fb', 'github', 'google']) },
          { platformId: PlatformNolt, headingIds: new Set(['guest', 'email', 'sso', 'twitter', 'google']) },
          { platformId: PlatformNoora, headingIds: new Set(['email', 'sso', 'google']) },
          { platformId: PlatformConvas, headingIds: new Set(['guest', 'email']) },
          { platformId: PlatformRoadmapSpace, headingIds: new Set(['email']) },
        ]}
      />
    </>
  );
};

const ImportExport = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>
        <ImportExportIcon fontSize='inherit' />&nbsp;
        Vendor lock-in: import and export
      </Typography>
      <p><Typography>Whether you are switching from another platform or you eventually will in the future, you need to consider your options now.
        Plan ahead and choose a platform that makes switching easy and prevent locking yourself to a particular platform.</Typography></p>

      <FilterButton
        label='Filter' text='Only show platforms with Export'
        select={false} invertSelection platformIds={new Set([PlatformUserVoice, PlatformCanny, PlatformClearFlask, PlatformUpvoty, PlatformFider, PlatformSuggested, PlatformFeatureUpvote])}
      />

      <Typography component='h4' variant='h6'>Importing data</Typography>
      <p><Typography>For importing <span className={classes.emphasize}>existing feedback</span>, several platforms allow you to import CSV formatted data. You can also reach out to support to get additional help.</Typography></p>
      <FilterButton
        label='Filter' text='Only show platforms with CSV Import'
        select={false} invertSelection platformIds={new Set([PlatformUserVoice, PlatformCanny, PlatformClearFlask, PlatformNoora])}
      />
      <p><Typography>For synchronizing <span className={classes.emphasize}>customer traits</span> for feedback analysis, there are several <LinkScroll anchorId={'Integrations'}>integrations</LinkScroll> available as well as APIs.</Typography></p>
      <p><Typography>For <span className={classes.emphasize}>signing in</span> your users with an existing account, there are <LinkScroll anchorId={'Onboarding'}>onboarding</LinkScroll> options available including Single Sign-On.</Typography></p>


      <ComparisonTable
        tableStyle={{ width: 'max-content' }}
        headers={[
          { content: 'Self-service' },
          { headingId: 'import', content: 'Import' },
          { headingId: 'export', content: 'Export' },
        ]}
        data={[
          { platformId: PlatformUserVoice, headingIds: new Set(['import', 'export']) },
          { platformId: PlatformCanny, headingIds: new Set(['import', 'export']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['import', 'export']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['export']) },
          { platformId: PlatformFider, headingIds: new Set(['export']) },
          { platformId: PlatformSuggested, headingIds: new Set(['export']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['export']) },
          { platformId: PlatformNoora, headingIds: new Set(['import']) },
          { platformId: PlatformOther, headingIds: new Set([]) },
        ]}
      />
    </>
  );
};

const Language = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h4'>
        <TranslateIcon fontSize='inherit' />&nbsp;
        Language support
      </Typography>
      <p><Typography>If a majority of your customers speak a certain language, consider using a platform that supports that language natively or allows you to bring your own translations.</Typography></p>
      <p><Typography>For translating user-submitted feedback to other languages, UserVoice supports on-page translation to any langauge using Google Translate</Typography></p>

      <ComparisonTable
        headers={[
          { headingId: 'contribute', content: 'Contribute translation' },
          { headingId: 'google', content: 'Google Translate' },
          { content: 'Languages' },
          { headingId: 'English', content: 'English' },
          { headingId: 'Arabic', content: 'Arabic' },
          { headingId: 'Bulgarian', content: 'Bulgarian' },
          { headingId: 'Catalan', content: 'Catalan' },
          { headingId: 'Chinese', content: 'Chinese' },
          { headingId: 'Czechia', content: 'Czechia' },
          { headingId: 'Danish', content: 'Danish' },
          { headingId: 'Dutch', content: 'Dutch' },
          { headingId: 'Estonian', content: 'Estonian' },
          { headingId: 'Finnish', content: 'Finnish' },
          { headingId: 'French', content: 'French' },
          { headingId: 'German', content: 'German' },
          { headingId: 'Hebrew', content: 'Hebrew' },
          { headingId: 'Hungarian', content: 'Hungarian' },
          { headingId: 'Icelandic', content: 'Icelandic' },
          { headingId: 'Indonesian', content: 'Indonesian' },
          { headingId: 'Italian', content: 'Italian' },
          { headingId: 'Japanese', content: 'Japanese' },
          { headingId: 'Korean', content: 'Korean' },
          { headingId: 'Mongolian', content: 'Mongolian' },
          { headingId: 'Norwegian', content: 'Norwegian' },
          { headingId: 'Persian', content: 'Persian' },
          { headingId: 'Polish', content: 'Polish' },
          { headingId: 'Portuguese', content: 'Portuguese' },
          { headingId: 'Russian', content: 'Russian' },
          { headingId: 'Serbian', content: 'Serbian' },
          { headingId: 'Slovak', content: 'Slovak' },
          { headingId: 'Spanish', content: 'Spanish' },
          { headingId: 'Swedish', content: 'Swedish' },
          { headingId: 'Turkish', content: 'Turkish' },
          { headingId: 'Vietnamese', content: 'Vietnamese' },
        ]}
        data={[
          { platformId: PlatformUserVoice, headingIds: new Set(['google', 'contribute', 'English', 'Bulgarian', 'Catalan', 'Dutch', 'French', 'German', 'Serbian', 'Spanish', 'Turkish', 'Vietnamese']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['contribute', 'English', 'Czechia', 'Danish', 'Dutch', 'Finnish', 'French', 'German', 'Hebrew', 'Icelandic', 'Italian', 'Japanese', 'Norwegian', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Swedish', 'Turkish']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['contribute', 'English', 'Mongolian', 'Slovak']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['English', 'Arabic', 'Chinese', 'Danish', 'Dutch', 'Finnish', 'French', 'German', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Norwegian', 'Polish', 'Portuguese', 'Russian', 'Slovak', 'Spanish', 'Swedish', 'Turkish']) },
          { platformId: PlatformNolt, headingIds: new Set(['English', 'Arabic', 'Danish', 'Dutch', 'Estonian', 'French', 'German', 'Hungarian', 'Italian', 'Norwegian', 'Persian', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Turkish', 'Vietnamese']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['English', 'Chinese', 'French', 'German', 'Korean', 'Portuguese', 'Russian', 'Spanish']) },
          { platformId: PlatformOther, headingIds: new Set(['English']) },
        ]}
      />
    </>
  );
};

const Integrations = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h4'>
        <IntegrationsIcon fontSize='inherit' />&nbsp;
        Integrations
      </Typography>
      <p><Typography>If you are already using existing tools that you want to integrate, take a look at what each platform supports.</Typography></p>

      <ComparisonTable
        headers={[
          { content: 'API' },
          { headingId: 'API', content: 'API' },
          { headingId: 'Zapier', content: 'Zapier' },
          { content: 'Analytics' },
          { headingId: 'GoogleAnalytics', content: 'GAnalytics' },
          { headingId: 'Hotjar', content: 'Hotjar' },
          { headingId: 'FullStory', content: 'FullStory' },
          { headingId: 'Fivetran', content: 'Fivetran' },
          { content: 'Collect' },
          { headingId: 'Mobile', content: 'Mobile' },
          { headingId: 'Chrome', content: 'Chrome Extension' },
          { headingId: 'Firefox', content: 'Firefox Extension' },
          { headingId: 'MacApp', content: 'Mac app' },
          { headingId: 'Intercom', content: 'Intercom' },
          { headingId: 'Wordpress', content: 'Wordpress' },
          { content: 'Sync' },
          { headingId: 'Slack', content: 'Slack' },
          { headingId: 'MsftTeams', content: 'Microsoft Teams' },
          { headingId: 'Jira', content: 'Jira' },
          { headingId: 'Zendesk', content: 'Zendesk' },
          { headingId: 'Github', content: 'Github' },
          { headingId: 'Trello', content: 'Trello' },
          { headingId: 'Freshdesk', content: 'Freshdesk' },
          { headingId: 'Gainsight', content: 'Gainsight' },
          { headingId: 'AzureDevOps', content: 'Azure DevOps' },
          { headingId: 'Groove', content: 'Groove' },
          { headingId: 'PivotalTracker', content: 'Pivotal Tracker' },
          { headingId: 'Teamwork', content: 'Teamwork' },
          { content: 'Segment' },
          { headingId: 'Stripe', content: 'Stripe' },
          { headingId: 'Salesforce', content: 'Salesforce' },
          { headingId: 'Segment', content: 'Segment' },
          { content: 'Auth' },
          { headingId: 'Okta', content: 'Okta' },
          { headingId: 'OneLogin', content: 'OneLogin' },
          { headingId: 'Patreon', content: 'Patreon' },

        ]}
        data={[
          { platformId: PlatformRoadmapSpace, headingIds: new Set(['API', 'Zapier', 'GoogleAnalytics', 'Chrome', 'Firefox', 'Slack', 'Intercom', 'Wordpress', 'Jira', 'Zendesk', 'Github', 'Trello', 'Freshdesk', 'Groove', 'PivotalTracker', 'Teamwork', 'Salesforce']) },
          { platformId: PlatformUserVoice, headingIds: new Set(['API', 'GoogleAnalytics', 'FullStory', 'Fivetran', 'Slack', 'Mobile', 'MsftTeams', 'Jira', 'Zendesk', 'Gainsight', 'AzureDevOps', 'Salesforce', 'Okta', 'OneLogin']) },
          { platformId: PlatformCanny, headingIds: new Set(['API', 'Zapier', 'GoogleAnalytics', 'Slack', 'MsftTeams', 'Intercom', 'Jira', 'Zendesk', 'Github', 'Salesforce', 'Segment', 'Okta', 'OneLogin']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['Zapier', 'GoogleAnalytics', 'FullStory', 'Chrome', 'Firefox', 'MacApp', 'Slack', 'Intercom']) },
          { platformId: PlatformNoora, headingIds: new Set(['Zapier', 'Chrome', 'Slack', 'Intercom', 'Jira', 'Segment']) },
          { platformId: PlatformConflux, headingIds: new Set(['Zapier', 'Chrome', 'Slack', 'Jira', 'Stripe']) },
          { platformId: PlatformNolt, headingIds: new Set(['GoogleAnalytics', 'Slack', 'Jira', 'Github', 'Trello']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['Zapier', 'Slack', 'Intercom', 'Jira', 'Patreon']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['GoogleAnalytics', 'Slack', 'Jira']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['API', 'GoogleAnalytics', 'Hotjar']) },
          { platformId: PlatformSuggested, headingIds: new Set(['Zapier', 'Slack', 'Intercom']) },
          { platformId: PlatformFider, headingIds: new Set(['API']) },
          { platformId: PlatformConvas, headingIds: new Set([]) },
        ]}
      />
    </>
  );
};

const PageLoad = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h4'>
        <SpeedIcon fontSize='inherit' />&nbsp;
        Website health
      </Typography>
      <p><Typography>Bloated and slow websites are a silent killer in User Experience. You may want to drop platforms from consideration that do not care about their website performance.</Typography></p>

      <p><Typography>
        Good standard metrics of a healthy website are <ExternalLink url='https://web.dev/lcp/'>Largest Contentful Paint</ExternalLink> and <ExternalLink url='https://web.dev/cls/'>Cumulative Layout Shift</ExternalLink>.
        These web vitals can quantify the user experience as well as improve Search Engine Optimization.
        We have analyzed each platform using their mobile-version of their feedback page using Google's <ExternalLink url='https://developers.google.com/speed/pagespeed/insights/'>PageSpeed Insights</ExternalLink> tool.
      </Typography></p>

      <Typography component='h4' variant='h6'>Largest Contentful Paint (LCP)</Typography>
      <p><Typography>There are different strategies to determine when a page is considered to be loaded for measuring page load time. Researchers have found that across many websites, the more accurate way to determine when page is loaded is when majority of the page has been rendered. LCP is a web vital measuring exactly this.</Typography></p>

      <Typography component='h4' variant='h6'>Cumulative Layout Shift (CLS)</Typography>
      <p><Typography>Unexpected movement of page content can cause mild annoyance to accidentally clicking the wrong button. Cumulative Layout Shift is a web vital measuring how much has content shifted around from its original place.</Typography></p>

      <Typography component='h4' variant='h6'>No JavaScript support</Typography>
      <p><Typography>A website able to render without any JavaScript is an important consideration.
        Typically pre-rendered websites load faster, better support for older web browsers, and play a big role in Search Engine Optimization</Typography></p>
      <FilterButton
        label='Filter' text='Only show platforms supporting NoJS' showExamples={0}
        select={false} invertSelection platformIds={new Set([PlatformClearFlask, PlatformNolt, PlatformFeatureUpvote, PlatformUpvoty, PlatformHelloNext, PlatformConvas, PlatformCanny, PlatformUserVoice])}
      />

      <ComparisonTable
        tableStyle={{ width: 'max-content' }}
        headers={[
          { headingId: 'paint', content: 'Page load (LCP)', customContent: true },
          { headingId: 'pageshift', content: 'Page shift (CLS)', customContent: true },
          // { headingId: 'score', content: 'Score', customContent: true },
          { headingId: 'nojs', content: 'No JS support' },
        ]}
        data={[
          { platformId: PlatformClearFlask, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={2.6} />), score: (<PageLoadSpeed val={51} />), pageshift: (<PageLoadLayoutShift val={0.005} />) } },
          { platformId: PlatformNolt, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={2.9} />), score: (<PageLoadSpeed val={58} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={2.9} />), score: (<PageLoadSpeed val={74} />), pageshift: (<PageLoadLayoutShift val={0.002} />) } },
          { platformId: PlatformFider, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={3.2} />), score: (<PageLoadSpeed val={62} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformRoadmapSpace, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={5.4} />), score: (<PageLoadSpeed val={26} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformUpvoty, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={5.6} />), score: (<PageLoadSpeed val={51} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformHelloNext, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={6.4} />), score: (<PageLoadSpeed val={42} />), pageshift: (<PageLoadLayoutShift val={0.084} />) } },
          { platformId: PlatformConvas, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={7.2} />), score: (<PageLoadSpeed val={21} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformCanny, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={8.2} />), score: (<PageLoadSpeed val={41} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformSuggested, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={8.4} />), score: (<PageLoadSpeed val={39} />), pageshift: (<PageLoadLayoutShift val={0.074} />) } },
          { platformId: PlatformNoora, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={9.1} />), score: (<PageLoadSpeed val={11} />), pageshift: (<PageLoadLayoutShift val={0.129} />) } },
          { platformId: PlatformConflux, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={9.4} />), score: (<PageLoadSpeed val={30} />), pageshift: (<PageLoadLayoutShift val={0.706} />) } },
          { platformId: PlatformUserVoice, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={11.0} />), score: (<PageLoadSpeed val={15} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
        ]}
      />
      <p><Typography variant='caption'>Each platform's own feedback page was analyzed using Google's online tool "PageSpeed Insights". As majority of browsing is on mobile, both LCP and CLS reflect mobile results.</Typography></p>
    </>
  );
};
const PageLoadSeconds = (props: { val: number }) => {
  return (
    <div style={{ textAlign: 'end', color: `rgb(${Math.max(0, (props.val - 2) * 50)},0,0)` }}>
      {props.val.toFixed(1)}&nbsp;sec
    </div>
  );
};
const PageLoadSpeed = (props: { val: number }) => {
  return (
    <div style={{ textAlign: 'center', color: `rgb(${Math.max(0, 100 - props.val)},0,0)` }}>
      {props.val}%
    </div>
  );
};
const PageLoadLayoutShift = (props: { val: number }) => {
  return (
    <div style={{ textAlign: 'center', color: `rgb(${Math.max(0, props.val * 1000)},0,0)` }}>
      {props.val.toFixed(3)}
    </div>
  );
};

const Disclaimer = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h6'>Disclaimer</Typography>
      <p><Typography variant='body2'>If your tool is not listed here or you found a mistake, please <Link to='/contact/general'>contact</Link> us.</Typography></p>
      <p><Typography variant='body2'>Our mission is to highlight each platform's strengths and weaknesses. However, the information contained in this article represents the views and opinions of our researcher and may not reflect reality.</Typography></p>
    </>
  );
};

const Design = (props: {}) => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [deviceNoDefault, setDevice] = useState<Device | undefined>();
  const [hoverId, setHoverId] = useState<string>();
  const [clickedId, setClickedId] = useState<string>(PlatformClearFlask);
  const device = deviceNoDefault || (isMobile ? Device.Mobile : Device.Desktop);

  const selectedId = hoverId || clickedId;
  const selectedPlatform = Platforms[selectedId];
  const img = device === Device.Desktop ? selectedPlatform.desktop : selectedPlatform.mobile;

  return (
    <>
      <Typography component='h2' variant='h4'>
        <DesignIcon fontSize='inherit' />&nbsp;
        Look &amp; feel
      </Typography>
      <p><Typography>If your plan is to match your website design (whitelabel), there are a few options that will allow you to fully customize every aspect of the site.</Typography></p>
      <BrandList small platformIds={[PlatformUserVoice, PlatformClearFlask]} />
      <p><Typography>Otherwise choose a platform that you find pleasing or one that matches your design the closest. </Typography></p>

      <div className={classes.designContainer}>
        <div>
          <div className={classes.designBrandAndSwitcher}>
            <Brand platform={selectedPlatform} showLogo />
            <IconButton
              color='inherit'
              onClick={() => setDevice(device === Device.Desktop ? Device.Mobile : Device.Desktop)}
            >
              <MobileDesktopIcon
                fontSize='small'
                color='inherit'
              />
            </IconButton>
          </div>
          <div style={{ width: device === Device.Desktop ? 444 : 256 }}>
            <DeviceContainer device={device}>
              <ImgIso
                alt='Preview'
                src={img.src}
                aspectRatio={img.aspectRatio}
                maxWidth={img.width}
                maxHeight={img.height}
              />
            </DeviceContainer>
          </div>
        </div>
        <BrandList
          small
          platformIds={Object.keys(Platforms)}
          selected={clickedId}
          BrandProps={{ showCheckbox: false }}
          onClick={setClickedId}
          onHover={(id, isHovering) => {
            if (!isHovering && id === hoverId) {
              setHoverId(undefined);
            } else if (isHovering) {
              setHoverId(id);
            }
          }}
        />
      </div>
    </>
  );
};

const Customize = (props: {}) => {
  const classes = useStyles();
  return (
    <>
      <Typography component='h2' variant='h4'>
        <CustomizeIcon fontSize='inherit' />&nbsp;
        Customization
      </Typography>
      <p><Typography>Some tools are perfected and focused on a specific use-case (ie Canny, Nolt, FeatureUpvote) while others are feature-rich for general purpose (ie ClearFlask, UserVoice). If you cannot find the right tool, customize one to fit your needs.</Typography></p>

      <Typography component='h4' variant='h6'>Open-source</Typography>
      <p><Typography>if you got the time, open-source gives you freedom for a custom solution and complete ownership.
        The only contenders are Fider (AGPLv3) and ClearFlask (Apache 2.0).
        While Fider is lacking analytic features and scalable infrastructure, it is ideal for small to medium volume.
        Whereas ClearFlask can be deployed either via a PostgreSQL DB for small deployments or a scalable deployment with DynamoDB, ElasticSearch, S3, Load balancing and CloudFront</Typography></p>
      <BrandList small platformIds={[PlatformClearFlask, PlatformFider]} />

      <Typography component='h4' variant='h6'>Whitelabel</Typography>
      <p><Typography>For optimal user experience, your customer should not sense they are leaving your website and using another platform for feedback.
        The look and feel of the feedback platform must be customizable to match your design.
        Create and organize pages with custom content with UserVoice and ClearFlask.</Typography></p>
      <BrandList small platformIds={[PlatformUserVoice, PlatformClearFlask]} />

      <Typography component='h4' variant='h6'>Workflow</Typography>
      <p><Typography>Create categories, tags and statuses to organize your feedback.
        Create custom behavior for each status and define a state machine to match your development workflow.
      </Typography></p>
      <BrandList small platformIds={[PlatformClearFlask, PlatformUserVoice]} />

      <Typography component='h4' variant='h6'>Custom content type</Typography>
      <p><Typography>ClearFlask is built to handle custom content types.
        There are pre-made templates ready to use for feedback, announcements, knowledge base, and blog articles.</Typography></p>
      <p><Typography>You can create your own content types to match your needs such as <span className={classes.emphasize}>Job postings</span>, <span className={classes.emphasize}>Employee feedback</span>, <span className={classes.emphasize}>Q&amp;A</span>.
        Create new pages and customize the menu for a custom experience.</Typography></p>
      <BrandList small platformIds={[PlatformClearFlask]} />

      <ComparisonTable
        headers={[
          { headingId: 'open-source', content: 'Open Source' },
          { headingId: 'custom-content', content: 'Custom content' },
          { content: 'Workflow' },
          { headingId: 'tag', content: 'Add/Remove Tags' },
          // { headingId: 'rename-status', content: 'Rename statuses' },
          { headingId: 'custom-status', content: 'Add/Remove Statuses' },
          { content: 'Whitelabel' },
          { headingId: 'custom-domain', content: 'Own domain' },
          // { headingId: 'widget', content: 'Widget' },
          { headingId: 'color', content: 'Color scheme' },
          { headingId: 'css', content: 'Inject CSS' },
          { headingId: 'poweredby', content: 'Remove PoweredBy' },
          // { headingId: 'rename-pages', content: 'Rename pages' },
          { headingId: 'custom-pages', content: 'Custom pages' },
          { headingId: 'custom-html', content: 'Custom HTML' },
        ]}
        data={[
          { platformId: PlatformFider, headingIds: new Set(['open-source', 'custom-domain', 'color', 'tag', 'css', 'poweredby']) },
          { platformId: PlatformClearFlask, headingIds: new Set(['open-source', 'custom-content', 'custom-domain', 'widget', 'color', 'tag', 'rename-status', 'custom-status', 'rename-pages', 'custom-pages', 'custom-html', 'css', 'poweredby']) },
          { platformId: PlatformUserVoice, headingIds: new Set(['custom-domain', 'widget', 'color', 'tag', 'rename-status', 'custom-status', 'rename-pages', 'custom-pages', 'custom-html', 'css', 'poweredby']) },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['custom-domain', 'widget', 'color', 'tag', 'rename-status', 'custom-status', 'rename-pages', 'css', 'poweredby']) },
          { platformId: PlatformUpvoty, headingIds: new Set(['custom-domain', 'widget', 'color', 'rename-status', 'rename-pages', 'css', 'poweredby']) },
          { platformId: PlatformRoadmapSpace, headingIds: new Set(['custom-domain', 'widget', 'color', 'tag', 'rename-pages', 'css']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['custom-domain', 'widget', 'color', 'rename-status', 'rename-pages']) },
          { platformId: PlatformCanny, headingIds: new Set(['custom-domain', 'widget', 'color', 'tag', 'rename-pages', 'poweredby']) },
          { platformId: PlatformNolt, headingIds: new Set(['custom-domain', 'widget', 'color', 'rename-pages']) },
          { platformId: PlatformSuggested, headingIds: new Set(['custom-domain', 'color', 'rename-pages', 'poweredby']) },
          { platformId: PlatformNoora, headingIds: new Set(['custom-domain', 'color', 'tag', 'rename-status', 'custom-status']) },
          { platformId: PlatformConflux, headingIds: new Set(['custom-domain', 'tag', 'rename-status', 'custom-status']) },
          { platformId: PlatformConvas, headingIds: new Set(['custom-domain', 'widget']) },
        ]}
      />
    </>
  );
};

const OtherAlternatives = (props: {}) => {
  return (
    <>
      <Typography component='h2' variant='h4'>
        <AlternativesIcon fontSize='inherit' />&nbsp;
        Niche alternatives
      </Typography>
      <p><Typography>We have covered many customer feedback platforms, but there are many more we have not. Take a look at other types of platforms that may suit your particular use case.</Typography></p>

      <Typography component='h3' variant='h5'>Customer-driven product management</Typography>
      <p><Typography>Product Management tools with user feedback as part of their solution.
        These solutions are intended for product managers to brainstorm and prioritize features with customer feedback as a source of ideas.</Typography></p>
      <div><Brand showLogo showLink platformId={PlatformAha} /></div>
      <div><Brand showLogo showLink platformId={PlatformProdPad} /></div>
      <div><Brand showLogo showLink platformId={PlatformProductBoard} /></div>

      <Typography component='h3' variant='h5'>Customer Relationship Management (CRM)</Typography>
      <p><Typography>A CRM compiles data from multiple sources to keep track of customers and leads. It allows businesses to learn more about their target audiences and how to best cater for their needs.</Typography></p>
      <p><Typography>Salesforce is a leading customer management tool that includes a subproduct IdeaExchange for collecting and prioritizing ideas with a roadmap. While UseResponse is a simpler CRM tool with feedback, helpdesk, knowledge base, and a live Chat.</Typography></p>
      <div><Brand showLogo showLink platformId={PlatformSalesforceIdeaExchange} /></div>
      <div><Brand showLogo showLink platformId={PlatformUseResponse} /></div>

      <Typography component='h3' variant='h5'>Customer behavior and guidance</Typography>
      <p><Typography>Behavioral analytics tool to better understand and optimize customer experience through their product journey with feedback, surveys and walkthroughs.</Typography></p>
      <div><Brand showLogo showLink platformId={PlatformPendo} /></div>

      <Typography component='h3' variant='h5'>Crowd-funding features</Typography>
      <p><Typography>Let your customers purchase support or feature development. Issue credits when a customer makes a purchase or a donation and let them spend it on what they need.</Typography></p>
      <Brand showLogo platformId={PlatformClearFlask} />

      <Typography component='h3' variant='h5'>Feedback for frontline workers</Typography>
      <p><Typography>Coach, motivate, and empower your frontline workers to improve customer experience.</Typography></p>
      <Brand showLogo showLink platformId={PlatformAskNicely} />

      <Typography component='h3' variant='h5'>Website bug report widget</Typography>
      <p><Typography>Get visual feedback on any web page by letting your users take screenshots and comment on specific parts of your website.</Typography></p>
      <Brand showLogo showLink platformId={PlatformUserback} />

      <Typography component='h3' variant='h5'>Quick and Free Public Roadmaps</Typography>
      <Typography component='h4' variant='h6'>Kanban board</Typography>
      <p><Typography>Display what you are working on by making your Kanban board public.</Typography></p>
      <Brand showLogo showLink platformId={PlatformTrello} />
      <Typography component='h4' variant='h6'>Spreadsheet</Typography>
      <p><Typography>Easily show off a roadmap on a cloud-based public spreadsheet.</Typography></p>
      <div><Brand showLogo showLink platformId={PlatformSheets} /></div>
      <div><Brand showLogo showLink platformId={PlatformExcel} /></div>

      <Typography component='h3' variant='h5'>WordPress plugin</Typography>
      <p><Typography>Collect feedback and show a public roadmap using your existing WordPress website</Typography></p>
      <Brand showLogo showLink platformId={PlatformSimpleFeatureRequests} />

      <Typography component='h3' variant='h5'>Mobile-first feedback widget</Typography>
      <p><Typography>A survey and feedback widget embedded within your mobile app.</Typography></p>
      <div><Brand showLogo showLink platformId={PlatformUserReport} /></div>

      <Typography component='h3' variant='h5'>Feedback and Roadmap without public voting</Typography>
      <p><Typography>Platform for a public roadmap and feedback collection with a caveat: feedback is not publicly accessible unless approved by you.
        Their ideology is strongly <ExternalLink url='https://www.shipright.co/post/feature-voting-board-messing-up-your-product'>against</ExternalLink> public voting tools as it can lead to implementing the wrong features.
        Ideal for smaller teams able to sift through all feedback.</Typography></p>
      <Brand showLogo showLink platformId={PlatformShipRight} />

    </>
  );
};

const ComparisonTable = (props: {
  tableStyle?: any;
  headers: Array<{
    headingId?: string;
    content: React.ReactNode;
    customContent?: boolean;
  }>;
  data: Array<{
    platformId: string;
    headingIds: Set<string>;
    customContentByHeadingId?: { [headingId: string]: any };
  }>;
}) => {
  const classes = useStyles();
  const { hiddenPlatforms } = useContext(HiddenPlatformsContext);

  const rowMapper = isHidden => row => (
    <HoverArea disableHoverBelow={dontHoverBelow}>
      {(hoverAreaProps, isHovering, isHoverDisabled) => (
        <TableRow {...hoverAreaProps} key={row.platformId} className={classNames(isHidden && classes.hiddenPlatform)}>
          <TableCell key='platformName'><Brand platformId={row.platformId} showLogo showCheckbox transparentControls={!(isHovering || isHoverDisabled)} /></TableCell>
          {props.headers.map(header => {
            if (!header.headingId) {
              return (
                <>
                  <TableCell key={`divider-${header.headingId}`} className={classes.tableDivider}></TableCell>
                  <TableCell key={`grouping-${header.headingId}`}></TableCell>
                </>
              );
            }

            if (!!header.customContent) {
              return (
                <TableCell key={header.headingId}>
                  {row.customContentByHeadingId[header.headingId]}
                </TableCell>
              );
            }

            return (
              <TableCell key={header.headingId}>
                {row.headingIds.has(header.headingId) ? (
                  <CheckIcon titleAccess='Yes' color='inherit' fontSize='inherit' className={classes.check} />
                ) : (
                  null
                )}
              </TableCell>
            );
          })}
        </TableRow>
      )}
    </HoverArea>
  );

  return (
    <div className={classes.table} style={props.tableStyle}>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell key='platformName'></TableCell>
            {props.headers.map(header => {
              if (!header.headingId) {
                return (
                  <>
                    <TableCell key={`divider-${header.headingId}`} className={classes.tableDivider}><div /></TableCell>
                    <TableCell key={`grouping-${header.headingId}`} className={classNames(classes.tableHeading, classes.tableGrouping)}>{header.content}</TableCell>
                  </>
                );
              }

              if (!!header.customContent) {
                return (
                  <TableCell key={header.headingId} className={classes.tableHeading}>
                    {header.content}
                  </TableCell>
                );
              }

              const headingId = header.headingId!;
              var otherSeen = false;
              const platformIds = new Set(props.data.filter(row => {
                const isChecked = row.headingIds.has(headingId);
                if (row.platformId === PlatformOther) {
                  otherSeen = otherSeen || isChecked;
                  return false;
                } else {
                  return isChecked;
                }
              }).map(row => row.platformId));

              // Take care of PlatformOther here
              if (otherSeen) {
                const dataPlatformIds = new Set(props.data.map(row => row.platformId));
                Object.keys(Platforms).filter(id => !dataPlatformIds.has(id))
                  .forEach(id => platformIds.add(id));
              }

              return (
                <HoverArea disableHoverBelow={dontHoverBelow}>
                  {(hoverAreaProps, isHovering, isHoverDisabled) => {
                    return (
                      <TableCell {...hoverAreaProps} key={headingId} className={classes.tableHeading}>
                        <div>
                          <FilterIconButton
                            iconClassName={classNames(classes.transparentTransition, !(isHovering || isHoverDisabled) && classes.transparent)}
                            select={false}
                            platformIds={platformIds}
                            invertSelection
                          />
                        </div>
                        {header.content}
                      </TableCell>
                    );
                  }}
                </HoverArea>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {props.data.filter(row => !hiddenPlatforms.has(row.platformId)).map(rowMapper(false))}
          {props.data.filter(row => hiddenPlatforms.has(row.platformId)).map(rowMapper(true))}
        </TableBody>
      </Table>
    </div>
  );
};


const formatNumber = (val: number): string => {
  return val.toLocaleString('en-US');
}

const UserCountSlider = (props: {
  marks: Array<number>;
  totalUserActiveUserRatio: number;
  markIndex: number;
  markIndexChanged: (index: number) => void;
}) => {
  const classes = useStyles();
  const min = 0;
  const max = props.marks.length - 1;
  const bottom = `${props.markIndex / (max - min) * 100}%`;
  return (
    <div className={classes.sliderOuterContainer}>
      <div className={classes.sliderContainer}>
        <div className={classes.sliderFloatingInfo} style={{ bottom }}>
          <div className={classes.sliderValueHorizontal}>
            <Typography variant='h6' component='div'>{formatNumber(props.marks[props.markIndex])}</Typography>
          </div>
          <div className={classes.sliderValueHorizontal}>
            <Typography variant='caption' component='div'>Total users</Typography>
          </div>
        </div>
        <Slider
          value={props.markIndex}
          min={min}
          step={1}
          orientation='vertical'
          max={max}
          onChange={(e, val) => props.markIndexChanged(val as any as number)}
        />
        <div className={classes.sliderFloatingInfo} style={{ bottom }}>
          <div className={classes.sliderValueHorizontal}>
            <Typography variant='h6' component='div'>{formatNumber(props.marks[props.markIndex] * props.totalUserActiveUserRatio)}</Typography>
          </div>
          <div className={classes.sliderValueHorizontal}>
            <Typography variant='caption' component='div'>Active users *</Typography>
          </div>
        </div>
      </div>
      <div className={classes.sliderDisclaimer}>
        <Typography variant='caption' component='div' color='textSecondary'>*&nbsp;</Typography>
        <Typography variant='caption' component='div' color='textSecondary'>
          For comparison of different definitions of active users across platforms, we estimate {percTotalUsersAreTracked * 100}% of your total users will actively provide you with feedback.
        </Typography>
      </div>
    </div>
  );
};

const FilterButton = (props: {
  label: React.ReactNode;
  text?: string;
  select: boolean;
  platformIds: Set<string>;
  invertSelection?: boolean;
  showExamples?: number;
  invertExamples?: boolean;
}) => {
  const classes = useStyles();

  const examples = !!props.invertExamples
    ? new Set(Object.keys(Platforms).filter(id => !props.platformIds.has(id)))
    : props.platformIds;

  return (
    <FilterButtonBase
      select={props.select}
      platformIds={props.platformIds}
      invertSelection={props.invertSelection}
      renderButton={(onClick, disabled) => (
        <>
          {!!props.showExamples && (
            <BrandList
              platformIds={[...examples]}
              limit={props.showExamples}
              small
            />
          )}
          <Collapse in={!disabled}>
            <div>
              <Alert
                className={classes.filterButtonAlert}
                variant='standard'
                icon={false}
                severity='info'
                action={(
                  <Button
                    disabled={disabled}
                    color='inherit'
                    // variant='text'
                    onClick={onClick}
                  >
                    {props.label}
                  </Button>
                )}
              >
                {props.text}
              </Alert>
            </div>
          </Collapse>
        </>
      )}
    />
  );
};
const FilterIconButton = (props: {
  icon?: OverridableComponent<SvgIconTypeMap>;
  iconClassName?: string;
  select: boolean;
  platformIds: Set<string>;
  invertSelection?: boolean;
}) => {
  const Icon = props.icon || FilterIcon;
  return (
    <FilterButtonBase
      select={props.select}
      platformIds={props.platformIds}
      invertSelection={props.invertSelection}
      renderButton={(onClick, disabled) => (
        <Tooltip title='Only show these platforms' placement='top'>
          <IconButton
            disabled={disabled}
            color='inherit'
            onClick={onClick}
          >
            <Icon
              className={props.iconClassName}
              fontSize='small'
              color='inherit'
            />
          </IconButton>
        </Tooltip>
      )}
    />
  );
};
const FilterButtonBase = (props: {
  select: boolean;
  platformIds: Set<string>;
  invertSelection?: boolean;
  renderButton: (onClick, disabled) => any;
}) => {
  const { hiddenPlatforms, setHiddenPlatforms } = useContext(HiddenPlatformsContext);
  if (props.platformIds.size === 0) return null;

  const platformIds = !!props.invertSelection
    ? new Set(Object.keys(Platforms).filter(id => !props.platformIds.has(id)))
    : props.platformIds;
  const disabled = [...platformIds].reduce((disabled, id) => disabled && (props.select !== hiddenPlatforms.has(id)), true);
  const onClick = e => {
    if (props.select) {
      setHiddenPlatforms(new Set<string>([...hiddenPlatforms].filter(id => !platformIds.has(id))));
    } else {
      setHiddenPlatforms(new Set<string>([...hiddenPlatforms, ...platformIds]));
    }
  };
  return props.renderButton(onClick, disabled);
};

const BrandList = (props: {
  platformIds: Array<string>,
  selected?: string,
  limit?: number,
  small?: boolean,
  onClick?: (platformId: string) => void,
  onHover?: (platformId: string, isHovering: boolean) => void,
  BrandProps?: Partial<React.ComponentProps<typeof Brand>>;
}) => {
  const classes = useStyles();
  const { hiddenPlatforms } = useContext(HiddenPlatformsContext);

  var platformIds = hiddenPlatforms.size > 0
    ? [
      ...props.platformIds.filter(id => !hiddenPlatforms.has(id)),
      ...props.platformIds.filter(id => hiddenPlatforms.has(id)),
    ]
    : props.platformIds;
  if (props.limit !== undefined) {
    platformIds = platformIds.slice(0, props.limit);
  }

  return (
    <div className={classes.brandListContainer}>
      {platformIds.map(platformId => (
        <HoverArea key={platformId} disableHoverBelow={dontHoverBelow}>
          {(hoverAreaProps, isHovering, isHoverDisabled) => {
            props.onHover && props.onHover(platformId, isHovering);
            return (
              <div {...hoverAreaProps} onClick={() => props.onClick && props.onClick(platformId)} style={{
                cursor: props.onClick ? 'pointer' : undefined,
              }}>
                <Brand
                  className={classNames(
                    props.small && classes.brandListSmall,
                    hiddenPlatforms.has(platformId) && classes.hiddenPlatform,
                    props.selected === platformId && classes.brandListSelected)}
                  key={platformId}
                  platformId={platformId}
                  showLogo
                  showCheckbox
                  transparentControls={!(isHovering || isHoverDisabled)}
                  {...props.BrandProps}
                />
              </div>
            );
          }}
        </HoverArea>
      ))}
      {(props.limit && props.limit < props.platformIds.length) && (
        <Brand
          className={classNames(props.small && classes.brandListSmall, classes.brandListOther)}
          key='plus'
          platformId={`+${props.platformIds.length - props.limit}`}
          {...props.BrandProps}
        />
      )}
    </div>
  );
};
const Brand = (props: ({ platformId: string; } | { platform: Platform | AlternativePlatform }) & {
  className?: string;
  showLogo?: boolean;
  showCheckbox?: boolean;
  showTextColor?: boolean;
  showLink?: boolean
  transparentControls?: boolean;
}) => {
  const classes = useStyles();
  const { hiddenPlatforms, toggleHiddenPlatform } = useContext(HiddenPlatformsContext);

  const platform: AlternativePlatform | Platform | undefined = props['platform'] || Platforms[props['platformId']] || AlternativePlatforms[props['platformId']];
  if (!platform) {
    return (
      <div className={classNames(classes.platformOther, props.className)}>
        <Typography component='div' color='inherit'>
          {props['platformId'] === PlatformOther
            ? '...'
            : props['platformId']}
        </Typography>
      </div>
    );
  }

  return (
    <div className={classNames(classes.brandContainer, props.className)}>
      {props.showCheckbox && (
        <Tooltip title={`${hiddenPlatforms.has(platform.id) ? 'Show' : 'Hide'} this platform`} placement='left'>
          <Checkbox
            className={classNames(classes.brandCheckbox, classes.transparentTransition, props.transparentControls && classes.transparent)}
            size='small'
            color='default'
            checked={!hiddenPlatforms.has(platform.id)}
            onChange={e => toggleHiddenPlatform(platform.id)}
          />
        </Tooltip>
      )}
      {props.showLogo && (
        <ImgIso
          className={classes.brandImg}
          alt={platform.name}
          src={platform.logo.src}
          aspectRatio={platform.logo.aspectRatio}
          maxWidth={platform.logo.width}
          maxHeight={platform.logo.height}
        />
      )}
      <Typography component='div' color='inherit' style={{
        color: props.showTextColor ? platform.color : undefined,
      }} className={classes.brandName}>
        {platform.name}
      </Typography>
      {props.showLink && (
        <ExternalLinkPlatform type='home' platform={platform} transparent={props.transparentControls} />
      )}
    </div>
  );
};

const ExternalLink = (props: {
  url: string;
  children: React.ReactNode;
}) => {
  return (
    <MuiLink
      href={props.url}
      target='_blank'
      underline='none'
      rel='noopener nofollow'
    >
      {props.children}
    </MuiLink>
  );
};

const ExternalLinkPlatform = (props: ({
  type: 'home';
  platform: Platform | AlternativePlatform;
} | {
  type: 'pricing';
  platform: Platform;
}) & {
  transparent?: boolean;
}) => {
  const classes = useStyles();
  return (
    <IconButton
      className={classNames(classes.platformOpenButton, classes.transparentTransition, !!props.transparent && classes.transparent)}
      color='inherit'
      aria-label={props.type === 'pricing' ? 'pricing page' : 'home page'}
      onClick={e => {
        trackingBlock(() => {
          ReactGA.event({
            category: 'compare',
            action: props.type === 'pricing' ? 'click-competitor-pricing-page' : 'click-competitor-home-page',
            label: props.platform.id,
          });
        });
        !windowIso.isSsr && windowIso.open(props.type === 'pricing' ? props.platform.pricing.url : props.platform.url, '_blank', 'noopener');
      }}
    >
      <OpenIcon fontSize='inherit' />
    </IconButton>
  );
};

export default Competitors;
