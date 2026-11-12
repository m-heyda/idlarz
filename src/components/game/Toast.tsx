import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/ContextMenu.css';

/** Short messages ("Game saved") under the header; `showToast` in the ui store puts one up for a couple of seconds, and several stack. */
const Toast: React.FC = () => {
	const toasts = useUiStore((state) => state.toasts);
	return (
		<>
			{toasts.map((toast) => (
				<div key={toast.id} className='ds-root ds-toast ui-toast' role='status'>
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
