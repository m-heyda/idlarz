// The longer story of the legendary weapons (IDL-317): one short paragraph each, shown in the item tooltip under the flavour line and in full in the Glossary. Draft text, for the owner to approve. Keyed by item id so the item
// definitions stay as they are; `ItemDef.lore` is filled from here in `catalog/items/index.ts`.
export const LEGENDARY_LORE: Record<string, string> = {
	emberbrand:
		'The smith who forged it asked the dying star for one favour: stay warm. The star kept its word. Every wielder since has complained about the heat, and not one has put it down.',
	starfall_bow:
		'Nobody strings it. The string appears when you reach for it, humming a tune you almost remember. Archers who hit the moon with it get a very awkward letter from the moon.',
	titan_maul:
		'A titan used it to knock on mountains. The mountains always opened up. The titan never learned the word "doorbell", and neither will you after swinging it.',
	runeforged_titanhammer:
		'The runes glow blue when you are right and pink when you are wrong. It has been pink since the day you picked it up, and it has opinions about your build.',
	cindercrescent_glaive:
		'Cut from a burnt-out moon, still smouldering at the edge. Walk past a haystack with it and you will have to explain yourself to a very angry farmer.',
	frostbloom_fan:
		'One gentle wave and flowers of ice bloom on the target. It is the only weapon in the realm that has ever been used to cool soup, and it works fine for that too.',
	voidrune_blade:
		'The runes rearrange themselves while you sleep, and each morning the sword says something ruder about the dark. Do not let it read your diary.',
	reapers_crescent:
		'It does not harvest wheat. It tried once and was very embarrassed. The crimson on the blade is only rust, it insists, and it will not discuss the rest.',
	nightfall_edge:
		'The blade is a slice cut out of the night sky, stars and all. Hold it up on a clear evening and one of them winks. Do not wink back; it gets ideas.',
	tidecaller_axe: 'Swing it twice and the tide comes in. Swing it three times and the tide asks to speak to a manager. Smells faintly of fish at all hours.',
	stormtrident: 'The lightning between the tines is on loan from a storm that wants it back. Until it does, enjoy the free thunder and keep clear of puddles.',
	amethyst_spire:
		'Five crystals orbit the head and they bicker constantly about who is the brightest. The staff stays out of it, which is why it is the wisest thing you own.',
	dawnbringer_trident: 'It was forged at the exact moment the sun came up, and it has never forgiven anyone for oversleeping. It hums at dawn. Loudly.',
	cinderflight_bow: 'Arrows leave it already on fire and arrive already forgiven. Bring a bucket, and a friend with a bucket, and a second friend to explain.',
};
