import { scrapeProductPage } from './packages/api/dist/lib/scraper.js';
scrapeProductPage('https://blackeagletest.myshopify.com/products/gift-card').then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
