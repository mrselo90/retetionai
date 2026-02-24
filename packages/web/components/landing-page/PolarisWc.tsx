'use client';

import * as React from 'react';

type ElProps = React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode };

function createTag(tag: string) {
  return function Tag({ children, ...props }: ElProps) {
    return React.createElement(tag, props, children);
  };
}

export const SPage = createTag('s-page');
export const SSection = createTag('s-section');
export const SCard = createTag('s-card');
export const SBadge = createTag('s-badge');
export const SButton = createTag('s-button');
