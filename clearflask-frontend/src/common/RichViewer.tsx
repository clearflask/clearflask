// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { CSSProperties } from '@material-ui/core/styles/withStyles';
import classNames from 'classnames';
import React from 'react';
import { contentScrollApplyStyles, Orientation, Side } from './ContentScroll';

const contentBackgroundColor = (theme: Theme): string => theme.palette.grey[theme.palette.type === 'dark' ? 900 : 100];
/**
 * Adapted from quill.core.css
 */
export const QuillViewStyle = (theme: Theme): CSSProperties => ({
  paddingBottom: 1, // Compensate for link border-bottom, which otherwise overflows
  '& blockquote:not(.ql-direction-rtl), & blockquote.ql-direction-rtl': {
    color: theme.palette.text.secondary,
  },
  '& blockquote:not(.ql-direction-rtl)': {
    paddingLeft: theme.spacing(1),
    marginLeft: theme.spacing(0.5),
    borderLeft: '5px solid ' + contentBackgroundColor(theme),
  },
  '& blockquote.ql-direction-rtl': {
    paddingRight: theme.spacing(1),
    marginRight: theme.spacing(0.5),
    borderRight: '5px solid ' + contentBackgroundColor(theme),
  },
  '& a:not(.ql-direction-rtl), & a.ql-direction-rtl': {
    color: 'unset',
    borderBottom: '1px dashed',
    textDecoration: 'none',
    cursor: 'pointer',
    '&:hover': {
      borderBottomStyle: 'solid',
    },
  },
  '& pre:not(.ql-direction-rtl), & pre.ql-direction-rtl': {
    margin: theme.spacing(1, 0),
    backgroundColor: contentBackgroundColor(theme),
    ...contentScrollApplyStyles({
      theme,
      side: Side.Center,
      orientation: Orientation.Horizontal,
      backgroundColor: contentBackgroundColor(theme),
    }),
    borderRadius: 4,
    marginLeft: theme.spacing(0.5),
    padding: theme.spacing(1.5),
    whiteSpace: 'pre!important',
  },
  boxSizing: 'border-box',
  height: '100%',
  outline: 'none',
  overflowY: 'auto',
  tabSize: 4,
  textAlign: 'left',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  '& div, & ol, & ul, & pre, & blockquote, & h1, & h2, & h3, & h4, & h5, & h6': {
    margin: '0',
    padding: '0',
    counterReset:
      'list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9'
  },
  // If changing headers, also edit "toneDownHeadings" below,
  '& h2': theme.typography.h5,
  '& h3': theme.typography.h6,
  '& h4': theme.typography.subtitle1,
  '& ol, & ul': { paddingLeft: theme.spacing(0.5) },
  '& ol > li, & ul > li': { listStyleType: 'none' },
  '& ul > li::before': { content: '"\\2022"' },
  '& ul[data-checked=true] > li::before, & ul[data-checked=false] > li::before': {
    width: 15,
    verticalAlign: 'middle',
  },
  '& ul[data-checked=true] > li::before': {
    /**
     * Mui CheckBoxOutlined SVG (Alternative via emoji: '"\\2611"')
     * - Removed unnecessary attributes
     * - Modified viewbox to remove extra whitespace (24 -> 22)
     * - Encode using https://yoksel.github.io/url-encoder/
     */
    content: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath style='fill:${encodeURIComponent(theme.palette.text.primary)}' d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z'%3E%3C/path%3E%3C/svg%3E")`,
  },
  '& ul[data-checked=false] > li::before': {
    /**
     * Mui CheckBoxOutlineBlankOutlinedIcon SVG (Alternative via emoji: '"\\2610"')
     * - Removed unnecessary attributes
     * - Modified viewbox to remove extra whitespace (24 -> 22)
     * - Encode using https://yoksel.github.io/url-encoder/
     */
    content: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 22'%3E%3Cpath style='fill:${encodeURIComponent(theme.palette.text.primary)}' d='M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z'%3E%3C/path%3E%3C/svg%3E")`,
  },
  '& li::before': {
    display: 'inline-block',
    whiteSpace: 'nowrap',
    width: theme.spacing(1.2)
  },
  '& li:not(.ql-direction-rtl)::before': {
    marginRight: theme.spacing(1),
    textAlign: 'right'
  },
  '& li.ql-direction-rtl::before': {
    marginLeft: theme.spacing(1),
  },
  '& ol li:not(.ql-direction-rtl), & ul li:not(.ql-direction-rtl)': {
    paddingLeft: theme.spacing(1.5)
  },
  '& ol li.ql-direction-rtl, & ul li.ql-direction-rtl': {
    paddingRight: theme.spacing(1.5)
  },
  '& ol li': {
    counterReset:
      'list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9',
    counterIncrement: 'list-0'
  },
  '& ol li:before': { content: 'counter(list-0, decimal) \'. \'' },
  '& ol li.ql-indent-1': {
    counterIncrement: 'list-1',
    counterReset: 'list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9'
  },
  '& ol li.ql-indent-1:before': {
    content: 'counter(list-1, lower-alpha) \'. \''
  },
  '& ol li.ql-indent-2': {
    counterIncrement: 'list-2',
    counterReset: 'list-3 list-4 list-5 list-6 list-7 list-8 list-9'
  },
  '& ol li.ql-indent-2:before': {
    content: 'counter(list-2, lower-roman) \'. \''
  },
  '& ol li.ql-indent-3': {
    counterIncrement: 'list-3',
    counterReset: 'list-4 list-5 list-6 list-7 list-8 list-9'
  },
  '& ol li.ql-indent-3:before': {
    content: 'counter(list-3, decimal) \'. \''
  },
  '& ol li.ql-indent-4': {
    counterIncrement: 'list-4',
    counterReset: 'list-5 list-6 list-7 list-8 list-9'
  },
  '& ol li.ql-indent-4:before': {
    content: 'counter(list-4, lower-alpha) \'. \''
  },
  '& ol li.ql-indent-5': {
    counterIncrement: 'list-5',
    counterReset: 'list-6 list-7 list-8 list-9'
  },
  '& ol li.ql-indent-5:before': {
    content: 'counter(list-5, lower-roman) \'. \''
  },
  '& ol li.ql-indent-6': {
    counterIncrement: 'list-6',
    counterReset: 'list-7 list-8 list-9'
  },
  '& ol li.ql-indent-6:before': {
    content: 'counter(list-6, decimal) \'. \''
  },
  '& ol li.ql-indent-7': {
    counterIncrement: 'list-7',
    counterReset: 'list-8 list-9'
  },
  '& ol li.ql-indent-7:before': {
    content: 'counter(list-7, lower-alpha) \'. \''
  },
  '& ol li.ql-indent-8': {
    counterIncrement: 'list-8',
    counterReset: 'list-9'
  },
  '& ol li.ql-indent-8:before': {
    content: 'counter(list-8, lower-roman) \'. \''
  },
  '& ol li.ql-indent-9': { counterIncrement: 'list-9' },
  '& ol li.ql-indent-9:before': {
    content: 'counter(list-9, decimal) \'. \''
  },
  '& .ql-indent-1:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(3) },
  '& li.ql-indent-1:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(4.5) },
  '& .ql-indent-1.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(3)
  },
  '& li.ql-indent-1.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(4.5)
  },
  '& .ql-indent-2:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(6) },
  '& li.ql-indent-2:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(7.5) },
  '& .ql-indent-2.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(6)
  },
  '& li.ql-indent-2.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(7.5)
  },
  '& .ql-indent-3:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(9) },
  '& li.ql-indent-3:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(10.5) },
  '& .ql-indent-3.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(9)
  },
  '& li.ql-indent-3.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(10.5)
  },
  '& .ql-indent-4:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(12) },
  '& li.ql-indent-4:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(13.5) },
  '& .ql-indent-4.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(12)
  },
  '& li.ql-indent-4.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(13.5)
  },
  '& .ql-indent-5:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(15) },
  '& li.ql-indent-5:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(16.5) },
  '& .ql-indent-5.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(15)
  },
  '& li.ql-indent-5.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(16.5)
  },
  '& .ql-indent-6:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(18) },
  '& li.ql-indent-6:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(19.5) },
  '& .ql-indent-6.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(18)
  },
  '& li.ql-indent-6.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(19.5)
  },
  '& .ql-indent-7:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(21) },
  '& li.ql-indent-7:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(22.5) },
  '& .ql-indent-7.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(21)
  },
  '& li.ql-indent-7.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(22.5)
  },
  '& .ql-indent-8:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(24) },
  '& li.ql-indent-8:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(25.5) },
  '& .ql-indent-8.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(24)
  },
  '& li.ql-indent-8.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(25.5)
  },
  '& .ql-indent-9:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(27) },
  '& li.ql-indent-9:not(.ql-direction-rtl)': { paddingLeft: theme.spacing(28.5) },
  '& .ql-indent-9.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(27)
  },
  '& li.ql-indent-9.ql-direction-rtl.ql-align-right': {
    paddingRight: theme.spacing(28.5)
  },
  '& .ql-video': { display: 'block', maxWidth: '100%' },
  '& .ql-video.ql-align-center': { margin: '0 auto' },
  '& .ql-video.ql-align-right': { margin: '0 0 0 auto' },
  '& .ql-bg-black': { backgroundColor: '#000' },
  '& .ql-bg-red': { backgroundColor: '#e60000' },
  '& .ql-bg-orange': { backgroundColor: '#f90' },
  '& .ql-bg-yellow': { backgroundColor: '#ff0' },
  '& .ql-bg-green': { backgroundColor: '#008a00' },
  '& .ql-bg-blue': { backgroundColor: '#06c' },
  '& .ql-bg-purple': { backgroundColor: '#93f' },
  '& .ql-color-white': { color: '#fff' },
  '& .ql-color-red': { color: '#e60000' },
  '& .ql-color-orange': { color: '#f90' },
  '& .ql-color-yellow': { color: '#ff0' },
  '& .ql-color-green': { color: '#008a00' },
  '& .ql-color-blue': { color: '#06c' },
  '& .ql-color-purple': { color: '#93f' },
  '& .ql-font-serif': {
    fontFamily: theme.typography.fontFamily,
  },
  '& .ql-font-monospace': {
    fontFamily: 'Monaco, Courier New, monospace'
  },
  '& .ql-size-small': { fontSize: '0.75em' },
  '& .ql-size-large': { fontSize: '1.5em' },
  '& .ql-size-huge': { fontSize: '2.5em' },
  '& .ql-direction-rtl': { direction: 'rtl', textAlign: 'inherit' },
  '& .ql-align-center': { textAlign: 'center' },
  '& .ql-align-justify': { textAlign: 'justify' },
  '& .ql-align-right': { textAlign: 'right' },
  '& img': { margin: theme.spacing(1) },
  '& img[align="left"]': {
    float: 'left',
    marginLeft: 0,
  },
  '& img[align="right"]': {
    float: 'right',
    marginRight: 0,
  },
  '& img[align="left"], & img[align="right"]': { clear: 'both' },
  '& img[align="middle"]': {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});

const styles = (theme: Theme) => createStyles({
  container: {
    ...QuillViewStyle(theme),
  },
  toneDownHeadings: {
    '& h2': { fontSize: '1.2rem' },
    '& h3': { fontSize: '1.1rem' },
    '& h4': { fontSize: '1.05rem' },
  }
});
interface Props {
  iAgreeInputIsSanitized: true;
  html: string;
  toneDownHeadings?: boolean;
}
class RichViewer extends React.Component<Props & WithStyles<typeof styles, true>> {
  render() {
    return (
      <div
        className={classNames(this.props.classes.container, this.props.toneDownHeadings && this.props.classes.toneDownHeadings)}
        dangerouslySetInnerHTML={{ __html: this.props.html }}
      />
    );
  }
}

export default withStyles(styles, { withTheme: true })(RichViewer);
