import React from 'react';

export default function keyMapper<P>(
  mapper: (props: P) => string,
  Component: React.ComponentType<P>
) {
  return class KeyMapper extends React.Component<P & { key?: string }> {
    render() {
      return (
        <Component
          {...this.props as P}
          key={(this.props.key || '') + mapper(this.props)}
        />
      );
    }
  };
};
