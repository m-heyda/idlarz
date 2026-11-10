import { useCallback, useEffect, useState } from 'react';
import { copyText } from './clipboard';

const KEY = 'idlarz-asset-trash';

const load = (): Record<string, true> => {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}');
	} catch {
		return {};
	}
};

/**
 * "Trash" marks shared by every asset gallery and review story. A mark is the asset's repo path (`/pixel/...` under public/, or `art_style_reference/...`) and lives
 * in this browser's localStorage, so the owner can flip through all of Storybook marking what to delete, then copy the list (`copyList`) and hand it over.
 */
export const useTrashMarks = () => {
	const [marks, setMarks] = useState<Record<string, true>>({});
	useEffect(() => setMarks(load()), []);
	const toggle = useCallback((path: string) => {
		setMarks((prev) => {
			const next = { ...prev };
			if (next[path]) delete next[path];
			else next[path] = true;
			try {
				localStorage.setItem(KEY, JSON.stringify(next));
			} catch {}
			return next;
		});
	}, []);
	const list = Object.keys(marks).sort();
	/** what the last copy did, for the button label (empty until the first click) */
	const [status, setStatus] = useState('');
	const copyList = async () => {
		setStatus((await copyText(list.map((p) => `- ${p}`).join('\n'))) ? `copied ${list.length}` : 'copy failed');
		setTimeout(() => setStatus(''), 2500);
	};
	return { marks, toggle, list, copyList, status };
};
