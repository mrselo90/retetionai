const { scrapeProductPage } = require('./packages/api/dist/lib/scraper.js');

(async () => {
  const res = await scrapeProductPage('https://maruderm.hu/products/maruderm-cica-spf15-szinkorrekcios-krem-30ml');
  console.log('--- success ---');
  console.log(res.success);
  console.log('--- product ---');
  console.log(JSON.stringify(res.product, null, 2));
})();
