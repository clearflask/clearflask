/// <reference path="../@types/transform-media-imports.d.ts"/>
import { Button, Checkbox, Collapse, Container, IconButton, Link as MuiLink, Slider, SvgIconTypeMap, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { OverridableComponent } from '@material-ui/core/OverridableComponent';
import { createStyles, darken, fade, lighten, makeStyles, Theme } from '@material-ui/core/styles';
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints';
import CheckIcon from '@material-ui/icons/Check';
import FilterIcon from '@material-ui/icons/FilterList';
import ImportExportIcon from '@material-ui/icons/ImportExport';
import OpenIcon from '@material-ui/icons/OpenInNew';
import PaymentIcon from '@material-ui/icons/Payment';
import PeopleIcon from '@material-ui/icons/People';
import FeaturesIcon from '@material-ui/icons/PlaylistAddCheck';
import SpeakIcon from '@material-ui/icons/RecordVoiceOver';
import AnalyzeIcon from '@material-ui/icons/ShowChart';
import SpeedIcon from '@material-ui/icons/Speed';
import TranslateIcon from '@material-ui/icons/Translate';
import IntegrationsIcon from '@material-ui/icons/Widgets';
import classNames from 'classnames';
import React, { useContext, useState } from 'react';
import ReactGA from 'react-ga';
import ClearFlaskImg from '../../public/img/clearflask-logo.png';
import CannyImg from '../../public/img/landing/compare/canny.png';
import ConfluxImg from '../../public/img/landing/compare/conflux.png';
import ConvasImg from '../../public/img/landing/compare/convas.png';
import FeatureUpvoteImg from '../../public/img/landing/compare/featureupvote.png';
import FiderImg from '../../public/img/landing/compare/fider.png';
import HelloNextImg from '../../public/img/landing/compare/hellonext.png';
import NoltImg from '../../public/img/landing/compare/nolt.png';
import NooraImg from '../../public/img/landing/compare/noora.png';
import RoadmapSpaceImg from '../../public/img/landing/compare/roadmapspace.png';
import SuggestedImg from '../../public/img/landing/compare/suggested.png';
import UpvotyImg from '../../public/img/landing/compare/upvoty.png';
import UserVoiceImg from '../../public/img/landing/compare/uservoice.png';
import { contentScrollApplyStyles } from '../common/ContentScroll';
import HoverArea from '../common/HoverArea';
import ImgIso from '../common/ImgIso';
import { isTracking } from '../common/util/detectEnv';

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
interface Platform {
  id: string;
  name: string;
  logo: Img;
  color: string;
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
    pricing: {
      url: 'https://uservoice.com/request-demo',
      plans: [{ basePrice: 500 }],
    },
  },
  [PlatformCanny]: {
    id: PlatformCanny,
    name: 'Canny',
    logo: CannyImg,
    color: 'rgb(94,98,240)',
    pricing: {
      url: 'https://canny.io/pricing',
      plans: [
        { basePrice: 50, baseUsers: 100 / percTotalUsersAreTracked, unitPrice: 20, unitUsers: 100 / percTotalUsersAreTracked },
        { basePrice: 200, baseUsers: 1000 / percTotalUsersAreTracked, unitPrice: 100, unitUsers: 1000 / percTotalUsersAreTracked },
      ],
    },
  },
  [PlatformUpvoty]: {
    id: PlatformUpvoty,
    name: 'Upvoty',
    logo: UpvotyImg,
    color: 'rgb(233,134,85)',
    pricing: {
      url: 'https://upvoty.com/pricing/',
      plans: [
        { basePrice: 15, baseUsers: 150 / percTotalUsersAreTracked },
        { basePrice: 25, baseUsers: 1500 / percTotalUsersAreTracked },
        { basePrice: 49 },
      ],
    },
  },
  [PlatformFider]: {
    id: PlatformFider,
    name: 'Fider',
    logo: FiderImg,
    color: 'rgb(0,0,0)',
    pricing: {
      url: 'https://getfider.com',
      plans: [{ basePrice: 0 }],
    },
  },
  [PlatformHelloNext]: {
    id: PlatformHelloNext,
    name: 'HelloNext',
    logo: HelloNextImg,
    color: 'rgb(10,73,176)',
    pricing: {
      url: 'https://hellonext.co/pricing/#compare-plans',
      plans: [{ basePrice: 50 }],
    },
  },
  [PlatformConvas]: {
    id: PlatformConvas,
    name: 'Convas',
    logo: ConvasImg,
    color: 'rgb(72,166,248)',
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
  [PlatformNolt]: {
    id: PlatformNolt,
    name: 'Nolt',
    logo: NoltImg,
    color: 'rgb(237,106,102)',
    pricing: {
      url: 'https://nolt.io/pricing/',
      plans: [{ basePrice: 25 }],
    },
  },
  [PlatformSuggested]: {
    id: PlatformSuggested,
    name: 'Suggested',
    logo: SuggestedImg,
    color: '#286ffa',
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
    pricing: {
      url: 'https://roadmap.space/plans-pricing/',
      plans: [
        { basePrice: 29, baseUsers: 500 / percTotalUsersAreActive60Days },
        { basePrice: 49, baseUsers: 1500 / percTotalUsersAreActive60Days },
        { basePrice: 99, baseUsers: 3000 / percTotalUsersAreActive60Days },
      ],
    },
  },
  [PlatformFeatureUpvote]: {
    id: PlatformFeatureUpvote,
    name: 'FeatureUpvote',
    logo: FeatureUpvoteImg,
    color: 'rgb(50,58,70)',
    pricing: {
      url: 'https://featureupvote.com/pricing/',
      plans: [{ basePrice: 99 }],
    },
  },
};

const dontHoverBelow: Breakpoint = 'sm';
const useStyles = makeStyles((theme: Theme) => createStyles({
  emphasize: {
    fontWeight: 'bolder',
  },
  heading: {
    marginTop: theme.spacing(6),
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
    ...contentScrollApplyStyles(theme),
  },
  tableHiddenPlatform: {
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
  filterButtonContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  filterButtonExample: {
    margin: theme.spacing(1, 2, 0),
    '& $brandImg': {
      width: 11,
    },
    '& p': {
      fontSize: '0.8em',
    },
  },
  filterButtonExampleOther: {
    paddingLeft: theme.spacing(3.5),
  },
  filterButtonExamplesContainer: {
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
    display: 'inline-block',
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
  pricingOpenButton: {
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
}));

const HiddenPlatformsContext = React.createContext({
  hiddenPlatforms: new Set<string>(),
  toggleHiddenPlatform: (platformId: string) => { },
  setHiddenPlatforms: (platformIds: Set<string>) => { },
});

const Competitors = () => {
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

  return (
    <HiddenPlatformsContext.Provider value={hiddenPlatformsWrapper}>
      <Container maxWidth='md'>
        <Intro />
        <Volume />
        <PricingCompare />
        <MajorFeatures />
        <VotingMechanism />
        <Onboarding />
        <Language />
        <ImportExport />
        <Integrations />
        <PageLoad />
      </Container>
    </HiddenPlatformsContext.Provider>
  );
};

const Intro = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>Problem outline</Typography>
      <p><Typography>You’ve created a product and you want to know which area you should focus on next. A great source of ideas is your customer voice, but the thought of going through the process of gathering, summarizing and prioritizing what your customers want is cumbersome.</Typography></p>
      <p><Typography>This is where customer feedback platforms can help. Most are a drop-in platform you can integrate with your website, app or product to start collecting feedback right away. The right tool will not only help in de-duplicating and combining ideas together, but also prioritizing feedback based on customer value or other factors important to you.</Typography></p>
      <p><Typography>An important aspect of feedback collection is to make your customer base feel heard. Keeping your product development in touch with your customers will help your reputation and also keep your customers engaged. Your customer will love to hear from you when you release their long-awaited feature.</Typography></p>
      <p><Typography>So which feedback tool is right for you?</Typography></p>
    </React.Fragment>
  );
};

const Volume = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <PeopleIcon fontSize='inherit' />&nbsp;
        How many users do you expect?
      </Typography>
      <p><Typography>The amount of feedback you will receive depends on your current or predicted number of customers and how tightly you integrate the feedback tool with your product.</Typography></p>
      <p><Typography>The <span className={classes.emphasize}>coverage rate</span> metric measures the percentage of users that have provided you with feedback by posting a unique idea or indicating that an existing idea is suited for them. UserVoice <ExternalLink url='https://community.uservoice.com/blog/new-in-uservoice-coverage-rate-reporting/'>reports</ExternalLink> that at least 15% coverage rate is considered satisfactory with typical rate ranging up to 50%. While Canny customers see a typical rate of 5%.</Typography></p>
      <p><Typography>Some platforms are not only suited to handle large amounts of feedback, but do not provide the tools to organize and sort through that feedback afterwards. Typically you will fall under one of these categories:</Typography></p>

      <Typography component='h3' variant='h5' className={classes.heading}>High Volume</Typography>
      <Typography variant='subtitle1'>Enterprise or proven product</Typography>
      <p><Typography>If you have a clear cut use case that requires a high volume of feedback, you need to choose a platform that can handle this amount of feedback. Collecting feedback is one thing, but how do you sort throught it at scale matters.</Typography></p>
      <p><Typography>UserVoice is the market leader in this space with Canny and ClearFlask as alternative options.</Typography></p>
      <FilterButton
        label='Show me' text='only high-volume platforms' showExamples={3}
        select={false} invertSelection platformIds={new Set([PlatformUserVoice, PlatformClearFlask, PlatformCanny])}
      />

      <Typography component='h3' variant='h5' className={classes.heading}>Variable Volume</Typography>
      <Typography variant='subtitle1'>Startups or growing product</Typography>
      <p><Typography>Startups or products with growth should look at platforms that can handle high-volume and scale with your needs. Beware of unlimited plans that usually indicate the platform has never experienced a high-volume customer and may not be able to handle your future volume.</Typography></p>
      <p><Typography>ClearFlask and Canny are both built for high-volume while only charging you based on your current volume.</Typography></p>
      <FilterButton
        label='Show me' text='only variable-volume platforms' showExamples={3}
        select={false} invertSelection platformIds={new Set([PlatformClearFlask, PlatformCanny])}
      />

      <Typography component='h3' variant='h5' className={classes.heading}>Low Volume with many projects</Typography>
      <Typography variant='subtitle1'>Serial hobbyist</Typography>
      <p><Typography>If you collect feedback across many small separate projects, you don't want to be paying and maintaining separate accounts and billing for each project.</Typography></p>
      <p><Typography>At ClearFlask, you can have multiple projects under the same account and you only pay for the combined user count across all of your projects. Convas has a free-tier for projects under 50 users, while Fider is free and open-source for only the cost of hosting and managing your instances.</Typography></p>
      <FilterButton
        label='Show me' text='only multi-project platforms' showExamples={3}
        select={false} invertSelection platformIds={new Set([PlatformClearFlask, PlatformConvas, PlatformFider])}
      />

      <Typography component='h3' variant='h5' className={classes.heading}>Low Volume</Typography>
      <Typography variant='subtitle1'>Small group, hobbyist</Typography>
      <p><Typography>For collecting feedback from a small group of users, there are many options available. Keep reading below to find the product based on other factors.</Typography></p>
      <FilterButton
        label='Show me' text='only low-volume platforms' showExamples={4} invertExamples
        select={false} platformIds={new Set([PlatformUserVoice])}
      />
    </React.Fragment>
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
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <PaymentIcon fontSize='inherit' />&nbsp;
        What is your budget?
      </Typography>
      <p><Typography>Although pricing shouldn't be your sole factor for determining your solution, you should know how much are you willing to spend. If your product has variable number of users, calculate how much you are willing to spend per customer.</Typography></p>
      <p><Typography>Look at your current or predicted number of total users you have to estimate your price below</Typography></p>

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
    </React.Fragment>
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
  const { hiddenPlatforms, toggleHiddenPlatform, setHiddenPlatforms } = useContext(HiddenPlatformsContext);

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
            <HoverArea hoverDown={dontHoverBelow}>
              {(hoverAreaProps, isHovering) => (
                <TableRow {...hoverAreaProps} key={row.platform.id} className={classNames(hiddenPlatforms.has(row.platform.id) && classes.tableHiddenPlatform)}>
                  <TableCell key='platformName' className={classes.pricingCell}>
                    <Brand platformId={row.platform.id} showLogo showCheckbox transparentCheckbox={!isHovering} />
                  </TableCell>
                  <TableCell key='price' className={classNames(classes.pricingCell, classes.pricingPriceCell)}>
                    <Price val={row.price} />
                    <IconButton
                      className={classes.pricingOpenButton}
                      color='inherit'
                      aria-label='Pricing page'
                      onClick={e => {
                        if (isTracking()) {
                          ReactGA.event({
                            category: 'compare',
                            action: 'click-competitor-pricing-page',
                            label: row.platform.id,
                          });
                        }
                        window.open(row.platform.pricing.url, '_blank', 'noopener');
                      }}
                    >
                      <OpenIcon fontSize='inherit' />
                    </IconButton>
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
      <Typography component='div' variant='h5'>{formatNumber(props.val)}</Typography>
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
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <FeaturesIcon fontSize='inherit' />&nbsp;
        Which features matter to you?
      </Typography>
      <p><Typography>Each platform has a set of major components that are available. Be prepared that although two platforms have the same component, the functionality of that component may drastically differ. Use this table as a quick comparison:</Typography></p>
      <ComparisonTable
        headers={[
          { headingId: 'ideas', content: 'Collect Feedback' },
          { headingId: 'roadmap', content: 'Public Roadmap' },
          { headingId: 'changelog', content: 'Changelog' },
          { headingId: 'knowledge', content: 'Knowledge base' },
          { headingId: 'forum', content: 'Forum' },
          { headingId: 'blog', content: 'Blog' },
          { headingId: 'custom', content: 'Custom' },
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
    </React.Fragment>
  );
};

const VotingMechanism = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <AnalyzeIcon fontSize='inherit' />&nbsp;
        Prioritization of feedback
      </Typography>
      <p><Typography>Most platforms can collect a lot of feedback, while only a few can handle making sense of it all.</Typography></p>
      <p><Typography>To better understand the feedback you collected, you need to consider the value of each of your customers. For example, you may want to know which features your customers wanted considering revenue. Or you may want to see only your recently churned customers in your enterprise plan.</Typography></p>

      <Typography component='h4' variant='h6' className={classes.heading}>Analyze externally</Typography>
      <p><Typography>One way to accomplish this is to export your data to an external Data Warehouse or analytics tool to further analyze your data which allows you to correlate with other data you have about your customers.</Typography></p>

      <Typography component='h4' variant='h6' className={classes.heading}>Segmentation</Typography>
      <p><Typography>Some platforms allow you to import arbitrary customer data in order to filter, search and assign weights to your customers.</Typography></p>

      <Typography component='h4' variant='h6' className={classes.heading}>Credit system</Typography>
      <p><Typography>Another approach is to issue credits to your customers based on their value such as monthly spend. They can then spend their credits on the features they want.</Typography></p>

      <p><Typography>Whether you choose to give control to your users with fine-grained ranking or analyze behind the scenes (or both) is dependant on your specific use case.</Typography></p>
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
    </React.Fragment>
  );
};

const Onboarding = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <SpeakIcon fontSize='inherit' />&nbsp;
        Engagement channels
      </Typography>
      <p><Typography>The value of feedback is drastically different between a customer or someone that has no intention in being your customer. One way to ensure that feedback is valuable is to ask the user to provide a communication channel so they can be notified when their feedback is addressed.</Typography></p>

      <Typography component='h4' variant='h6' className={classes.heading}>Onboarding friction</Typography>
      <p><Typography>Users are hesitant to provide their personal information including their email address. The more personal information you ask during sign-up will result in less feedback you will receive.</Typography></p>
      <p><Typography>If you manage your customer accounts already, <span className={classes.emphasize}>Single Sign-On</span> is the right solution as it allows you to seamlessly login your users in the background with no login screen.</Typography></p>

      <Typography component='h4' variant='h6' className={classes.heading}>Guest / Anonymous feedback</Typography>
      <p><Typography>Ideal in narrow use cases, allows your users to sign-up without providing any contact information. Use this only as a last resort as it attracts spam and leaves you with no engagement opportunity.</Typography></p>
      <p><Typography><span className={classes.emphasize}>Browser Push Notifications</span> are an alternative where your users don't have to provide their email, but you have a communication channel open.</Typography></p>


      <Typography component='h4' variant='h6' className={classes.heading}>OAuth, SAML</Typography>
      <p><Typography>Although OAuth and SAML allow you to login with the vast majority of external providers including Facebook and Google, some platforms have a built-in shared login for specific providers shown below.</Typography></p>

      <ComparisonTable
        headers={[
          { headingId: 'email', content: 'Email' },
          { headingId: 'guest', content: 'Guest' },
          { headingId: 'sso', content: 'SSO' },
          { headingId: 'saml', content: 'SAML' },
          { headingId: 'oauth', content: 'OAuth' },
          { headingId: 'browserpush', content: 'Browser Push' },
          { headingId: 'emaildomain', content: 'Email Domain' },
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
    </React.Fragment>
  );
};

const ImportExport = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <ImportExportIcon fontSize='inherit' />&nbsp;
        Import and Export: vendor lock-in
      </Typography>
      <p><Typography></Typography></p>

      <FilterButton
        label='Show me' text='only platforms with Export' showExamples={3}
        select={false} invertSelection platformIds={new Set([PlatformUserVoice, PlatformCanny, PlatformClearFlask, PlatformUpvoty, PlatformFider, PlatformSuggested, PlatformFeatureUpvote])}
      />

      <ComparisonTable
        tableStyle={{ width: 'max-content' }}
        headers={[
          { content: 'Self-service' },
          { headingId: 'export', content: 'Export' },
          { headingId: 'import', content: 'Import' },
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
    </React.Fragment>
  );
};

const Language = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <TranslateIcon fontSize='inherit' />&nbsp;
        Language support
        </Typography>
      <p><Typography></Typography></p>

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
          { platformId: PlatformUpvoty, headingIds: new Set(['English', 'Arabic', 'Chinese', 'Danish', 'Dutch', 'Finnish', 'French', 'German', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Norwegian', 'Polish', 'Portuguese', 'Russian', 'Slovak', 'Spanish', 'Swedish', 'Turkish']) },
          { platformId: PlatformNolt, headingIds: new Set(['English', 'Arabic', 'Danish', 'Dutch', 'Estonian', 'French', 'German', 'Hungarian', 'Italian', 'Norwegian', 'Persian', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Turkish', 'Vietnamese']) },
          { platformId: PlatformHelloNext, headingIds: new Set(['English', 'Chinese', 'French', 'German', 'Korean', 'Portuguese', 'Russian', 'Spanish']) },
          { platformId: PlatformOther, headingIds: new Set(['English']) },
        ]}
      />
    </React.Fragment>
  );
};

const Integrations = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <IntegrationsIcon fontSize='inherit' />&nbsp;
        Integrations
      </Typography>
      <p><Typography></Typography></p>

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
          { platformId: PlatformUserVoice, headingIds: new Set(['API', 'GoogleAnalytics', 'FullStory', 'Fivetran', 'Slack', 'MsftTeams', 'Jira', 'Zendesk', 'Gainsight', 'AzureDevOps', 'Salesforce', 'Okta', 'OneLogin']) },
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
    </React.Fragment>
  );
};

const PageLoad = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <SpeedIcon fontSize='inherit' />&nbsp;
        Website health
      </Typography>
      <p><Typography>
        Largest Contentful Paint (seconds, Mobile) https://web.dev/lcp/
        Cumulative Layout Shift (Mobile) https://web.dev/cls/
        PageSpeed score (Mobile)
        </Typography></p>

      <ComparisonTable
        tableStyle={{ width: 'max-content' }}
        headers={[
          { headingId: 'paint', content: 'Page load', customContent: true },
          { headingId: 'pageshift', content: 'Page shift', customContent: true },
          // { headingId: 'score', content: 'Score', customContent: true },
          { headingId: 'nojs', content: 'NoJS' },
        ]}
        data={[
          { platformId: PlatformNolt, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={2.9} />), score: (<PageLoadSpeed val={58} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformFeatureUpvote, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={2.9} />), score: (<PageLoadSpeed val={74} />), pageshift: (<PageLoadLayoutShift val={0.002} />) } },
          { platformId: PlatformFider, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={3.2} />), score: (<PageLoadSpeed val={62} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformClearFlask, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={4.3} />), score: (<PageLoadSpeed val={30} />), pageshift: (<PageLoadLayoutShift val={0.159} />) } },
          { platformId: PlatformRoadmapSpace, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={5.4} />), score: (<PageLoadSpeed val={26} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformUpvoty, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={5.6} />), score: (<PageLoadSpeed val={51} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformHelloNext, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={6.4} />), score: (<PageLoadSpeed val={42} />), pageshift: (<PageLoadLayoutShift val={0.084} />) } },
          { platformId: PlatformConvas, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={7.2} />), score: (<PageLoadSpeed val={21} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformCanny, headingIds: new Set(['nojs']), customContentByHeadingId: { paint: (<PageLoadSeconds val={8.2} />), score: (<PageLoadSpeed val={41} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
          { platformId: PlatformSuggested, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={8.4} />), score: (<PageLoadSpeed val={39} />), pageshift: (<PageLoadLayoutShift val={0.074} />) } },
          { platformId: PlatformNoora, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={9.1} />), score: (<PageLoadSpeed val={11} />), pageshift: (<PageLoadLayoutShift val={0.129} />) } },
          { platformId: PlatformConflux, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={9.4} />), score: (<PageLoadSpeed val={30} />), pageshift: (<PageLoadLayoutShift val={0.706} />) } },
          { platformId: PlatformUserVoice, headingIds: new Set([]), customContentByHeadingId: { paint: (<PageLoadSeconds val={10.8} />), score: (<PageLoadSpeed val={18} />), pageshift: (<PageLoadLayoutShift val={0} />) } },
        ]}
      />
    </React.Fragment>
  );
};
const PageLoadSeconds = (props: { val: number }) => {
  return (
    <div style={{ textAlign: 'end', color: `rgb(${Math.max(0, (props.val - 2) * 50)},0,0)` }}>
      {props.val}&nbsp;sec
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

const TemplateDeleteMe = (props: {}) => {
  const classes = useStyles();
  return (
    <React.Fragment>
      <Typography component='h2' variant='h4' className={classes.heading}>
        <FeaturesIcon fontSize='inherit' />&nbsp;
        a
      </Typography>
      <p><Typography></Typography></p>

      <ComparisonTable
        headers={[
          { headingId: '', content: '' },
        ]}
        data={[
          { platformId: PlatformUserVoice, headingIds: new Set([]) },
        ]}
      />
    </React.Fragment>
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
  const { hiddenPlatforms, toggleHiddenPlatform, setHiddenPlatforms } = useContext(HiddenPlatformsContext);

  const rowMapper = isHidden => row => (
    <HoverArea hoverDown={dontHoverBelow}>
      {(hoverAreaProps, isHovering) => (
        <TableRow {...hoverAreaProps} key={row.platformId} className={classNames(isHidden && classes.tableHiddenPlatform)}>
          <TableCell key='platformName'><Brand platformId={row.platformId} showLogo showCheckbox transparentCheckbox={!isHovering} /></TableCell>
          {props.headers.map(header => {
            if (!header.headingId) {
              return (
                <React.Fragment>
                  <TableCell key={`divider-${header.headingId}`} className={classes.tableDivider}></TableCell>
                  <TableCell key={`grouping-${header.headingId}`}></TableCell>
                </React.Fragment>
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
                  <React.Fragment>
                    <TableCell key={`divider-${header.headingId}`} className={classes.tableDivider}><div /></TableCell>
                    <TableCell key={`grouping-${header.headingId}`} className={classNames(classes.tableHeading, classes.tableGrouping)}>{header.content}</TableCell>
                  </React.Fragment>
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
                <HoverArea hoverDown={dontHoverBelow}>
                  {(hoverAreaProps, isHovering) => {
                    return (
                      <TableCell {...hoverAreaProps} key={headingId} className={classes.tableHeading}>
                        <div>
                          <FilterIconButton
                            iconClassName={classNames(classes.transparentTransition, !isHovering && classes.transparent)}
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
          For comparison of different definitions of active users, we estimate tracked and active users to be {percTotalUsersAreTracked * 100}% of your total users.
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
        <Collapse in={!disabled}>
          <div className={classes.filterButtonContainer}>
            <Button
              disabled={disabled}
              color='primary'
              variant='text'
              onClick={onClick}
            >
              {props.label}
            </Button>
            {props.text && (
              <Typography variant='caption'>{props.text}</Typography>
            )}
          </div>
          {props.showExamples && (
            <div className={classes.filterButtonExamplesContainer}>
              {[...examples].slice(0, props.showExamples).map(platformId => (
                <Brand
                  className={classes.filterButtonExample}
                  key={platformId}
                  platformId={platformId}
                  showLogo
                // showCheckbox
                />
              ))}
              {props.showExamples < examples.size && (
                <Brand
                  className={classNames(classes.filterButtonExampleOther, classes.filterButtonExample)}
                  key='plus'
                  platformId={`+${examples.size - props.showExamples}`}
                />
              )}
            </div>
          )}
        </Collapse>
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
  const { hiddenPlatforms, toggleHiddenPlatform, setHiddenPlatforms } = useContext(HiddenPlatformsContext);
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

const Brand = (props: ({ platformId: string; } | { platform: Platform }) & {
  className?: string;
  showLogo?: boolean;
  showCheckbox?: boolean;
  showTextColor?: boolean;
  transparentCheckbox?: boolean;
}) => {
  const classes = useStyles();
  const { hiddenPlatforms, toggleHiddenPlatform, setHiddenPlatforms } = useContext(HiddenPlatformsContext);

  const platform: Platform | undefined = props['platform'] || Platforms[props['platformId']]
  if (!platform) {
    return (
      <div className={classNames(classes.platformOther, props.className)}>
        <Typography color='inherit'>
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
        <Checkbox className={classNames(classes.brandCheckbox, classes.transparentTransition, props.transparentCheckbox && classes.transparent)} size='small' color='default' checked={!hiddenPlatforms.has(platform.id)}
          onChange={e => toggleHiddenPlatform(platform.id)}
        />
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
      <Typography color='inherit' style={{
        color: props.showTextColor ? platform.color : undefined,
      }}>
        {platform.name}
      </Typography>
    </div>
  );
};

const ExternalLink = (props: {
  url: string;
  children: React.ReactNode;
}) => {
  const classes = useStyles();
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

export default Competitors;
