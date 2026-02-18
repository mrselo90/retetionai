# Recipe Mapping User Guide

## Overview

Recipe mapping allows you to customize AI responses for specific product types, use cases, or customer scenarios. This guide explains how to create, manage, and optimize recipe mappings for your business.

## What are Recipe Mappings?

Recipe mappings are predefined response templates that guide the AI agent's behavior for specific situations. They help ensure consistent, on-brand responses while maintaining the flexibility of AI-generated content.

## Use Cases

- **Product-specific guidance**: Skincare routines, supplement dosages, product usage
- **Customer scenarios**: First-time buyers, repeat customers, VIP customers
- **Support topics**: Returns, shipping, product recommendations
- **Seasonal campaigns**: Holiday promotions, seasonal products

## Creating Recipe Mappings

### Via Dashboard

1. Log in to your merchant dashboard
2. Navigate to **Settings** → **Recipe Mappings**
3. Click **Create New Recipe**
4. Fill in the form:
   - **Name**: Descriptive name (e.g., "Vitamin C Serum Usage")
   - **Trigger**: Keywords or conditions
   - **Template**: Response template with variables
   - **Priority**: Higher priority recipes are matched first
5. Click **Save**

### Via API

```bash
curl -X POST https://your-domain.com/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Vitamin C Serum Usage",
    "trigger": {
      "keywords": ["vitamin c", "serum", "how to use"],
      "products": ["PROD-VIT-C-001"]
    },
    "template": {
      "intro": "Great choice! Our Vitamin C Serum is best used...",
      "steps": [
        "Cleanse your face thoroughly",
        "Apply 2-3 drops to face and neck",
        "Wait 1-2 minutes before moisturizer",
        "Use morning and evening for best results"
      ],
      "tips": "Store in a cool, dark place to maintain potency"
    },
    "priority": 10
  }'
```

## Recipe Structure

### Basic Template

```json
{
  "name": "Recipe Name",
  "trigger": {
    "keywords": ["keyword1", "keyword2"],
    "products": ["product-id-1"],
    "intent": "product_usage"
  },
  "template": {
    "greeting": "Hello {{customer_name}}!",
    "body": "Here's how to use {{product_name}}...",
    "steps": ["Step 1", "Step 2"],
    "closing": "Let me know if you have questions!"
  },
  "priority": 10,
  "active": true
}
```

### Available Variables

- `{{customer_name}}`: Customer's name
- `{{product_name}}`: Product name
- `{{order_id}}`: Order ID
- `{{order_date}}`: Order date
- `{{tracking_number}}`: Shipping tracking number
- `{{merchant_name}}`: Your business name
- `{{support_email}}`: Your support email
- `{{support_phone}}`: Your support phone

### Trigger Types

#### Keyword Triggers

Match specific words or phrases:

```json
{
  "trigger": {
    "keywords": ["how to use", "instructions", "apply"],
    "match_type": "any" // or "all"
  }
}
```

#### Product Triggers

Match specific products:

```json
{
  "trigger": {
    "products": ["PROD-001", "PROD-002"],
    "categories": ["skincare", "supplements"]
  }
}
```

#### Intent Triggers

Match customer intent:

```json
{
  "trigger": {
    "intent": "product_usage" // or "shipping", "returns", etc.
  }
}
```

#### Combined Triggers

Use multiple trigger types:

```json
{
  "trigger": {
    "keywords": ["vitamin c"],
    "products": ["PROD-VIT-C-001"],
    "intent": "product_usage",
    "logic": "AND" // all conditions must match
  }
}
```

## Example Recipes

### Product Usage Guide

```json
{
  "name": "Retinol Cream Usage",
  "trigger": {
    "keywords": ["retinol", "how to use", "apply"],
    "products": ["RETINOL-CREAM-001"]
  },
  "template": {
    "intro": "Retinol is powerful! Here's how to use it safely:",
    "steps": [
      "Start with 2x per week (Monday & Thursday)",
      "Apply pea-sized amount to clean, dry skin",
      "Wait 20 minutes before other products",
      "Always use SPF 30+ during the day"
    ],
    "warnings": [
      "May cause initial dryness or peeling (normal!)",
      "Avoid if pregnant or breastfeeding",
      "Don't use with vitamin C or AHAs"
    ],
    "tips": "Increase frequency gradually over 4-6 weeks"
  },
  "priority": 10
}
```

### Shipping Status

```json
{
  "name": "Shipping Status Response",
  "trigger": {
    "keywords": ["where is my order", "tracking", "shipped"],
    "intent": "order_status"
  },
  "template": {
    "greeting": "Hi {{customer_name}}!",
    "body": "Your order #{{order_id}} shipped on {{ship_date}}.",
    "tracking": "Track it here: {{tracking_url}}",
    "eta": "Expected delivery: {{delivery_date}}",
    "support": "Questions? Reply here or email {{support_email}}"
  },
  "priority": 8
}
```

