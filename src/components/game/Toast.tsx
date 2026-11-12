import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/ContextMenu.css';

/** Short messages ("Game saved", and in red a refusal such as "You need 490 more gems") at the top of the screen under the header; `showToast(text, tone?)` in the ui store puts one up for a couple of seconds, and several stack. */
const Toast: React.FC = () => {
	const toasts = useUiStore((state) => state.toasts);
	return (
		<>
			{toasts.map((toast) => (
				<div key={toast.id} className='ds-root ds-toast ui-toast' data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
					<span className='ds-toast-line'>
						{toast.text}
						{toast.count > 1 && <span className='ds-toast-sub'>x{toast.count}</span>}
					</span>
				</div>
			))}
		</>
	);
};

export default Toast;
