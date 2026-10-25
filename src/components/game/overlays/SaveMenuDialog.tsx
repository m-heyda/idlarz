import React, { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { useGameStore } from '@/stores/gameStore';
import { pickPersisted, type PersistedGame } from '@/lib/sanitizeSave';
import {
	commitImport,
	exportSaveText,
	getDamagedSave,
	getSaveInfo,
	parseSaveText,
	resetSave,
	type SaveInfo,
} from '@/lib/saveStorage';
import { copyText } from '@/lib/clipboard';
import { formatTime } from '@/utils/formatters';
import { GRID_CENTER_X, GRID_CENTER_Y } from '@/config/gameConfig';
import { countOwnedTiles } from '@/utils/gameUtils';
import PixelModal from '../PixelModal';

const MAX_FILE_BYTES = 3_000_000;

const stamp = () => {
	const d = new Date();
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

const ago = (time: number | null): string => {
	if (time === null) return 'not yet';
	const sec = Math.max(0, Math.round((Date.now() - time) / 1000));
	if (sec < 10) return 'just now';
	if (sec < 90) return `${sec} s ago`;
	return `${Math.round(sec / 60)} min ago`;
};

type Parsed =
	| { kind: 'none' }
	| { kind: 'ok'; state: PersistedGame; savedAt: number | null }
	| { kind: 'error'; reason: string };

/**
 * Save & backup: the game saves itself in this browser; here the player can see that it works, copy the whole save
 * as one line of text (or a file) and load such a line back, or start over.
 */
const SaveDialogBody: React.FC = () => {
	const close = useUiStore((state) => state.closeSaveMenu);
	const [info, setInfo] = useState<SaveInfo | null>(null);
	const [exportText] = useState(() => exportSaveText(pickPersisted(useGameStore.getState())));
	const [note, setNote] = useState<string | null>(null);
	const [importText, setImportText] = useState('');
	const [parsed, setParsed] = useState<Parsed>({ kind: 'none' });
	const [confirmReset, setConfirmReset] = useState(false);
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);
	const exportRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		let alive = true;
		void getSaveInfo().then((value) => alive && setInfo(value));
		return () => {
			alive = false;
		};
	}, []);

	// Check pasted text as it arrives; an older answer must not overwrite a newer one
	useEffect(() => {
		if (!importText.trim()) {
			setParsed({ kind: 'none' });
			return;
		}
		let alive = true;
		void parseSaveText(importText).then((result) => {
			if (!alive) return;
			setParsed(
				result.ok
					? { kind: 'ok', state: result.state, savedAt: result.savedAt }
					: { kind: 'error', reason: result.reason }
			);
		});
		return () => {
			alive = false;
		};
	}, [importText]);

	const handleCopy = async () => {
		setNote((await copyText(exportText, exportRef.current)) ? 'Copied. Keep it somewhere safe.' : 'Could not copy; select the text and copy it by hand.');
	};

	const handleDownload = () => {
		const url = URL.createObjectURL(new Blob([exportText], { type: 'text/plain' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `idlarz-${stamp()}.sav`;
		link.click();
		URL.revokeObjectURL(url);
		setNote('Save file downloaded.');
	};

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;
		if (file.size > MAX_FILE_BYTES) {
			setParsed({ kind: 'error', reason: 'That file is too large to be a save.' });
			return;
		}
		setImportText(await file.text());
	};

	const confirmImport = async () => {
		if (parsed.kind !== 'ok') return;
		setBusy(true);
		try {
			commitImport(parsed.state);
			window.location.reload();
		} catch (e) {
			setBusy(false);
			setParsed({ kind: 'error', reason: (e as Error).message });
		}
	};

	const confirmResetGame = async () => {
		setBusy(true);
		await resetSave();
		window.location.reload();
	};

	const copyDamaged = async () => {
		const text = getDamagedSave();
		setNote(text && (await copyText(text, null)) ? 'Damaged save copied.' : 'Nothing to copy.');
	};

	const ok = parsed.kind === 'ok' ? parsed.state : null;

	return (
		<PixelModal title='Save & Backup' size='sm' onClose={close}>
			<div className='px-card mb-3 text-sm'>
				<div className='text-[#ecdcb4]'>
					Autosaved in this browser: <span className='text-green-400'>{ago(info?.savedAt ?? null)}</span>
					{info && info.bytes > 0 && <span className='text-[#a89878]'> ({Math.max(1, Math.round(info.bytes / 1024))} KB)</span>}
				</div>
				{info?.persisted === true && <div className='text-xs text-green-400'>Browser storage is protected from clean-up.</div>}
				{info?.persisted === false && (
					<div className='text-xs text-amber-300'>
						The browser may clear this save if space runs low. Copy it below now and then.
					</div>
				)}
				{info?.error && (
					<div className='text-xs text-red-400'>
						The browser refuses to store the save ({info.error === 'full' ? 'storage full' : 'storage blocked'}). Copy it
						below to keep your progress.
					</div>
				)}
			</div>

			{info?.loadProblem && (
				<div className='px-card mb-3 text-sm'>
					<div className='text-amber-300'>{info.loadProblem}</div>
					{getDamagedSave() && (
						<button className='px-btn px-btn-sm mt-2' onClick={copyDamaged}>
							Copy damaged save
						</button>
					)}
				</div>
			)}

			{note && <div className='px-card mb-3 text-sm text-green-400'>{note}</div>}

			{confirmReset ? (
				<div className='px-card mb-3 text-sm'>
					<div className='px-h'>Delete all progress?</div>
					<div className='text-[#d8c8a0] mb-3'>This cannot be undone. Copy your save first if you might want it back.</div>
					<div className='flex justify-between'>
						<button className='px-btn' disabled={busy} onClick={() => setConfirmReset(false)}>
							Cancel
						</button>
						<button className='px-btn px-btn-red' disabled={busy} onClick={confirmResetGame}>
							Delete and restart
						</button>
					</div>
				</div>
			) : (
				<>
					<div className='px-card mb-3 text-sm'>
						<div className='px-h'>Export</div>
						<p className='text-[#a89878] mb-2'>Your whole game as one line of text. Paste it back here to restore it, on this or another browser.</p>
						<textarea
							ref={exportRef}
							readOnly
							rows={3}
							value={exportText}
							onFocus={(e) => e.currentTarget.select()}
							aria-label='Save text'
							className='px-input text-xs break-all resize-none mb-2'
						/>
						<div className='flex gap-2'>
							<button className='px-btn px-btn-sm' onClick={handleCopy}>
								Copy
							</button>
							<button className='px-btn px-btn-sm' onClick={handleDownload}>
								Download file
							</button>
						</div>
					</div>

					<div className='px-card mb-3 text-sm'>
						<div className='px-h'>Import</div>
						<textarea
							rows={3}
							value={importText}
							onChange={(e) => setImportText(e.target.value)}
							placeholder='Paste a save here (IDLZ2.…)'
							aria-label='Paste a save'
							className='px-input text-xs break-all resize-none mb-2'
						/>
						<button className='px-btn px-btn-sm' disabled={busy} onClick={() => fileRef.current?.click()}>
							Open file…
						</button>
						<input ref={fileRef} type='file' accept='.sav,.txt,text/plain' className='hidden' onChange={handleFile} />

						{parsed.kind === 'error' && <div className='text-red-400 mt-2'>{parsed.reason}</div>}
						{ok && (
							<div className='mt-3'>
								<div className='px-h'>Replace current progress?</div>
								<div className='text-[#d8c8a0] mb-3'>
									Level {ok.level.level}, castle {ok.tiles[GRID_CENTER_Y][GRID_CENTER_X].level ?? 1}, {countOwnedTiles(ok.tiles)} tiles,{' '}
									{formatTime(ok.playSeconds)} played
									{parsed.kind === 'ok' && parsed.savedAt ? `, saved ${new Date(parsed.savedAt).toLocaleString()}` : ''}.
								</div>
								<div className='flex justify-between'>
									<button className='px-btn px-btn-red' disabled={busy} onClick={() => setImportText('')}>
										Cancel
									</button>
									<button className='px-btn' disabled={busy} onClick={confirmImport}>
										Import and reload
									</button>
								</div>
							</div>
						)}
					</div>

					<button className='px-btn px-btn-red w-full' disabled={busy} onClick={() => setConfirmReset(true)}>
						Reset game
					</button>
				</>
			)}
		</PixelModal>
	);
};

const SaveMenuDialog: React.FC = () => {
	const open = useUiStore((state) => state.saveMenuOpen);
	return open ? <SaveDialogBody /> : null;
};

export default SaveMenuDialog;
