import test from 'node:test';
import assert from 'node:assert/strict';
import { PETS, isPetId, petById } from '../../src/catalog/pets';
import { PET_RANGE, nextWanderStep, pickPetPhrase, startWander, type WanderPos } from '../../src/lib/pets';
import { emptyLegacy, isEmptyLegacy, legacyFromJson, newLedger, resetLedger } from '../../src/lib/offline/ledger';
import { applyPets } from '../../src/lib/offline/pets';
import { PET_LETTERS } from '../../src/lib/offline/petLetters';

const HER = 'b916a20c-ee77-46d0-a4ba-a870da774b60';
const SOMEONE = '11111111-2222-3333-4444-555555555555';

/** A random source that walks through a fixed list, then repeats it. */
const seq = (values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

test('the catalog: Yuki exists, ids are unique, every pet has phrases and a letter slot only on the server', () => {
	assert.ok(isPetId('yuki'));
	assert.ok(!isPetId('nope'));
	assert.equal(petById('yuki')?.name, 'Yuki');
	assert.equal(new Set(PETS.map((pet) => pet.id)).size, PETS.length);
	for (const pet of PETS) assert.ok(pet.speech.length >= 5, pet.id);
	assert.ok(petById('yuki')?.speech.includes("Woow! We're getting a bigger kingdom! Nie!"));
	// the letter text must not be in the browser bundle's catalog
	assert.ok(!JSON.stringify(PETS).includes('Weroniko'));
});

test('applyPets grants the special pet to the configured account once and shows its letter', () => {
	const first = applyPets(newLedger(0), HER, { action: 'sync' }, HER);
	assert.deepEqual(first.reply.owned, ['yuki']);
	assert.equal(first.reply.letter?.petId, 'yuki');
	assert.equal(first.reply.letter?.pl.button, 'Przytul Yukiego');
	assert.equal(first.reply.letter?.en.button, 'Hug Yuki');
	assert.deepEqual(first.ledger.legacy.pets, ['yuki']);

	// idempotent: syncing again changes nothing and grants no second copy
	const again = applyPets(first.ledger, HER, { action: 'sync' }, HER);
	assert.deepEqual(again.ledger.legacy.pets, ['yuki']);
	assert.equal(again.ledger, first.ledger);
	assert.equal(again.reply.letter?.petId, 'yuki');
});

test('the letter is shown until it is closed, then never again', () => {
	const granted = applyPets(newLedger(0), HER, { action: 'sync' }, HER).ledger;
	const closed = applyPets(granted, HER, { action: 'ack', id: 'yuki' }, HER);
	assert.equal(closed.reply.letter, null);
	assert.deepEqual(closed.reply.owned, ['yuki']);
	assert.deepEqual(closed.ledger.legacy.letters, ['yuki']);
	// a later login: still owns the pet, no letter, nothing written
	const later = applyPets(closed.ledger, HER, { action: 'sync' }, HER);
	assert.equal(later.reply.letter, null);
	assert.equal(later.ledger, closed.ledger);
	// closing twice records it once
	assert.deepEqual(applyPets(closed.ledger, HER, { action: 'ack', id: 'yuki' }, HER).ledger.legacy.letters, ['yuki']);
});

test('any other account gets no pet, no letter and no trace', () => {
	const ledger = newLedger(0);
	const sync = applyPets(ledger, SOMEONE, { action: 'sync' }, HER);
	assert.deepEqual(sync.reply, { owned: [], letter: null });
	assert.equal(sync.ledger, ledger);
	// a forged close for a pet they do not own records nothing
	const ack = applyPets(ledger, SOMEONE, { action: 'ack', id: 'yuki' }, HER);
	assert.equal(ack.ledger, ledger);
	assert.deepEqual(ack.reply, { owned: [], letter: null });
	// nobody is granted anything while the server has no id configured
	const unset = applyPets(ledger, SOMEONE, { action: 'sync' }, '');
	assert.deepEqual(unset.reply, { owned: [], letter: null });
	assert.equal(applyPets(ledger, '', { action: 'sync' }, '').ledger, ledger);
});

test('the letter texts are the approved ones', () => {
	const letter = PET_LETTERS.yuki;
	assert.equal(letter.pl.title, 'Mała niespodzianka dla Ciebie 🐾');
	assert.equal(letter.en.title, 'A little something for you 🐾');
	assert.equal(letter.pl.body.length, 5);
	assert.equal(letter.en.body.length, 5);
	assert.ok(letter.pl.body[0].startsWith('Cześć, Weroniko'));
	assert.ok(letter.en.body[0].startsWith('Hi Weronika'));
});

test('the pets and the letter survive a New Game, and the stored column is read tolerantly', () => {
	const granted = applyPets(newLedger(0), HER, { action: 'sync' }, HER).ledger;
	const closed = applyPets(granted, HER, { action: 'ack', id: 'yuki' }, HER).ledger;
	const reset = resetLedger(closed, 1000);
	assert.deepEqual(reset.legacy.pets, ['yuki']);
	assert.deepEqual(reset.legacy.letters, ['yuki']);
	assert.deepEqual(reset.legacy.idols, {});
	// a ledger without pets resets to an empty legacy, as before
	assert.ok(isEmptyLegacy(resetLedger(newLedger(0), 1000).legacy));

	assert.ok(isEmptyLegacy(emptyLegacy()));
	assert.ok(!isEmptyLegacy({ idols: {}, pets: ['yuki'] }));
	// old rows (idols only) and junk read as before
	assert.deepEqual(legacyFromJson({ idols: { forest: 2 } }), { idols: { forest: 2 } });
	assert.deepEqual(legacyFromJson({ idols: {}, pets: 'yuki', letters: [1, null, {}] }), { idols: {} });
	assert.deepEqual(legacyFromJson({ idols: {}, pets: ['yuki', 'yuki', 7], letters: ['yuki'] }), { idols: {}, pets: ['yuki'], letters: ['yuki'] });
	assert.deepEqual(legacyFromJson(null), { idols: {} });
});

test('an unknown pet id stored in the ledger is never reported as owned', () => {
	const ledger = { ...newLedger(0), legacy: { idols: {}, pets: ['yuki', 'from-a-newer-build'] } };
	assert.deepEqual(applyPets(ledger, SOMEONE, { action: 'sync' }, HER).reply.owned, ['yuki']);
});

test('nextWanderStep: one step at a time, always near the castle, faces the way it walks', () => {
	let pos: WanderPos = startWander();
	const rng = seq([0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.99, 0.0, 0.6, 0.45]);
	for (let i = 0; i < 2000; i++) {
		const next = nextWanderStep(pos, rng);
		assert.ok(Math.abs(next.x - pos.x) <= 1 && Math.abs(next.y - pos.y) <= 1, 'one step');
		assert.ok(next.x !== pos.x || next.y !== pos.y, 'it moves');
		assert.ok(Math.abs(next.x) <= PET_RANGE && Math.abs(next.y) <= PET_RANGE, 'stays in range');
		if (next.x < pos.x) assert.equal(next.facing, 'left');
		if (next.x > pos.x) assert.equal(next.facing, 'right');
		if (next.x === pos.x) assert.equal(next.facing, pos.facing);
		pos = next;
	}
	// at the edge a step outwards is turned back in
	const edge = nextWanderStep({ x: PET_RANGE, y: -PET_RANGE, facing: 'right' }, seq([0.99, 0.0]));
	assert.deepEqual([edge.x, edge.y], [PET_RANGE - 1, -PET_RANGE + 1]);
});

test('pickPetPhrase: never the last phrase, every other one reachable, nothing to say gives -1', () => {
	const phrases = ['a', 'b', 'c', 'd'];
	for (let last = -1; last < phrases.length; last++) {
		const seen = new Set<number>();
		for (let step = 0; step < 100; step++) {
			const index = pickPetPhrase(phrases, last, () => step / 100);
			assert.ok(index >= 0 && index < phrases.length);
			assert.notEqual(index, last);
			seen.add(index);
		}
		assert.equal(seen.size, last === -1 ? 4 : 3);
	}
	assert.equal(pickPetPhrase([], -1, Math.random), -1);
	assert.equal(pickPetPhrase(['only'], 0, Math.random), 0);
});
