import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';
import { fade } from '@material-ui/core/styles/colorManipulator';
import 'emoji-mart/css/emoji-mart.css';
import { Picker, PickerProps } from 'emoji-mart/dist-es/index.js';
import React from 'react';

const styles = (theme: Theme) => createStyles({
  picker: {
    '& .emoji-mart': {
      color: theme.palette.text.primary + '!important',
    },
    '& .emoji-mart-scroll': {
      color: theme.palette.text.primary + '!important',
      height: 170,
    },
    '& .emoji-mart-emoji': {
      filter: theme.expressionGrayscale ? (`grayscale(${theme.expressionGrayscale}%)!important`) : undefined,
    },
    '& .emoji-mart-anchor-icon svg': {
      fill: theme.palette.text.secondary + '!important',
    },
    '& .emoji-mart-search input::placeholder': {
      color: theme.palette.text.secondary + '!important',
    },
    '& .emoji-mart-search input': {
      background: 'inherit!important',
      border: '0px!important',
      color: theme.palette.text.primary + '!important',
    },
    '& .emoji-mart-category-label span': {
      background: fade(theme.palette.background.paper, .95) + '!important',
    },
  },
});
interface Props {
  inline?: boolean;
}
class EmojiPicker extends React.Component<Props & PickerProps & WithStyles<typeof styles, true>> {
  render() {
    const { classes, ...pickerProps } = this.props;
    return (
      <span className={this.props.classes.picker}>
        <Picker
          native
          showPreview={false}
          showSkinTones={false}
          emojiSize={16}
          perLine={7}
          exclude={['recent']}
          style={this.props.inline ? {
            border: 'unset',
            background: 'unset',
            display: 'block',
          } : undefined}
          color={this.props.theme.palette.primary.main}
          {...pickerProps}
        />
      </span>
    );
  }
}

export default withStyles(styles, { withTheme: true })(EmojiPicker);
