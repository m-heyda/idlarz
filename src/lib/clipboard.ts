/** Copies text to the clipboard. Falls back to selecting `fallbackTarget` and the old copy command when the async API is refused. */
export const copyText = async (text: string, fallbackTarget: HTMLTextAreaElement | null = null): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		fallbackTarget?.select();
		try {
			return document.execCommand('copy');
		} catch {
			return false;
		}
	}
};
