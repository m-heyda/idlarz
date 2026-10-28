import React, { useState } from 'react';
import { scoped } from '@/lib/storageScope';

const storageKey = (id: string) => scoped(`idlarz.section.${id}`);

const readOpen = (id: string, defaultOpen: boolean) => {
	try {
		const stored = localStorage.getItem(storageKey(id));
		return stored === null ? defaultOpen : stored !== 'closed';
	} catch {
		return defaultOpen;
	}
};

/**
 * A titled block whose header toggles the body; the open/closed choice is remembered per `id` (localStorage).
 * `defaultOpen` is what a first visit sees; `compact` is the small row style for sections inside a section.
 */
const CollapsibleSection: React.FC<{
	id: string;
	title: React.ReactNode;
	/** Text shown at the right of the header, before the arrow (a summary that stays visible when closed) */
	summary?: React.ReactNode;
	className?: string;
	defaultOpen?: boolean;
	compact?: boolean;
	children: React.ReactNode;
}> = ({ id, title, summary, className, defaultOpen = true, compact = false, children }) => {
	const [open, setOpen] = useState(() => readOpen(id, defaultOpen));

	const toggle = () => {
		const next = !open;
		setOpen(next);
		try {
			localStorage.setItem(storageKey(id), next ? 'open' : 'closed');
		} catch {
			// storage unavailable: the section still toggles for this visit
		}
	};

	return (
		<div className={className}>
			<h3 className={compact ? 'text-xs text-[#d8c8a0] border-b px-rule' : 'px-h !mb-0'}>
				<button
					type='button'
					onClick={toggle}
					aria-expanded={open}
					className={`flex w-full cursor-pointer items-center justify-between gap-3 text-left ${compact ? 'py-1' : 'uppercase'}`}>
					<span>{title}</span>
					<span className='flex items-center gap-2'>
						{summary !== undefined && <span className='normal-case'>{summary}</span>}
						<span
							aria-hidden
							className='inline-block h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-current transition-transform duration-150'
							style={{ transform: open ? undefined : 'rotate(-90deg)' }}
						/>
					</span>
				</button>
			</h3>
			{open && <div className={compact ? 'mt-2 mb-1 space-y-1' : 'mt-3 space-y-3'}>{children}</div>}
		</div>
	);
};

export default CollapsibleSection;
