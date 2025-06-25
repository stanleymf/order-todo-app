// Script to fix corrupted shopify_order_data fields
// Some orders have double-encoded JSON due to the webhook bug

const FIX_CORRUPTED_ORDERS = async () => {
  const TENANT_ID = "84caf0bf-b8a7-448f-9a33-8697cb8d6918";

  try {
    console.log("Starting to fix corrupted shopify_order_data...");

    // Get all orders with shopify_order_data
    const response = await fetch(`https://order-to-do.stanleytan92.workers.dev/api/tenants/${TENANT_ID}/orders-from-db-by-date?date=27/06/2025`);
    const data = await response.json();

    console.log(`Found ${data.orders?.length || 0} orders to check`);

    let fixedCount = 0;

    for (const order of data.orders || []) {
      try {
        console.log(`Checking order ${order.orderId} (${order.title})`);
        
        // Check if shopifyOrderData is corrupted (double-encoded string)
        if (order.shopifyOrderData && typeof order.shopifyOrderData === 'string') {
          console.log(`Order ${order.orderId} has string shopifyOrderData, attempting to fix...`);
          
          // Try to parse the double-encoded JSON
          let parsed;
          try {
            parsed = JSON.parse(order.shopifyOrderData);
            if (typeof parsed === 'object' && parsed.id) {
              console.log(`Successfully parsed double-encoded data for order ${order.orderId}`);
              console.log(`Order name in data: ${parsed.name}`);
              
              // Update the order with the correctly parsed data
              const response = await fetch(`https://order-to-do.stanleytan92.workers.dev/api/tenants/${TENANT_ID}/orders/${order.orderId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  shopifyOrderData: parsed
                })
              });
              
              if (response.ok) {
                console.log(`✅ Fixed order ${order.orderId} - ${parsed.name}`);
                fixedCount++;
              } else {
                console.log(`❌ Failed to update order ${order.orderId}: ${response.status}`);
              }
            } else {
              console.log(`Order ${order.orderId} data is not valid JSON object`);
            }
          } catch (parseError) {
            console.log(`Could not parse shopifyOrderData for order ${order.orderId}:`, parseError.message);
          }
        } else if (order.shopifyOrderData && typeof order.shopifyOrderData === 'object') {
          console.log(`Order ${order.orderId} already has object shopifyOrderData - ${order.shopifyOrderData.name || 'Unknown'}`);
        } else {
          console.log(`Order ${order.orderId} has no shopifyOrderData`);
        }
      } catch (error) {
        console.error(`Error processing order ${order.orderId}:`, error);
      }
    }

    console.log(`\n✅ Script completed. Fixed ${fixedCount} orders.`);
    
  } catch (error) {
    console.error("Script failed:", error);
  }
};

// Run the script
FIX_CORRUPTED_ORDERS(); 