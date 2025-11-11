const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');

const USERNAME = 'vkworkofficial';
const OUT_FILE = 'vkworkofficial-movies.json';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

async function scrapeDiary() {
  const res = await fetch(`https://letterboxd.com/${USERNAME}/films/page/1/`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const entries = [];
  $('.poster-list .film-poster').each((i, el) => {
    const link = $(el).find('a').attr('href');
    const title = $(el).find('img').attr('alt');
    entries.push({
      title: title.trim(),
      letterboxdUrl: link ? `https://letterboxd.com${link}` : null
    });
  });
  return entries;
}

async function tmdbSearch(title) {
  const url = `${TMDB_BASE}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results?.[0] || null;
}

async function main() {
  const entries = await scrapeDiary();
  const enriched = [];
  for (const e of entries) {
    const tm = await tmdbSearch(e.title);
    enriched.push({
      ...e,
      posterUrl: tm?.poster_path ? `${TMDB_IMAGE_BASE}${tm.poster_path}` : null
    });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(enriched, null, 2));
  console.log('JSON created:', OUT_FILE);
}

main();
