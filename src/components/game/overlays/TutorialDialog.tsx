import React, { useMemo, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import { guideVisible } from '@/lib/tutorial/live';
import { buildNumbers } from '@/lib/tutorial/numbers';
import { journalEntries } from '@/lib/tutorial/engine';
import { GUIDE_NAME, TUTORIAL_PATH } from '@/catalog/tutorial';
import PixelModal from '../PixelModal';
import Tutorial from './Tutorial';

/** Brother Alder's journal: every lesson and starter step that has come up, readable again; the ones not reached yet are '???'. */
export const GuideJournal: React.FC = () => {
	const progress = useTutorialStore((state) => state.progress);
	const numbers = useMemo(buildNumbers, []);
	const entries = journalEntries(progress);
	const entry = (key: string, title: string, text: string, seen: boolean) => (
		<div key={key} className='px-card mb-2'>
			<div className={seen ? 'text-[#f0d27a]' : 'guide-journal-lock'}>{seen ? title : '???'}</div>
			<div className='text-sm text-[#ecdcb4]'>{seen ? text : 'You have not come across this yet.'}</div>
		</div>
	);
	return (
		<div>
			<p className='text-sm text-[#a89878] mb-3'>{GUIDE_NAME} writes down what he tells you. Lessons you have not reached yet are still hidden.</p>
			<h3 className='text-[#f0d27a] mb-2'>Getting started</h3>
			{TUTORIAL_PATH.map((step) => entry(step.id, step.title, step.text(numbers), progress.done.includes(step.id)))}
			<h3 className='text-[#f0d27a] mt-4 mb-2'>Lessons</h3>
			{entries.map(({ lesson, seen }) => entry(lesson.id, lesson.title, lesson.text(numbers), seen))}
		</div>
	);
};

/** The full guide, reopened on demand from Settings: the reference sections, and (once the guide is live) Brother Alder's journal. */
const TutorialDialog: React.FC = () => {
	const open = useUiStore((state) => state.tutorialOpen);
	const close = useUiStore((state) => state.closeTutorial);
	const [tab, setTab] = useState<'reference' | 'journal'>('reference');
	if (!open) return null;
	const journal = guideVisible();
	return (
		<PixelModal title='Guide' size='lg' onClose={close}>
			{journal && (
				<div className='flex gap-2 mb-4' role='tablist' aria-label='Guide'>
					{(['reference', 'journal'] as const).map((id) => (
						<button key={id} role='tab' aria-selected={tab === id} className={`px-btn px-btn-sm ${tab === id ? '' : 'px-btn-gray'}`} onClick={() => setTab(id)}>
							{id === 'reference' ? 'Reference' : 'Journal'}
						</button>
					))}
				</div>
			)}
			{tab === 'journal' && journal ? <GuideJournal /> : <Tutorial />}
			<div className='flex justify-center mt-6'>
				<button className='px-btn px-btn-blue' onClick={close}>
					Close
				</button>
			</div>
		</PixelModal>
	);
};

export default TutorialDialog;
