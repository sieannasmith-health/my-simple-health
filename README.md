# My Simple Health

Development repository for My Simple Health.

## Food Acquisition

The active Food Acquisition implementation normalizes barcode/product lookups and reviewed receipt imports into one Product → Acquisition → Inventory/Price pipeline. External provider data is adapted behind MSH-owned product identities, and uncertain receipt lines are preserved rather than silently promoted into inventory.

Receipt images are parsed server-side and reviewed by the user before saving. Confirmed food lines become product-linked acquisition items; unchecked or uncertain lines remain traceable as unresolved receipt lines.
