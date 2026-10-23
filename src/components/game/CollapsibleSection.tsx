import React, { useState } from 'react';

const storageKey = (id: string) => `idlarz.section.${id}`;

const readOpen = (id: string) => {
	try {
		return localStorage.getItem(storageKey(id)) !== 'closed';
	} catch {
		return true;
	}
};

/** A titled block whose header toggles the body; the open/closed choice is remembered per `id`. */
const CollapsibleSection: React.FC<{
	id: string;
	title: string;
	className?: string;
	children: React.ReactNode;
}> = ({ id, title, className, children }) => {
	const [open, setOpen] = useState(() => readOpen(id));

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
			<h3 className='px-h !mb-0'>
				<button
					type='button'
					onClick={toggle}
					aria-expanded={open}
					className='flex w-full cursor-pointer items-center justify-between text-left uppercase'>
					<span>{title}</span>
					<span
						aria-hidden
						className='inline-block h-0 w-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-current transition-transform duration-150'
						style={{ transform: open ? undefined : 'rotate(-90deg)' }}
					/>
				</button>
			</h3>
			{open && <div className='mt-3 space-y-3'>{children}</div>}
		</div>
	);
};

export default CollapsibleSection;
