import SwiftUI

struct MSHFoodPriceObservation: Codable, Identifiable, Equatable {
    let id: UUID
    let amount: Double
    let merchant: String?
    let observedAt: Date

    init(id: UUID = UUID(), amount: Double, merchant: String? = nil, observedAt: Date = Date()) {
        self.id = id
        self.amount = amount
        self.merchant = merchant
        self.observedAt = observedAt
    }
}

struct MSHFoodItem: Codable, Identifiable, Equatable {
    let id: UUID
    var name: String
    var quantity: Double
    var unit: String
    var location: String
    var expiresAt: Date?
    var productCode: String?
    var brand: String?
    var provenance: String
    var priceHistory: [MSHFoodPriceObservation]

    init(
        id: UUID = UUID(),
        name: String,
        quantity: Double = 1,
        unit: String = "item",
        location: String = "Pantry",
        expiresAt: Date? = nil,
        productCode: String? = nil,
        brand: String? = nil,
        provenance: String = "manual",
        priceHistory: [MSHFoodPriceObservation] = []
    ) {
        self.id = id
        self.name = name
        self.quantity = quantity
        self.unit = unit
        self.location = location
        self.expiresAt = expiresAt
        self.productCode = productCode
        self.brand = brand
        self.provenance = provenance
        self.priceHistory = priceHistory
    }
}

struct MSHGroceryItem: Codable, Identifiable, Equatable {
    let id: UUID
    var name: String
    var quantity: Double
    var unit: String
    var productCode: String?

    init(id: UUID = UUID(), name: String, quantity: Double = 1, unit: String = "item", productCode: String? = nil) {
        self.id = id
        self.name = name
        self.quantity = quantity
        self.unit = unit
        self.productCode = productCode
    }
}

@MainActor
final class MSHFoodStore: ObservableObject {
    @Published private(set) var inventory: [MSHFoodItem] = []
    @Published private(set) var groceries: [MSHGroceryItem] = []

    private let defaults: UserDefaults
    private let inventoryKey = "msh.food.native.inventory.v1"
    private let groceryKey = "msh.food.native.grocery.v1"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func addFood(_ item: MSHFoodItem) {
        if let index = matchingInventoryIndex(productCode: item.productCode, name: item.name) {
            inventory[index].quantity += item.quantity
            if let expiry = item.expiresAt { inventory[index].expiresAt = expiry }
            if inventory[index].brand == nil { inventory[index].brand = item.brand }
            inventory[index].priceHistory.append(contentsOf: item.priceHistory)
        } else {
            inventory.append(item)
        }
        persist()
    }

    func addGrocery(_ item: MSHGroceryItem) {
        guard !groceries.contains(where: { matches($0.productCode, $0.name, item.productCode, item.name) }) else { return }
        groceries.append(item)
        persist()
    }

    func purchase(_ grocery: MSHGroceryItem, merchant: String? = nil, price: Double? = nil) {
        let observation = price.map { MSHFoodPriceObservation(amount: $0, merchant: merchant) }
        if let index = matchingInventoryIndex(productCode: grocery.productCode, name: grocery.name) {
            inventory[index].quantity += grocery.quantity
            if let observation { inventory[index].priceHistory.append(observation) }
        } else {
            inventory.append(
                MSHFoodItem(
                    name: grocery.name,
                    quantity: grocery.quantity,
                    unit: grocery.unit,
                    productCode: grocery.productCode,
                    provenance: "grocery_purchase",
                    priceHistory: observation.map { [$0] } ?? []
                )
            )
        }
        groceries.removeAll { $0.id == grocery.id }
        persist()
    }

    func consume(_ food: MSHFoodItem, amount: Double) {
        guard amount > 0, let index = inventory.firstIndex(where: { $0.id == food.id }) else { return }
        inventory[index].quantity = max(0, inventory[index].quantity - amount)
        if inventory[index].quantity == 0 { inventory.remove(at: index) }
        persist()
    }

    func useUp(_ food: MSHFoodItem, restock: Bool) {
        inventory.removeAll { $0.id == food.id }
        if restock {
            addGrocery(MSHGroceryItem(name: food.name, quantity: 1, unit: food.unit, productCode: food.productCode))
        } else {
            persist()
        }
    }

    func removeGrocery(_ grocery: MSHGroceryItem) {
        groceries.removeAll { $0.id == grocery.id }
        persist()
    }

