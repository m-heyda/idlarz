import { useUiStore, type ToastTone } from '@/stores/uiStore';

/**
 * THE way to tell the player something short: a small notice at the top of the screen under the header for a couple of seconds ("Game saved", and in red a refusal such as "You need 490 more gems").
 * Several stack, and the same text twice in a row is one line with a counter. Call it from a component, a store or plain code alike (it reads the ui store, no hook needed).
 *
 * - `notify(text)` for news, `notify(text, 'error')` for a refusal or a failure.
 * - Do **not** add another inline red or grey one-line message to a window for something this short; call `notify` instead, and when you find a window that already does, move it here in the same change.
 * - The gem store already sends every refused purchase through it.
 *
 * @category Architecture/Notifications
 * @title Short notices (notify)
 */
export const notify = (text: string, tone: ToastTone = 'info'): void => useUiStore.getState().showToast(text, tone);
