import React from 'react';

/**
 * Keeps one window's crash from blanking the whole game: the window shows a short notice and the rest keeps running. Close and reopen the
 * window to try again (a closed window is not mounted, so reopening starts it fresh).
 */
export default class WindowErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { failed: boolean }> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error(`The ${this.props.name} window crashed`, error);
	}

	render() {
		if (!this.state.failed) return this.props.children;
		return (
			<div className='text-sm text-[#ff8a6a] p-3' role='alert'>
				The {this.props.name} window hit an error. Close it and open it again; your game is safe.
			</div>
		);
	}
}
