# Managing Products

Products are the foundation of Recete's AI responses. The AI uses product information to answer customer questions accurately.

## Adding Products

### Method 1: Manual Entry

1. Go to "Products" → "Add Product"
2. Enter:
   - **Product Name**: Display name
   - **Product URL**: Link to product page
3. Click "Save"

### Method 2: Bulk Import (Coming Soon)

Import multiple products via CSV file.

## Scraping Product Information

After adding a product, you need to scrape its content:

1. Go to "Products" → Select a product
2. Click "Scrape Product"
3. Wait for processing (usually 5-10 seconds)
4. Review scraped content:
   - Title
   - Description
   - Usage instructions
   - Ingredients/Specifications
   - Images

### What Gets Scraped

Recete extracts:
- Product title (from meta tags or HTML)
- Description (from meta description or content)
- Usage instructions (from product page content)
- Images (from Open Graph or meta tags)
- Price (if available)

### Scraping Best Practices

1. **Ensure Product Page is Public**: The scraper needs to access the page
2. **Use Clean URLs**: Avoid session IDs or tracking parameters
3. **Check Results**: Review scraped content for accuracy
4. **Re-scrape When Needed**: Update product info by re-scraping

## Generating Embeddings

After scraping, generate embeddings to enable AI responses:

1. Go to "Products" → Select a product
2. Click "Generate Embeddings"
3. Wait for processing (may take 30-60 seconds)
4. You'll see:
   - Number of chunks created
   - Total tokens used

### What Are Embeddings?

Embeddings are vector representations of your product content. They allow the AI to:
- Find relevant product information quickly
- Answer questions accurately
- Provide context-aware responses

### Embedding Process

1. **Chunking**: Product content is split into smaller pieces (1000 chars each)
2. **Embedding**: Each chunk is converted to a vector (1536 dimensions)
3. **Storage**: Vectors are stored in the database for fast retrieval

### When to Re-generate Embeddings

- Product information changes significantly
- Usage instructions are updated
- New features are added
- After bulk content updates

## Managing Products

### View All Products

Go to "Products" to see:
- Product name
- URL
- Scraped status (✅ or ⏳)
- Embeddings status (✅ or ⏳)
- Last updated date

### Edit Product

1. Click on a product
2. Update name or URL
3. Click "Save"
4. Re-scrape if URL changed

### Delete Product

1. Go to "Products"
2. Click on a product
3. Click "Delete"
4. Confirm deletion

**Warning**: Deleting a product will also delete:
- Scraped content
- Embeddings
- Knowledge base chunks

## Product Best Practices

### 1. Complete Product Information

Ensure your product pages have:
- Clear product title
- Detailed description
- Usage instructions
- Images with alt text

### 2. Keep Content Updated

- Re-scrape when product info changes
- Update embeddings after major changes
- Remove discontinued products

### 3. Organize Products

- Use descriptive product names
- Group related products
- Tag products (future feature)

### 4. Monitor Scraping Success

- Check scraped content quality
- Verify images are extracted
- Ensure instructions are complete

## Troubleshooting

### "Scraping Failed"

**Possible Causes:**
- Product page is not accessible
- Page requires authentication
- Page is blocked by robots.txt
- Network timeout

**Solutions:**
- Verify URL is publicly accessible
- Check if page loads in browser
- Try re-scraping after a few minutes
- Contact support if issue persists

### "Embeddings Generation Failed"

**Possible Causes:**
- No scraped content available
- Content is too short
- OpenAI API error

**Solutions:**
- Scrape product first
- Ensure content is meaningful (not just "Product Name")
- Check OpenAI API key is valid
- Try again later

### "Product Not Found in AI Responses"

**Possible Causes:**
- Embeddings not generated
- Product not linked to order
- Similarity threshold too high

**Solutions:**
- Generate embeddings for the product
- Ensure product is in order (if using order context)
- Check RAG query settings

---

## Advanced: Bulk Operations

### Bulk Scrape

1. Go to "Products"
2. Select multiple products (checkbox)
3. Click "Bulk Scrape"
4. Wait for all products to be processed

### Bulk Generate Embeddings

1. Go to "Products"
2. Select products with scraped content
3. Click "Bulk Generate Embeddings"
4. Monitor progress

**Note**: Bulk operations may take time depending on number of products.

---

## Need Help?

- **API Documentation**: `/api/docs`
- **Support**: support@recete.co.uk
