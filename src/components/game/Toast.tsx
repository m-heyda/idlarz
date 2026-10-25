import React from 'react';
import { useUiStore } from '@/stores/uiStore';
import '@/styles/ContextMenu.css';

/** A short message at the bottom of the screen ("Game saved"); `showToast` in the ui store puts it up for a couple of seconds. */
const Toast: React.FC = () => {
	const toast = useUiStore((state) => state.toast);
	if (!toast) return null;
	return (
		<div key={toast.id} className='px-toast ui-toast text-[#ffe27a] text-sm' role='status'>
			{toast.text}
		</div>
	);
};

export default Toast;
