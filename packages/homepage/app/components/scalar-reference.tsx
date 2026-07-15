import '@scalar/api-reference-react/style.css';

import type { ApiReferenceReact } from '@scalar/api-reference-react';
import type { ComponentProps, ComponentType } from 'react';
import { useEffect, useState } from 'react';

type ScalarComponent = ComponentType<ComponentProps<typeof ApiReferenceReact>>;

export function ScalarReference() {
  const [Reference, setReference] = useState<ScalarComponent>();

  useEffect(() => {
    let active = true;
    void import('@scalar/api-reference-react').then((module) => {
      if (active) setReference(() => module.ApiReferenceReact);
    });
    return () => {
      active = false;
    };
  }, []);

  if (Reference === undefined) {
    return (
      <main aria-busy="true" className="tinyauth-scalar-loading">
        Loading Tinyauth API Reference…
      </main>
    );
  }

  return (
    <main className="tinyauth-scalar" data-scalar-ready="true">
      <Reference
        configuration={{
          darkMode: true,
          defaultOpenAllTags: true,
          layout: 'modern',
          persistAuth: true,
          showSidebar: true,
          url: '/openapi.json',
        }}
      />
    </main>
  );
}
