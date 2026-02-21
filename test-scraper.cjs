const { scrapeProductPage } = require('./packages/api/dist/lib/scraper.js');

(async () => {
  const res = await scrapeProductPage('https://blackeagletest.myshopify.com/products/gift-card');
  console.log('--- raw content length ---');
  console.log(res.product?.rawContent?.length);
  console.log('--- raw content sample ---');
  console.log(res.product?.rawContent);
})();
