/**
 * Node 18 native fetch + cheerio + fs-extra
 * Scrapes Letterboxd diary and enriches posters from TMDb
 */

const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');

const USERNAME = 'vkworkofficial';
const OUT_FILE = path.join(__dirname, 'public', `${USERNAME}-movies.json`);
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// Throttled fetch
async function pfetch(url) {
  await new Promise(r => setTimeout(r, 300)); // avoid too many requests
  const res = await fetch(url); // Node 18 native fetch
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

// Scrape first page of Letterboxd diary
async function scrapeDiaryPage() {
  const url = `https://letterboxd.com/${USERNAME}/films/page/1/`;
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

  return entries;
}

// Search TMDb for poster
async function tmdbSearch(title) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await (await pfetch(url)).json();
  return res.results?.[0] || null;
}

// Enrich each entry with poster
async function enrich(entries) {
  const enriched = [];
  for (const e of entries) {
    const tm = await tmdbSearch(e.title);
    enriched.push({
      ...e,
      posterUrl: tm?.poster_path ? `${TMDB_IMAGE_BASE}${tm.poster_path}` : null,
    });
  }
  return enriched;
}

// Main function
(async () => {
  try {
    await fs.ensureDir(path.join(__dirname, 'public'));
    console.log('Scraping Letterboxd...');
    const entries = await scrapeDiaryPage();
    console.log(`Found ${entries.length} movies. Enriching with TMDb...`);
    const enriched = await enrich(entries);
    await fs.writeJson(OUT_FILE, enriched, { spaces: 2 });
    console.log(`JSON written to ${OUT_FILE}`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
