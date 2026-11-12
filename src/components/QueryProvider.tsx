'use client';

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/queryClient';

/** Gives the game's windows the shared read cache (`lib/queryClient.ts`). Wraps the game only; the landing page and the auth screens do not use it. */
const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
	<QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>
);

export default QueryProvider;
