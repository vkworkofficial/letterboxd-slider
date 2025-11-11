/**
 * update-letterboxd.js
 * 
 * Scrapes Letterboxd diary and enriches with TMDb posters
 * Uses Node 18 native fetch, cheerio, fs-extra
 * Outputs JSON to public/vkworkofficial-movies.json
 */

const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const USERNAME = 'vkworkofficial';
const OUT_DIR = path.join(__dirname, 'public');
const OUT_FILE = path.join(OUT_DIR, `${USERNAME}-movies.json`);
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Node 18 native fetch wrapper with delay
async function pfetch(url) {
  await new Promise(r => setTimeout(r, 300)); // avoid throttling
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

// Scrape first page of Letterboxd diary
async function scrapeDiaryPage() {
  const url = `https://letterboxd.com/${USERNAME}/films/page/1/`;
  console.log(`Scraping ${url} ...`);
  const html = await (await pfetch(url)).text();
  const $ = cheerio.load(html);
  const entries = [];

  $('.poster-list .film-poster').each((i, el) => {
    const link = $(el).find('a').attr('href');
    const title = $(el).find('img').attr('alt');
    if (title) {
      entries.push({
        title: title.trim(),
        letterboxdUrl: link ? `https://letterboxd.com${link}` : null,
      });
    }
  });

  console.log(`Found ${entries.length} movies on Letterboxd page.`);
  return entries;
}

// Search TMDb for poster
async function tmdbSearch(title) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await (await pfetch(url)).json();
  return res.results?.[0] || null;
}

// Enrich entries with TMDb posters
async function enrich(entries) {
  const enriched = [];
  for (const e of entries) {
    const tm = await tmdbSearch(e.title);
    enriched.push({
      ...e,
      posterUrl: tm?.poster_path ? `${TMDB_IMAGE_BASE}${tm.poster_path}` : null,
    });
    console.log(`Enriched "${e.title}" with poster: ${tm?.poster_path ? '✅' : '❌'}`);
  }
  return enriched;
}

// Main function
(async () => {
  try {
    // Ensure output directory exists
    await fs.ensureDir(OUT_DIR);

    // Scrape Letterboxd
    const entries = await scrapeDiaryPage();

    if (entries.length === 0) {
      console.warn('No movies found on Letterboxd.');
      await fs.writeJson(OUT_FILE, [], { spaces: 2 });
      console.log(`Empty JSON written to ${OUT_FILE}`);
      return;
    }

    // Enrich with TMDb
    const enriched = await enrich(entries);

    // Write JSON output
    await fs.writeJson(OUT_FILE, enriched, { spaces: 2 });
    console.log(`✅ JSON successfully written to ${OUT_FILE}`);
    console.log('Sample output:', enriched.slice(0, 3)); // show first 3 movies for debugging

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
