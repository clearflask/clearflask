import React, { Component, useState } from 'react';
import Header from '../../app/Header';
import { Project } from '../DemoApp';


const HeaderDemo = (props: {project: Project}) => {
  const [pageSlug, setPageSlug] = useState<string | undefined>('');
  return (
    <Header
      server={props.project.server}
      pageSlug={pageSlug || ''}
      pageChanged={ps => setPageSlug(ps)}
    />
  );
}

export default HeaderDemo;
