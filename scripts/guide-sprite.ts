/**
 * Draws Brother Alder's second frame, the one with the mouth open, from the one sprite the game has of him (`GUIDE_SPRITE`, 67x67). The result is a two-frame sprite sheet,
 * `public/pixel/guide/alder_talk.png` (134x67: closed mouth | open mouth), which the guide's bubble alternates while the text is being typed. No library and no smoothing: the PNG is read
 * and written here with `zlib`, every pixel outside the mouth is copied unchanged, and the same input always gives the same bytes.
 *
 *   npx tsx scripts/guide-sprite.ts          write the sheet
 *   npx tsx scripts/guide-sprite.ts --check  exit 1 when the sheet on disk is not what this would write (also when the mouth cannot be found)
 *
 * The mouth is the small band of pinkish pixels inside the beard, below the moustache (`MOUTH_BOX`); when it cannot be found reliably the script stops with an error and the bubble falls
 * back to a 1 px bob of the head (the sheet is then not needed: see `GuideBubble`).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = resolve(__dirname, '..');
const SOURCE = join(ROOT, 'public', 'pixel', 'reuse', 'misc', 'sprite-fusion-374f7430-0e77-437e-8e6a-a0f4c6ac3332.png');
export const SHEET = join(ROOT, 'public', 'pixel', 'guide', 'alder_talk.png');

/** Where the mouth can be: inside the beard, x and y in sprite pixels (inclusive) */
const MOUTH_BOX = { x0: 32, x1: 42, y0: 13, y1: 19 };
/** The closed mouth is a pinkish band, a different colour from the cheeks above it (light) and the beard around it (brown) */
const isMouthColour = (r: number, g: number, b: number) => r >= 180 && g >= 105 && g <= 155 && b >= 90 && b <= 140 && r - g >= 55;
/** What the open mouth is drawn with: the dark inside of the mouth and the lip edge */
const INSIDE: [number, number, number] = [58, 10, 8];
const EDGE: [number, number, number] = [96, 24, 18];

interface Image {
	width: number;
	height: number;
	/** RGBA, 4 bytes per pixel */
	data: Uint8Array;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf: Buffer): number => {
	let c = 0xffffffff;
	for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};

