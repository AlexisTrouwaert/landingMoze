import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';

const DIR = 'public/assets/images/medias';

const files = await readdir(DIR);
const targets = files.filter(f => /\.(png|jpe?g)$/i.test(f));

console.log(`Found ${targets.length} files to convert in ${DIR}`);

for (const file of targets) {
  const inPath = join(DIR, file);
  const outPath = join(DIR, parse(file).name + '.webp');
  const before = (await stat(inPath)).size;

  await sharp(inPath)
    .webp({ quality: 90, effort: 6 })
    .toFile(outPath);

  const after = (await stat(outPath)).size;
  const saved = (((before - after) / before) * 100).toFixed(1);
  console.log(
    `  ${file.padEnd(45)}  ${(before / 1024).toFixed(1)}KB -> ${(after / 1024).toFixed(1)}KB  (${saved}% saved)`
  );
}

console.log('Done.');
