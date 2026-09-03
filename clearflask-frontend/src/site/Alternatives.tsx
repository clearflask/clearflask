// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
/** Intentional comment to prevent licence-maven-plugin from deleting the below line */
/// <reference path="../@types/transform-media-imports.d.ts"/>
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@material-ui/core';
import { Theme, createStyles, makeStyles } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/Check';
import CompareIcon from '@material-ui/icons/CompareArrows';
import CloseIcon from '@material-ui/icons/Close';
import DesignIcon from '@material-ui/icons/FormatPaint';
import PeopleIcon from '@material-ui/icons/People';
import SimpleIcon from '@material-ui/icons/FilterNone';
import AnalyzeIcon from '@material-ui/icons/ShowChart';
import TranslateIcon from '@material-ui/icons/Translate';
import IntegrationsIcon from '@material-ui/icons/Widgets';
import React from 'react';
import { Link } from 'react-router-dom';
import ComparisonImg from '../../public/img/landing/comparison.svg';
import RoadmapImg from '../../public/img/landing/roadmap.svg';
import PricingImg from '../../public/img/landing/pricing.svg';
import ValueImg from '../../public/img/landing/value.svg';
import Block from './landing/Block';
import HorizontalPanels from './landing/HorizontalPanels';

/**
 * Per-competitor "alternative" landing pages.
 *
 * These target high-intent search ("canny alternative", "fider vs clearflask")
 * where the visitor already knows the category and is looking for a reason to
 * switch. Keep it factual — an overstated claim here is worse than no page at
 * all, because the visitor is comparing us against a tab they already have open.
 *
 * Feature and performance claims come from `Competitors.tsx`, which is the
 * maintained source of truth for the 30+ platform comparison: major features,
 * prioritisation mechanisms, onboarding, integrations, customisation, and the
 * PageSpeed Insights LCP/CLS measurements. Change the data there first, then
 * mirror it here. Pricing is verified against each vendor's public pricing page
 * (see ceo/reports/canny-competitive-2026-08-29.md).
 *
 * Every page states plainly what the competitor does better. For Canny that is
 * integrations, where we are genuinely behind.
 */

const useStyles = makeStyles((theme: Theme) => createStyles({
  tableContainer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    // The table is the densest thing on the page; let it scroll on its own
    // rather than forcing the page body to scroll sideways on mobile.
    overflowX: 'auto',
    padding: theme.spacing(0, 2, 6),
  },
  table: {
    maxWidth: 620,
  },
  usHeader: {
    color: theme.palette.primary.main,
    fontWeight: 'bold',
  },
  yes: {
    color: theme.palette.primary.main,
  },
  no: {
    color: theme.palette.text.hint,
  },
  caption: {
    display: 'block',
    maxWidth: 620,
    margin: '0 auto',
    padding: theme.spacing(0, 3, 2),
    textAlign: 'center',
    color: theme.palette.text.hint,
  },
  // Section headings are centered over the content they introduce. Used with
  // Block's `noSpacing`, because Block's default spacing is 10vw of horizontal
  // padding — combined with a max-width that would squeeze the title into a
  // narrow ribbon on a wide screen.
  sectionHeading: {
    textAlign: 'center',
    maxWidth: 720,
    margin: '0 auto',
    padding: theme.spacing(10, 3, 0),
  },
}));

interface CompareRow {
  label: string;
  us: string | boolean;
  them: string | boolean;
}