/** Reads an 8-bit RGBA, non-interlaced PNG (what the sprite is); anything else is refused. */
export const decodePng = (file: Buffer): Image => {
	if (!file.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
	const width = file.readUInt32BE(16);
	const height = file.readUInt32BE(20);
	if (file[24] !== 8 || file[25] !== 6 || file[28] !== 0) throw new Error('only 8-bit RGBA, non-interlaced PNGs are supported');
	const idat: Buffer[] = [];
	for (let o = 8; o < file.length; ) {
		const length = file.readUInt32BE(o);
		if (file.toString('latin1', o + 4, o + 8) === 'IDAT') idat.push(file.subarray(o + 8, o + 8 + length));
		o += 12 + length;
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * 4;
	const data = new Uint8Array(stride * height);
	for (let y = 0; y < height; y++) {
		const filter = raw[y * (stride + 1)];
		const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
		for (let x = 0; x < stride; x++) {
			const left = x >= 4 ? data[y * stride + x - 4] : 0;
			const up = y > 0 ? data[(y - 1) * stride + x] : 0;
			const upLeft = y > 0 && x >= 4 ? data[(y - 1) * stride + x - 4] : 0;
			let predictor = 0;
			if (filter === 1) predictor = left;
			else if (filter === 2) predictor = up;
			else if (filter === 3) predictor = (left + up) >> 1;
			else if (filter === 4) {
				const p = left + up - upLeft;
				const pa = Math.abs(p - left);
				const pb = Math.abs(p - up);
				const pc = Math.abs(p - upLeft);
				predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
			}
			data[y * stride + x] = (line[x] + predictor) & 0xff;
		}
	}
	return { width, height, data };
};

const chunk = (type: string, body: Buffer): Buffer => {
	const head = Buffer.alloc(8);
	head.writeUInt32BE(body.length, 0);
	head.write(type, 4, 'latin1');
	const tail = Buffer.alloc(4);
	tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
	return Buffer.concat([head, body, tail]);
};

/** Writes an 8-bit RGBA PNG with no filtering (deterministic bytes). */
export const encodePng = (image: Image): Buffer => {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(image.width, 0);
	ihdr.writeUInt32BE(image.height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	const stride = image.width * 4;
	const raw = Buffer.alloc((stride + 1) * image.height);
	for (let y = 0; y < image.height; y++) Buffer.from(image.data.buffer, image.data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
	return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const at = (img: Image, x: number, y: number) => {
	const i = (y * img.width + x) * 4;
	return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]] as const;
};

/** The pixels of the closed mouth: the pinkish ones inside `MOUTH_BOX`. Throws when they are not one short horizontal band (2 to 6 pixels wide, one or two rows). */
export const findMouth = (img: Image): { x: number; y: number }[] => {
	const found: { x: number; y: number }[] = [];
	for (let y = MOUTH_BOX.y0; y <= MOUTH_BOX.y1; y++)
		for (let x = MOUTH_BOX.x0; x <= MOUTH_BOX.x1; x++) {
			const [r, g, b, a] = at(img, x, y);
			if (a === 255 && isMouthColour(r, g, b)) found.push({ x, y });
		}
	const xs = found.map((p) => p.x);
	const ys = found.map((p) => p.y);
	const wide = found.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0;
	const high = found.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
	if (found.length < 2 || found.length > 8 || wide < 2 || wide > 6 || high > 2)
		throw new Error(`cannot find the mouth reliably (${found.length} pinkish pixels, ${wide} x ${high})`);
	return found;
};

/** The sprite with the mouth open: the closed mouth's row becomes the lip edge, and the row under its inner pixels the dark inside. */
export const openMouth = (img: Image): Image => {
	const mouth = findMouth(img);
	const out: Image = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
	const set = (x: number, y: number, c: readonly [number, number, number]) => {
		const i = (y * img.width + x) * 4;
		out.data.set([c[0], c[1], c[2], 255], i);
	};
	const left = Math.min(...mouth.map((p) => p.x));
	const right = Math.max(...mouth.map((p) => p.x));
	const top = Math.min(...mouth.map((p) => p.y));
	for (let x = left; x <= right; x++) set(x, top, x === left || x === right ? EDGE : INSIDE);
	for (let x = left + 1; x <= right - 1; x++) set(x, top + 1, INSIDE);
	if (right - left < 2) set(left, top + 1, INSIDE);
	return out;
};

/** The two-frame sheet: the original on the left, the open-mouth frame on the right. */
export const buildSheet = (img: Image): Image => {
	const open = openMouth(img);
	const sheet: Image = { width: img.width * 2, height: img.height, data: new Uint8Array(img.width * 2 * img.height * 4) };
	for (let y = 0; y < img.height; y++) {
		sheet.data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), y * sheet.width * 4);
		sheet.data.set(open.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), (y * sheet.width + img.width) * 4);
	}
	return sheet;
};

if (require.main === module) {
	const bytes = encodePng(buildSheet(decodePng(readFileSync(SOURCE))));
	if (process.argv.includes('--check')) {
		const same = existsSync(SHEET) && readFileSync(SHEET).equals(bytes);
		if (!same) {
			console.error('public/pixel/guide/alder_talk.png is out of date: run npx tsx scripts/guide-sprite.ts');
			process.exit(1);
		}
		console.log('guide sprite sheet is up to date');
	} else {
		mkdirSync(dirname(SHEET), { recursive: true });
		writeFileSync(SHEET, bytes);
		console.log(`wrote ${SHEET} (${bytes.length} bytes)`);
	}
}