### Product Recommendation

```json
{
  "name": "Complementary Product Suggestion",
  "trigger": {
    "products": ["VITAMIN-C-SERUM"],
    "intent": "product_recommendation"
  },
  "template": {
    "intro": "Great choice on the Vitamin C Serum!",
    "suggestion": "Many customers also love our Hyaluronic Acid Moisturizer",
    "benefit": "It helps lock in the vitamin C and provides extra hydration",
    "offer": "Use code COMBO15 for 15% off when bought together",
    "cta": "Would you like to add it to your order?"
  },
  "priority": 5
}
```

## Best Practices

### 1. Be Specific

❌ Bad:
```json
{
  "trigger": {"keywords": ["product"]},
  "template": {"body": "Here's information about the product"}
}
```

✅ Good:
```json
{
  "trigger": {
    "keywords": ["vitamin c serum", "how to use"],
    "products": ["VIT-C-001"]
  },
  "template": {
    "body": "Apply 2-3 drops of Vitamin C Serum to clean skin..."
  }
}
```

### 2. Use Priority Wisely

- **10**: Critical, product-specific instructions
- **8**: Important, category-specific guidance
- **5**: General recommendations
- **3**: Fallback responses
- **1**: Default responses

### 3. Keep Templates Concise

- Aim for 2-3 sentences per section
- Use bullet points for steps
- Break complex information into multiple recipes

### 4. Test Thoroughly

- Test with real customer messages
- Verify variable substitution works
- Check for edge cases
- Monitor AI agent logs

### 5. Update Regularly

- Review performance monthly
- Update based on customer feedback
- Add new recipes for new products
- Archive outdated recipes

## Managing Recipes

### Viewing Recipes

```bash
# List all recipes
curl -X GET https://your-domain.com/api/recipes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get specific recipe
curl -X GET https://your-domain.com/api/recipes/RECIPE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Updating Recipes

```bash
curl -X PUT https://your-domain.com/api/recipes/RECIPE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "template": {
      "intro": "Updated introduction..."
    }
  }'
```

### Deleting Recipes

```bash
curl -X DELETE https://your-domain.com/api/recipes/RECIPE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Activating/Deactivating

```bash
# Deactivate recipe (keep but don't use)
curl -X PATCH https://your-domain.com/api/recipes/RECIPE_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

## Analytics

### Recipe Performance

Track how often recipes are used:

1. Go to **Analytics** → **Recipe Performance**
2. View metrics:
   - **Usage count**: How many times recipe was triggered
   - **Success rate**: Customer satisfaction with response
   - **Conversion rate**: If recipe led to purchase
   - **Avg response time**: How quickly AI responded

### Optimization Tips

- **Low usage**: Recipe triggers may be too specific
- **Low success**: Template may need improvement
- **High usage + low conversion**: Add stronger CTA
- **High usage + high success**: Consider creating similar recipes

## Troubleshooting

### Recipe Not Triggering

**Possible causes**:
- Keywords don't match customer message
- Lower priority than another matching recipe
- Recipe is inactive
- Trigger logic is too restrictive

**Solutions**:
- Broaden keyword list
- Increase priority
- Check active status
- Use "OR" logic instead of "AND"

### Wrong Recipe Triggering

**Possible causes**:
- Keywords too broad
- Priority too high
- Multiple recipes matching

**Solutions**:
- Make keywords more specific
- Adjust priority
- Add product/intent filters
- Review all active recipes

### Variables Not Substituting

**Possible causes**:
- Variable name misspelled
- Data not available in context
- Template syntax error

**Solutions**:
- Check variable spelling (case-sensitive)
- Verify data exists in order/customer record
- Test with sample data

## Advanced Features

### Conditional Content

```json
{
  "template": {
    "body": "Your order {{#if expedited}}will arrive tomorrow{{else}}will arrive in 3-5 days{{/if}}"
  }
}
```

### Multi-language Support

```json
{
  "template": {
    "en": {
      "body": "Here's how to use your product..."
    },
    "es": {
      "body": "Así es como usar tu producto..."
    }
  },
  "language": "{{customer_language}}"
}
```

### A/B Testing

```json
{
  "variants": [
    {
      "name": "Variant A",
      "template": {"body": "Version A text..."},
      "weight": 50
    },
    {
      "name": "Variant B",
      "template": {"body": "Version B text..."},
      "weight": 50
    }
  ]
}
```

## Resources

- [Recipe API Reference](../api/recipes.md)
- [Template Syntax Guide](../api/templates.md)
- [Best Practices Video](https://example.com/recipe-best-practices)
- [Recipe Examples Repository](https://github.com/recete/recipe-examples)

## Support

Need help with recipe mappings?
- Email: support@recete.com
- Documentation: docs.recete.com
- Community: community.recete.com
