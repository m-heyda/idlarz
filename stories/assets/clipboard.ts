/**
 * Copy text from a Storybook story. `navigator.clipboard` is missing or refused in some embedded browsers and iframes, so this falls back to a hidden textarea
 * and `document.execCommand('copy')`, and as a last resort to a prompt the owner can copy from. Resolves true when the text reached the clipboard.
 */
export const copyText = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
		document.body.appendChild(area);
		area.focus();
		area.select();
		const ok = document.execCommand('copy');
		area.remove();
		if (ok) return true;
	} catch {}
	window.prompt('Copy with Ctrl+C:', text);
	return false;
};