    var useSoon: [MSHFoodItem] {
        let cutoff = Calendar.current.date(byAdding: .day, value: 5, to: Date()) ?? Date()
        return inventory
            .filter { item in
                guard let expiry = item.expiresAt else { return false }
                return expiry <= cutoff
            }
            .sorted { ($0.expiresAt ?? .distantFuture) < ($1.expiresAt ?? .distantFuture) }
    }

    private func matchingInventoryIndex(productCode: String?, name: String) -> Int? {
        inventory.firstIndex { matches($0.productCode, $0.name, productCode, name) }
    }

    private func matches(_ lhsCode: String?, _ lhsName: String, _ rhsCode: String?, _ rhsName: String) -> Bool {
        if let lhsCode, let rhsCode, !lhsCode.isEmpty, lhsCode == rhsCode { return true }
        return lhsName.trimmingCharacters(in: .whitespacesAndNewlines)
            .localizedCaseInsensitiveCompare(rhsName.trimmingCharacters(in: .whitespacesAndNewlines)) == .orderedSame
    }

    private func load() {
        let decoder = JSONDecoder()
        if let data = defaults.data(forKey: inventoryKey),
           let decoded = try? decoder.decode([MSHFoodItem].self, from: data) {
            inventory = decoded
        }
        if let data = defaults.data(forKey: groceryKey),
           let decoded = try? decoder.decode([MSHGroceryItem].self, from: data) {
            groceries = decoded
        }
    }

    private func persist() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(inventory) { defaults.set(data, forKey: inventoryKey) }
        if let data = try? encoder.encode(groceries) { defaults.set(data, forKey: groceryKey) }
    }
}

struct MSHFoodProductLookupResult: Decodable, Equatable {
    struct Product: Decodable, Equatable {
        let canonicalName: String
        let brand: String?
        let packageQuantity: Double?
        let packageUnit: String?
        let identifier: Identifier

        struct Identifier: Decodable, Equatable {
            let scheme: String
            let value: String
        }
    }

    let success: Bool
    let found: Bool?
    let product: Product?
    let message: String?
}

struct MSHFoodProductService {
    var session: URLSession = .shared
    var baseURL = URL(string: "https://www.mysimplehealth.org")!

    func lookup(code: String) async throws -> MSHFoodProductLookupResult {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/food-product"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "code", value: code)]
        guard let url = components.url else { throw URLError(.badURL) }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        let decoded = try JSONDecoder().decode(MSHFoodProductLookupResult.self, from: data)
        guard (200...299).contains(http.statusCode) else {
            throw MSHFoodLookupError.message(decoded.message ?? "Product lookup failed.")
        }
        return decoded
    }
}

enum MSHFoodLookupError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self { case .message(let message): message }
    }
}

struct MSHFoodScreen: View {
    @StateObject private var store = MSHFoodStore()
    @State private var sheet: FoodSheet?

