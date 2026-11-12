// SERVER ONLY. The welcome letters that come with a special pet. They are kept out of `src/catalog/pets.ts` (which is in the browser bundle for everyone) so the text reaches only the account it is for: `applyPets` puts a letter in the answer for the account that was granted the pet, nobody else.

export interface PetLetterText {
	title: string;
	/** One paragraph per entry */
	body: string[];
	button: string;
}

export interface PetLetter {
	pl: PetLetterText;
	en: PetLetterText;
}

/** The letter of each pet that has one, by pet id. Append only. */
export const PET_LETTERS: Readonly<Record<string, PetLetter>> = {
	yuki: {
		pl: {
			title: 'Mała niespodzianka dla Ciebie 🐾',
			button: 'Przytul Yukiego',
			body: [
				'Cześć, Weroniko,',
				'Dziś rano pod bramą zamku siedział ktoś, kto merdał ogonem i czekał na Ciebie.',
				'Ma na imię Yuki. Jest mały, czarny, bardzo poważnie traktuje swoją czerwoną chustkę i już postanowił, że jesteś jego ulubioną osobą w całym królestwie.',
				'Zrobiłem go specjalnie dla Ciebie. Nie umie walczyć, uprawiać pól ani robić niczego pożytecznego i właśnie o to chodzi: jego jedynym zadaniem jest dotrzymywać Ci towarzystwa, kiedy budujesz swój zamek. Jeśli zobaczysz, jak się gdzieś kręci, pewnie pilnuje czegoś ważnego. Pewnie motyla.',
				'Dziękuję, że grasz i że znosisz mnie przy tworzeniu tej gry. Jesteś moją ulubioną graczką i zawsze nią będziesz. 💛',
			],
		},
		en: {
			title: 'A little something for you 🐾',
			button: 'Hug Yuki',
			body: [
				'Hi Weronika,',
				'Somebody was sitting at the castle gate this morning, wagging his tail and waiting for you.',
				"His name is Yuki. He's small, black, very serious about his red bandana, and he has already decided you're his favourite person in the whole kingdom.",
				"I made him just for you. He can't fight or farm or do anything useful, and that's the point: his one job is to keep you company while you build your castle. If you spot him wandering around, he's probably guarding something important. Probably a butterfly.",
				"Thank you for playing and for putting up with me while I made this game. You're my favourite player, and you always will be. 💛",
			],
		},
	},
};
