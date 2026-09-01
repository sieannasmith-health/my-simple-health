# My Simple Health

Development repository for My Simple Health.

## Food Acquisition

The active Food Acquisition implementation normalizes barcode/product lookups and reviewed receipt imports into one Product → Acquisition → Inventory/Price pipeline. External provider data is adapted behind MSH-owned product identities, and uncertain receipt lines are preserved rather than silently promoted into inventory.
