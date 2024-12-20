import fs from 'node:fs/promises';
import { deflate } from 'zlib';
import 'colors';

const VERIFY_AGAINST_VERSION = '4';

const deflateContent = content =>
  new Promise((resolve, reject) =>
    deflate(content, (error, out) => (error ? reject(error) : resolve(out)))
  );

const space = (n, s) =>
  new Array(Math.max(0, 10 + n - (s || '').length)).join(' ') + (s || '');

const bytes = b =>
  `${b.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} bytes`;

const diff = (n, o) => {
  const d = n - o;
  return d === 0 ? '' : d < 0 ? ` ${bytes(d)}`.green : ` +${bytes(d)}`.red;
};

const percentage = (s, b) => ` ${Math.floor(10000 * (1 - s / b)) / 100}%`.grey;

let bundlephobaInfoCache;

async function bundlephobaInfo(key) {
  if (!bundlephobaInfoCache) {
    try {
      const res = await fetch(
        `https://bundlephobia.com/api/size?package=immutable@${VERIFY_AGAINST_VERSION}`
      );

      if (res.status !== 200) {
        throw new Error(
          `Unable to fetch bundlephobia in dist-stats.mjs. Status code is "${res.status}"`
        );
      }

      bundlephobaInfoCache = await res.json();
    } catch (err) {
      console.error(err.message);

      throw err;
    }
  }

  return bundlephobaInfoCache[key];
}

Promise.allSettled([
  fs.readFile('dist/immutable.js'),
  fs.readFile('dist/immutable.min.js'),
  bundlephobaInfo('size'),
  fs.readFile('dist/immutable.min.js').then(deflateContent),
  bundlephobaInfo('gzip'),
])
  .then(results =>
    results.map(result =>
      typeof (result === null || result === 'number')
        ? result
        : Number(Buffer.byteLength(result, 'utf8'))
    )
  )
  .then(([rawNew, minNew, minOld, zipNew, zipOld]) => {
    console.log(`  Raw: ${space(14, bytes(rawNew.value).cyan)}`);
    if (minOld.status === 'fulfilled') {
      console.log(
        `  Min: ${space(14, bytes(minNew.value).cyan)}${percentage(
          minNew.value,
          rawNew.value
        )}${space(15, diff(minNew.value, minOld.value))}`
      );
    }

    if (zipOld.status === 'fulfilled') {
      console.log(
        `  Zip: ${space(14, bytes(zipNew.value).cyan)}${percentage(
          zipNew.value,
          rawNew.value
        )}${space(15, diff(zipNew.value, zipOld.value))}`
      );
    }
  });
