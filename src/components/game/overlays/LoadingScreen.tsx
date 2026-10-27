import React from 'react';
import { useHydration } from '@/hooks/useHydration';
import LoadingView from './LoadingView';

/** The splash while the saved game loads (needs the game store; the start gate uses LoadingView, which does not). */
const LoadingScreen: React.FC = () => {
	const isHydrated = useHydration();
	return isHydrated ? null : <LoadingView />;
};

export default LoadingScreen;
