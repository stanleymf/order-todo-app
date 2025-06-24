import sqlite3 from 'sqlite3'
import { v4 as uuidv4 } from 'uuid'

const db = new sqlite3.Database('./order-todo-db.sqlite3')

async function cleanupDuplicates() {
  console.log('🔍 Finding duplicate saved_products...')
  db.all(`
    SELECT tenant_id, shopify_product_id, shopify_variant_id, COUNT(*) as count
    FROM saved_products
    GROUP BY tenant_id, shopify_product_id, shopify_variant_id
    HAVING count > 1
  `, async (err, rows: any[]) => {
    if (err) throw err
    if (!rows.length) {
      console.log('✅ No duplicates found!')
      db.close()
      return
    }
    for (const row of rows) {
      const { tenant_id, shopify_product_id, shopify_variant_id } = row
      db.all(`SELECT * FROM saved_products WHERE tenant_id = ? AND shopify_product_id = ? AND shopify_variant_id = ? ORDER BY updated_at DESC`,
        [tenant_id, shopify_product_id, shopify_variant_id], async (err2, dups: any[]) => {
        if (err2) throw err2
        // Keep the one with labels, or the most recent
        let keep: any = undefined
        for (const p of dups) {
          // Check if this product has labels
          const hasLabel = await new Promise<boolean>(resolve => {
            db.get('SELECT 1 FROM product_label_mappings WHERE saved_product_id = ?', [p.id], (err3, res) => {
              resolve(!!res)
            })
          })
          if (hasLabel) {
            keep = p
            break
          }
        }
        if (!keep) keep = dups[0]
        // Move all labels to the kept row
        for (const prod of dups) {
          if (prod.id === keep.id) continue
          db.all('SELECT * FROM product_label_mappings WHERE saved_product_id = ?', [prod.id], (err4, mappings: any[]) => {
            if (err4) throw err4
            for (const mapping of mappings) {
              db.run('INSERT OR IGNORE INTO product_label_mappings (id, tenant_id, saved_product_id, label_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [uuidv4(), mapping.tenant_id, keep.id, mapping.label_id, new Date().toISOString()])
            }
          })
        }
        // Delete the duplicates except the kept one
        for (const prod of dups) {
          if (prod.id !== keep.id) {
            db.run('DELETE FROM saved_products WHERE id = ?', [prod.id])
          }
        }
        console.log(`🧹 Cleaned up duplicates for product ${keep.title} (${shopify_product_id}/${shopify_variant_id})`)
      })
    }
    db.close()
    console.log('✅ Cleanup complete!')
  })
}

cleanupDuplicates() 