    enum FoodSheet: Identifiable {
        case addFood, addGrocery, importFood, product, receipt
        var id: String { String(describing: self) }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 26) {
                MSHEditorialFoodHeader()
                quickActions
                if !store.useSoon.isEmpty { useSoonSection }
                inventorySection
                grocerySection
                continuitySection
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(MSHColor.canvas)
        .navigationTitle("Food")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .sheet(item: $sheet) { value in sheetView(value) }
        .accessibilityIdentifier("native-food-screen")
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("ADD")
                .font(.caption.weight(.semibold))
                .tracking(1.3)
                .foregroundStyle(MSHColor.secondaryText)
            HStack(spacing: 10) {
                action("Food", "plus", .addFood)
                action("Grocery", "cart.badge.plus", .addGrocery)
                action("Import", "square.and.arrow.down", .importFood)
            }
            HStack(spacing: 10) {
                action("Barcode", "barcode.viewfinder", .product)
                action("Receipt", "doc.viewfinder", .receipt)
            }
        }
    }

    private func action(_ title: String, _ image: String, _ destination: FoodSheet) -> some View {
        Button { sheet = destination } label: {
            VStack(spacing: 7) {
                Image(systemName: image).font(.system(size: 18, weight: .medium))
                Text(title).font(.caption.weight(.semibold))
            }
            .foregroundStyle(MSHColor.accent)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(MSHColor.controlFill)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var useSoonSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("USE SOON")
                .font(.caption.weight(.semibold))
                .tracking(1.3)
                .foregroundStyle(MSHColor.secondaryText)
            ForEach(store.useSoon) { food in
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(food.name).font(.headline)
                        if let expiry = food.expiresAt {
                            Text("Best by \(expiry.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                    }
                    Spacer()
                    Image(systemName: "clock")
                        .foregroundStyle(MSHColor.accent)
                }
                .padding(.vertical, 6)
            }
        }
    }

    private var inventorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("ON HAND").font(.caption.weight(.semibold)).tracking(1.3).foregroundStyle(MSHColor.secondaryText)
                Spacer()
                Text("\(store.inventory.count)").font(.caption).foregroundStyle(MSHColor.secondaryText)
            }
            if store.inventory.isEmpty {
                empty("Your inventory will appear here.")
            } else {
                ForEach(store.inventory) { food in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(food.name).font(.system(size: 18, weight: .medium, design: .serif))
                                if let brand = food.brand, !brand.isEmpty { Text(brand).font(.caption).foregroundStyle(MSHColor.secondaryText) }
                            }
                            Spacer()
                            Text("\(food.quantity, specifier: "%g") \(food.unit)").font(.subheadline).foregroundStyle(MSHColor.secondaryText)
                        }
                        HStack(spacing: 14) {
                            Label(food.location, systemImage: "cabinet")
                            if let expiry = food.expiresAt { Label(expiry.formatted(date: .numeric, time: .omitted), systemImage: "calendar") }
                            if let latest = food.priceHistory.last { Label(latest.amount.formatted(.currency(code: "USD")), systemImage: "tag") }
                        }
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                Button("Use one") { store.consume(food, amount: 1) }.buttonStyle(.bordered)
                                Button("Used up") { store.useUp(food, restock: false) }.buttonStyle(.bordered)
                                Button("Use up + restock") { store.useUp(food, restock: true) }.buttonStyle(.bordered)
                            }
                            .font(.caption)
                        }
                    }
                    .padding(.vertical, 10)
                    Divider().overlay(MSHColor.border)
                }
            }
        }
    }

    private var grocerySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("GROCERY LIST").font(.caption.weight(.semibold)).tracking(1.3).foregroundStyle(MSHColor.secondaryText)
                Spacer()
                Button { sheet = .addGrocery } label: { Image(systemName: "plus") }
            }
            if store.groceries.isEmpty {
                empty("Things you need will appear here.")
            } else {
                ForEach(store.groceries) { grocery in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(grocery.name).font(.system(size: 17, weight: .medium, design: .serif))
                            Text("\(grocery.quantity, specifier: "%g") \(grocery.unit)").font(.caption).foregroundStyle(MSHColor.secondaryText)
                        }
                        Spacer()
                        Button("Purchased") { store.purchase(grocery) }.buttonStyle(.borderedProminent)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }

    private var continuitySection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Food continuity", systemImage: "arrow.triangle.2.circlepath")
                .font(.headline)
                .foregroundStyle(MSHColor.primaryText)
            Text("Need → purchase → on hand → use → restock. Core Food state is native and does not require the MSH website to load.")
                .font(.footnote)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .padding(.top, 6)
    }

    private func empty(_ text: String) -> some View {
        Text(text).font(.subheadline).foregroundStyle(MSHColor.secondaryText).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8)
    }

    @ViewBuilder
    private func sheetView(_ value: FoodSheet) -> some View {
        switch value {
        case .addFood: MSHAddFoodSheet { store.addFood($0); sheet = nil }
        case .addGrocery: MSHAddGrocerySheet { store.addGrocery($0); sheet = nil }
        case .importFood: MSHFoodImportSheet(store: store)
        case .product: MSHFoodProductLookupSheet(store: store)
        case .receipt: MSHFoodReceiptReviewSheet(store: store)
        }
    }
}

private struct MSHEditorialFoodHeader: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("FOOD").font(.caption2.weight(.semibold)).tracking(2.2).foregroundStyle(MSHColor.accent)
            Text("Keep what you have connected to what you need.")
                .font(.system(size: 30, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
            Text("Inventory, groceries, product details, and what gets used belong to one continuous flow.")
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
        }
    }
}

