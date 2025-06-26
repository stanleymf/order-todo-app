# 10K Order Sync Script

This script fetches the latest 10,000 orders from Shopify and saves them directly to the D1 remote database.

## Usage

1. **Set your auth token** as an environment variable:
   ```bash
   export AUTH_TOKEN="your_auth_token_here"
   ```

2. **Run the sync**:
   ```bash
   npm run sync-10k-orders
   ```

3. **Check results** in your app using "Refresh from Database"

## How to get your AUTH_TOKEN

1. Open your Order-To-Do app in the browser
2. Open browser dev tools (F12)
3. Go to Application/Storage → Local Storage
4. Look for `auth_token` value
5. Copy that value and use it as your AUTH_TOKEN

## What the script does

- ✅ Fetches latest 10,000 orders from Shopify 
- ✅ Extracts delivery dates from order tags (DD/MM/YYYY format)
- ✅ Saves orders directly to D1 remote database
- ✅ Skips orders without delivery dates
- ✅ Updates existing orders, creates new ones
- ✅ Shows progress every 100 orders processed

## Results

The script will show:
- **Saved**: Number of new orders created
- **Updated**: Number of existing orders updated  
- **Skipped**: Number of orders without delivery dates
- **Total processed**: Total orders saved to database

After running, use **"Refresh from Database"** in your app to see the orders. 