/** One thing the competitor genuinely does better, shown as an icon column. */
interface Strength {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface Alternative {
  /** Used in the route and the page title, eg 'canny' -> /canny-alternative */
  id: string;
  name: string;
  /** Page <title>; this is what shows in search results. */
  title: string;
  heroTitle: string;
  heroDescription: string;
  heroImage: Img;
  /** The single most honest reason someone leaves them for us. */
  wedgeTitle: string;
  wedgeDescription: string;
  wedgeImage: Img;
  /** Short. These render as ticks, so they must read as clean wins. */
  wedgePoints: Array<string>;
  /** Render as crosses. Use for what the competitor makes you live with. */
  wedgeCounterpoints?: Array<string>;
  rows: Array<CompareRow>;
  /** What the competitor genuinely does better. Keep descriptions to one sentence. */
  theirStrengths: Array<Strength>;
  /** One line under the strengths. Not a paragraph. */
  closing: string;
}

export const Alternatives: { [id: string]: Alternative } = {
  canny: {
    id: 'canny',
    name: 'Canny',
    title: 'Canny Alternative',
    heroTitle: 'The open-source Canny alternative',
    heroDescription: 'Unlimited voters and commenters on a flat plan. Or self-host it free.',
    heroImage: ComparisonImg,
    wedgeTitle: 'We don\'t charge you for engagement',
    wedgeDescription: 'Canny meters "tracked users" — anyone who posts, votes or comments. That is the exact thing a healthy feedback board produces, so the better your board does, the larger your bill.',
    wedgeImage: ValueImg,
    wedgePoints: [
      'Unlimited voters and commenters',
      'Flat $29/mo, no per-user overage',
      'Free plan with no user cap',
    ],
    wedgeCounterpoints: [
      'Canny is free to 25 tracked users, then $19 to $79/mo',
    ],
    rows: [
      { label: 'Price to start', us: 'Free', them: 'Free' },
      { label: 'Users included free', us: 'Unlimited', them: '25 tracked users' },
      { label: 'Entry paid plan', us: '$6/mo', them: '~$19/mo' },
      { label: 'Custom domain + whitelabel', us: '$29/mo', them: '$79/mo' },
      // Framed positively on purpose: "Charges per tracked user" would put a
      // checkmark in Canny's column, which reads as a win to anyone skimming.
      { label: 'Unlimited users, no meter', us: true, them: false },
      { label: 'Page load, mobile (LCP)', us: '2.6 sec', them: '8.2 sec' },
      { label: 'Content types', us: '7', them: '3' },
      { label: 'Knowledge base, forum & blog', us: true, them: false },
      { label: 'Custom statuses & workflow', us: true, them: false },
      { label: 'Custom pages, HTML & CSS', us: true, them: false },
      { label: 'Crowd-funding & credit voting', us: true, them: false },
      { label: 'Guest / anonymous feedback', us: true, them: false },
      { label: 'Open source & self-hostable', us: true, them: false },
      { label: 'Third-party integrations', us: '3', them: '13' },
      { label: 'Customer segmentation', us: false, them: true },
    ],
    theirStrengths: [
      {
        icon: (<IntegrationsIcon fontSize="inherit" />),
        title: 'Integrations',
        description: 'Slack, Teams, Jira, Zendesk, Intercom, GitHub, Salesforce and Okta — against our API, Google Analytics and Hotjar.',
      },
      {
        icon: (<PeopleIcon fontSize="inherit" />),
        title: 'Customer segmentation',
        description: 'Attach traits to a user and weight feedback by who it came from. We do not offer this.',
      },
      {
        icon: (<AnalyzeIcon fontSize="inherit" />),
        title: 'Automatic capture',
        description: 'Their AI reads support tickets and sales calls and files the feedback for you.',
      },
    ],
    closing: 'If your workflow depends on feedback syncing into Jira today, Canny does that and we do not yet.',
  },
  uservoice: {
    id: 'uservoice',
    name: 'UserVoice',
    title: 'UserVoice Alternative',
    heroTitle: 'The open-source UserVoice alternative',
    heroDescription: 'Sign up and publish a board today. No demo, no quote, no annual contract.',
    heroImage: ComparisonImg,
    wedgeTitle: 'Priced for a product team, not a procurement cycle',
    wedgeDescription: 'UserVoice sells through demos and annual contracts. That makes sense at enterprise scale and no sense at all for a team of five.',
    wedgeImage: PricingImg,
    wedgePoints: [
      'Self-serve signup, pay by card',
      'Flat $29/mo, cancel anytime',
      'Free plan to try it first',
    ],
    wedgeCounterpoints: [
      'UserVoice starts with a sales call and an annual commitment',
    ],
    rows: [
      { label: 'Self-serve signup', us: true, them: false },
      { label: 'Price to start', us: 'Free', them: 'Contact sales' },
      { label: 'Full-featured plan', us: '$29/mo', them: 'Enterprise quote' },
      // Positive framing, same reason as the Canny meter row above.
      { label: 'Pay monthly, cancel anytime', us: true, them: false },
      { label: 'Page load, mobile (LCP)', us: '2.6 sec', them: '11.0 sec' },
      { label: 'Open source & self-hostable', us: true, them: false },
      { label: 'Custom content types', us: true, them: false },
      { label: 'Crowd-funding & credit voting', us: true, them: false },
      { label: 'Whitelabel & custom pages', us: true, them: true },
      { label: 'Customer segmentation', us: false, them: true },
      { label: 'Data warehouse export', us: false, them: true },
      { label: 'SAML', us: false, them: true },
    ],
    theirStrengths: [
      {
        icon: (<IntegrationsIcon fontSize="inherit" />),
        title: 'Enterprise integrations',
        description: 'Salesforce, Gainsight, Azure DevOps, Zendesk, Okta and OneLogin.',
      },
      {
        icon: (<AnalyzeIcon fontSize="inherit" />),
        title: 'Segmentation & warehouse',
        description: 'Weight feedback by customer value, or pipe it into your own warehouse with Fivetran.',
      },
      {
        icon: (<TranslateIcon fontSize="inherit" />),
        title: 'SAML & translation',
        description: 'SAML single sign-on, plus on-page Google Translate for any post.',
      },
    ],
    closing: 'Running feedback for a large organisation with a budget to match? UserVoice earns its price. We are aiming at the team it is too heavy for.',
  },
  fider: {
    id: 'fider',
    name: 'Fider',
    title: 'Fider Alternative',
    heroTitle: 'ClearFlask vs Fider',
    heroDescription: 'Both open source, both self-hostable. One of them keeps going after the voting board.',
    heroImage: ComparisonImg,
    wedgeTitle: 'Everything past the voting board',
    wedgeDescription: 'Fider does one thing: a simple idea board with votes. ClearFlask covers what comes after, on the same Apache-2.0 codebase.',
    wedgeImage: RoadmapImg,
    wedgePoints: [
      'Public roadmap and changelog',
      'Knowledge base and forum',
      'Custom statuses and workflows',
      'Credits and crowd-funding, not just upvotes',
    ],
    wedgeCounterpoints: [
      'Fider is the voting board on its own',
    ],
    rows: [
      { label: 'Open source', us: 'Apache-2.0', them: 'AGPLv3' },
      { label: 'Self-hostable', us: true, them: true },
      { label: 'Cost to self-host', us: 'Free', them: 'Free' },
      { label: 'Managed cloud option', us: true, them: false },
      { label: 'Content types', us: '7', them: '1' },
      { label: 'Public roadmap', us: true, them: false },
      { label: 'Changelog / announcements', us: true, them: false },
      { label: 'Knowledge base & forum', us: true, them: false },
      { label: 'Custom statuses & workflow', us: true, them: false },
      { label: 'Crowd-funding & credit voting', us: true, them: false },
      { label: 'Renders without JavaScript', us: true, them: false },
      { label: 'Page load, mobile (LCP)', us: '2.6 sec', them: '3.2 sec' },
      { label: 'Custom domain & remove branding', us: true, them: true },
      { label: 'Self-service data import', us: true, them: false },
    ],
    theirStrengths: [
      {
        icon: (<SimpleIcon fontSize="inherit" />),
        title: 'Simplicity',
        description: 'Fewer moving parts to deploy and reason about. If a plain voting board is all you need, that is a real advantage.',
      },
      {
        icon: (<DesignIcon fontSize="inherit" />),
        title: 'Already whitelabel',
        description: 'Your own domain, colours and custom CSS with no "Powered by" — at no cost.',
      },
    ],
    closing: 'Choose ClearFlask when you need the extra content types, the prioritisation options, or infrastructure that scales past a single database.',
  },
};

const Cell = (props: { value: string | boolean, classes: ReturnType<typeof useStyles> }) => {
  if (typeof props.value === 'boolean') {
    return props.value
      ? (<CheckIcon fontSize="inherit" className={props.classes.yes} />)
      : (<CloseIcon fontSize="inherit" className={props.classes.no} />);
  }
  return (<>{props.value}</>);
};

export function LandingAlternative(props: { alternativeId: string }) {
  const classes = useStyles();
  const alt = Alternatives[props.alternativeId];
  if (!alt) return null;

  return (
    <>
      <Block
        type="hero"
        title={alt.heroTitle}
        description={alt.heroDescription}
        iconAbove
        icon={(<CompareIcon fontSize="inherit" />)}
        image={alt.heroImage}
        buttonTitle="Get started free"
        buttonLink="/signup"
        buttonVariant="contained"
        button2Title="See all 30+ tools"
        button2Link="/product/compare"
      />

      {/* headingMain, not column: a standalone `column` Block renders a bare flex div
          with no spacing class and no grid, so it goes full-bleed with zero margins
          and the image stretches to the viewport. `column` is only for use inside
          HorizontalPanels, which supplies the width. */}
      <Block
        type="headingMain"
        title={alt.wedgeTitle}
        description={alt.wedgeDescription}
        largePoints
        points={alt.wedgePoints}
        counterpoints={alt.wedgeCounterpoints}
        image={alt.wedgeImage}
        imageStyleOuter={{ maxWidth: 350, padding: 0 }}
        alignItems="flex-start"
        mirror
      />

      <Block
        className={classes.sectionHeading}
        type="headingOnly"
        title={`ClearFlask vs ${alt.name}`}
        noSpacing
      />

      <div className={classes.tableContainer}>
        <Table className={classes.table} size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell align="center" className={classes.usHeader}>ClearFlask</TableCell>
              <TableCell align="center">{alt.name}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alt.rows.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.label}</TableCell>
                {/* Only the header is branded. Colouring every one of our cells green
                    would paint a weakness — "3" integrations, no segmentation — as if
                    it were a win. The check/cross icons carry the meaning instead. */}
                <TableCell align="center"><Cell value={row.us} classes={classes} /></TableCell>
                <TableCell align="center"><Cell value={row.them} classes={classes} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Typography variant="caption" className={classes.caption}>
        Page load measured with Google PageSpeed Insights against each platform's own
        mobile feedback page. See the{' '}
        <Link to="/product/compare">full comparison of 30+ feedback tools</Link>{' '}
        for the complete feature tables.
      </Typography>

      <Block
        className={classes.sectionHeading}
        type="headingOnly"
        title={`Where ${alt.name} is better`}
        description={alt.closing}
        noSpacing
      />

      {/* staggerHeight 0: with a centered heading above, a staggered row reads as
          lopsided rather than deliberate. maxWidth tracks the column count — each
          panel takes an equal share of the container, so two panels in an `lg`
          container end up flung to opposite edges of the page. */}
      <HorizontalPanels
        wrapBelow="md"
        maxContentWidth="xs"
        maxWidth={alt.theirStrengths.length > 2 ? 'lg' : 'md'}
        staggerHeight={0}
      >
        {alt.theirStrengths.map((strength, index) => (
          <Block
            key={index}
            type="column"
            icon={strength.icon}
            title={strength.title}
            description={strength.description}
          />
        ))}
      </HorizontalPanels>

      <Block
        type="headingMain"
        title="Try it before you move anything"
        description="Publish a board on our free plan, point a few users at it, and see whether it gets used before you migrate anything or pay us a cent."
        alignItems="flex-start"
        buttonTitle="Get started free"
        buttonLink="/signup"
        button2Title="See pricing"
        button2Link="/pricing"
      />
    </>
  );
}