private struct MSHAddFoodSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var quantity = "1"
    @State private var unit = "item"
    @State private var location = "Pantry"
    @State private var hasExpiration = false
    @State private var expiration = Date()
    @State private var merchant = ""
    @State private var price = ""
    let save: (MSHFoodItem) -> Void

    var body: some View {
        NavigationStack {
            Form {
                TextField("Food", text: $name)
                TextField("Quantity", text: $quantity).keyboardType(.decimalPad)
                TextField("Unit", text: $unit)
                TextField("Storage location", text: $location)
                Toggle("Expiration / best-by date", isOn: $hasExpiration)
                if hasExpiration { DatePicker("Date", selection: $expiration, displayedComponents: .date) }
                Section("Purchase details") {
                    TextField("Store / merchant", text: $merchant)
                    TextField("Price", text: $price).keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Add Food")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { return }
                        let observation = Double(price).map { MSHFoodPriceObservation(amount: $0, merchant: merchant.isEmpty ? nil : merchant) }
                        save(MSHFoodItem(name: trimmed, quantity: Double(quantity) ?? 1, unit: unit, location: location, expiresAt: hasExpiration ? expiration : nil, priceHistory: observation.map { [$0] } ?? []))
                    }
                }
            }
        }
    }
}

private struct MSHAddGrocerySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var quantity = "1"
    @State private var unit = "item"
    let save: (MSHGroceryItem) -> Void

    var body: some View {
        NavigationStack {
            Form {
                TextField("Grocery item", text: $name)
                TextField("Quantity", text: $quantity).keyboardType(.decimalPad)
                TextField("Unit", text: $unit)
            }
            .navigationTitle("Add Grocery")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !trimmed.isEmpty else { return }
                        save(MSHGroceryItem(name: trimmed, quantity: Double(quantity) ?? 1, unit: unit))
                    }
                }
            }
        }
    }
}

private struct MSHFoodImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var text = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Paste one item per line") { TextEditor(text: $text).frame(minHeight: 220) }
                Text("This is also the migration doorway for an existing inventory export while the native Food repository is being consolidated.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Import Inventory")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Import") {
                        text.split(whereSeparator: \.isNewline)
                            .map(String.init)
                            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                            .filter { !$0.isEmpty }
                            .forEach { store.addFood(MSHFoodItem(name: $0, provenance: "inventory_import")) }
                        dismiss()
                    }
                }
            }
        }
    }
}

private struct MSHFoodProductLookupSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var code = ""
    @State private var product: MSHFoodProductLookupResult.Product?
    @State private var isLoading = false
    @State private var errorMessage: String?
    private let service = MSHFoodProductService()

    var body: some View {
        NavigationStack {
            Form {
                Section("Barcode / GTIN") {
                    TextField("UPC, EAN, or GTIN", text: $code).keyboardType(.numberPad)
                    Button(isLoading ? "Looking up…" : "Look up product") { Task { await lookup() } }
                        .disabled(isLoading || code.isEmpty)
                }
                if let product {
                    Section("Product") {
                        Text(product.canonicalName)
                        if let brand = product.brand { Text(brand).foregroundStyle(.secondary) }
                        if let quantity = product.packageQuantity {
                            Text("Package: \(quantity, specifier: "%g") \(product.packageUnit ?? "")")
                        }
                        Button("Add to inventory") {
                            store.addFood(MSHFoodItem(name: product.canonicalName, quantity: 1, unit: product.packageUnit ?? "item", productCode: product.identifier.value, brand: product.brand, provenance: "product_lookup"))
                            dismiss()
                        }
                    }
                }
                if let errorMessage { Text(errorMessage).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Product Lookup")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }

    private func lookup() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await service.lookup(code: code)
            if let found = result.product { product = found } else { errorMessage = result.message ?? "Product not found." }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct MSHFoodReceiptReviewSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var merchant = ""
    @State private var items = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Store / merchant", text: $merchant)
                Section("Receipt items to confirm") { TextEditor(text: $items).frame(minHeight: 180) }
                Text("Receipt lines are reviewed before they become inventory. Camera/OCR capture remains a separate native intake step so unconfirmed text never silently changes inventory.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .navigationTitle("Receipt Review")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add items") {
                        items.split(whereSeparator: \.isNewline)
                            .map(String.init)
                            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                            .filter { !$0.isEmpty }
                            .forEach { line in
                                store.addFood(MSHFoodItem(name: line, provenance: merchant.isEmpty ? "receipt_review" : "receipt_review:\(merchant)"))
                            }
                        dismiss()
                    }
                }
            }
        }
    }
}
