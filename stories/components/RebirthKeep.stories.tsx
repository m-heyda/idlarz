import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import RebirthConfirmModal, { LegendaryPicker, type KeepCandidate } from '@/components/game/overlays/RebirthConfirmModal';
import { LEGENDARY_ITEMS } from '@/catalog/items/legendary';
import { plainItem } from '@/lib/itemInstance';
import type { ItemInstance } from '@/types/game';

// The rebirth confirmation and the "select legendary to keep" step. Pure props, no login needed.
const meta = { title: 'Screens/Rebirth keep', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const piece = (i: number): ItemInstance => ({ ...plainItem(LEGENDARY_ITEMS[i % LEGENDARY_ITEMS.length].id), rarity: 'legendary' });
const owned = (n: number): KeepCandidate[] =>
	Array.from({ length: n }, (_, i) => ({
		ref: i === 0 ? { from: 'equip' as const, slot: 'mainHand' as const } : { from: 'bag' as const, index: i },
		item: piece(i),
	}));
const noop = () => undefined;

const props = { gain: 180, incomeText: '+14%', unlockLabel: 'The Ashen Marches (x2 output)', asking: false, onCancel: noop, onConfirm: noop };

/** Step 1: what is lost and what is kept. */
export const Confirm: Story = { render: () => <RebirthConfirmModal {...props} slots={3} candidates={owned(4)} /> };

/** Step 1 for a player with no legendary: the button rebirths at once. */
export const ConfirmNoLegendary: Story = { render: () => <RebirthConfirmModal {...props} slots={1} candidates={[]} /> };

/** The minibag of owned legendaries. */
export const Picker: Story = { render: () => <LegendaryPicker candidates={owned(5)} onPick={noop} onClose={noop} /> };
