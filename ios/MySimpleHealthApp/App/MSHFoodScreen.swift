import SwiftUI

struct MSHFoodItem: Codable, Identifiable, Equatable {
    let id: UUID
    var name: String
    var quantity: Double
    var unit: String
    var location: String
    var expiresAt: Date?
    var merchant: String?
    var price: Double?
    var productCode: String?

    init(id: UUID = UUID(), name: String, quantity: Double = 1, unit: String = "item", location: String = "Pantry", expiresAt: Date? = nil, merchant: String? = nil, price: Double? = nil, productCode: String? = nil) {
        self.id = id; self.name = name; self.quantity = quantity; self.unit = unit; self.location = location; self.expiresAt = expiresAt; self.merchant = merchant; self.price = price; self.productCode = productCode
    }
}

struct MSHGroceryItem: Codable, Identifiable, Equatable {
    let id: UUID
    var name: String
    var quantity: Double
    var unit: String
    var productCode: String?

    init(id: UUID = UUID(), name: String, quantity: Double = 1, unit: String = "item", productCode: String? = nil) {
        self.id = id; self.name = name; self.quantity = quantity; self.unit = unit; self.productCode = productCode
    }
}

@MainActor
final class MSHFoodStore: ObservableObject {
    @Published var inventory: [MSHFoodItem] = [] { didSet { save() } }
    @Published var groceries: [MSHGroceryItem] = [] { didSet { save() } }
    private let defaults = UserDefaults.standard
    private let inventoryKey = "msh.food.native.inventory.v1"
    private let groceryKey = "msh.food.native.grocery.v1"

    init() { load() }

    func addFood(_ item: MSHFoodItem) { inventory.append(item) }
    func addGrocery(_ item: MSHGroceryItem) {
        guard !groceries.contains(where: { $0.name.localizedCaseInsensitiveCompare(item.name) == .orderedSame || ($0.productCode != nil && $0.productCode == item.productCode) }) else { return }
        groceries.append(item)
    }
    func purchase(_ grocery: MSHGroceryItem) {
        if let index = inventory.firstIndex(where: { ($0.productCode != nil && $0.productCode == grocery.productCode) || $0.name.localizedCaseInsensitiveCompare(grocery.name) == .orderedSame }) {
            inventory[index].quantity += grocery.quantity
        } else {
            inventory.append(MSHFoodItem(name: grocery.name, quantity: grocery.quantity, unit: grocery.unit, productCode: grocery.productCode))
        }
        groceries.removeAll { $0.id == grocery.id }
    }
    func useUp(_ food: MSHFoodItem, restock: Bool) {
        inventory.removeAll { $0.id == food.id }
        if restock { addGrocery(MSHGroceryItem(name: food.name, quantity: 1, unit: food.unit, productCode: food.productCode)) }
    }
    func consume(_ food: MSHFoodItem, amount: Double) {
        guard amount > 0, let index = inventory.firstIndex(where: { $0.id == food.id }) else { return }
        inventory[index].quantity = max(0, inventory[index].quantity - amount)
        if inventory[index].quantity == 0 { inventory.remove(at: index) }
    }

    private func load() {
        let decoder = JSONDecoder()
        if let data = defaults.data(forKey: inventoryKey), let decoded = try? decoder.decode([MSHFoodItem].self, from: data) { inventory = decoded }
        if let data = defaults.data(forKey: groceryKey), let decoded = try? decoder.decode([MSHGroceryItem].self, from: data) { groceries = decoded }
    }
    private func save() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(inventory) { defaults.set(data, forKey: inventoryKey) }
        if let data = try? encoder.encode(groceries) { defaults.set(data, forKey: groceryKey) }
    }
}

struct MSHFoodScreen: View {
    @StateObject private var store = MSHFoodStore()
    @State private var sheet: FoodSheet?

    enum FoodSheet: Identifiable { case addFood, addGrocery, importFood, product, receipt; var id: String { String(describing: self) } }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            ScrollView {
                LazyVStack(alignment: .leading, spacing: MSHSpacing.large) {
                    header
                    quickActions
                    inventorySection
                    grocerySection
                    continuitySection
                }.padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Food")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $sheet) { value in sheetView(value) }
        .accessibilityIdentifier("native-food-screen")
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("Your Food").font(MSHTypography.destinationTitle).foregroundStyle(MSHColor.primaryText)
            Text("Keep what you have, what you need, and what gets used connected in one place.").font(MSHTypography.body).foregroundStyle(MSHColor.secondaryText)
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("Add").font(MSHTypography.cardTitle).foregroundStyle(MSHColor.primaryText)
            HStack {
                foodAction("Food", "plus", .addFood)
                foodAction("Grocery", "cart.badge.plus", .addGrocery)
                foodAction("Import", "square.and.arrow.down", .importFood)
            }
            HStack {
                foodAction("Barcode", "barcode.viewfinder", .product)
                foodAction("Receipt", "doc.viewfinder", .receipt)
            }
        }.mshSurface()
    }

    private func foodAction(_ title: String, _ icon: String, _ destination: FoodSheet) -> some View {
        Button { sheet = destination } label: {
            VStack(spacing: 7) { Image(systemName: icon).font(.title3); Text(title).font(.caption.weight(.semibold)) }
                .frame(maxWidth: .infinity).padding(.vertical, 12).foregroundStyle(MSHColor.accent).background(MSHColor.controlFill).clipShape(RoundedRectangle(cornerRadius: MSHRadius.small))
        }.buttonStyle(.plain)
    }

    private var inventorySection: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack { Text("On hand").font(MSHTypography.cardTitle); Spacer(); Text("\(store.inventory.count)").foregroundStyle(MSHColor.secondaryText) }
            if store.inventory.isEmpty { empty("Your inventory will appear here.") }
            ForEach(store.inventory) { food in
                VStack(alignment: .leading, spacing: 8) {
                    HStack { Text(food.name).font(.headline); Spacer(); Text("\(food.quantity, specifier: "%g") \(food.unit)").foregroundStyle(MSHColor.secondaryText) }
                    HStack { Label(food.location, systemImage: "cabinet"); Spacer(); if let expiry = food.expiresAt { Label(expiry.formatted(date: .abbreviated, time: .omitted), systemImage: "calendar") } }.font(.caption).foregroundStyle(MSHColor.secondaryText)
                    HStack {
                        Button("Use one") { store.consume(food, amount: 1) }.buttonStyle(.bordered)
                        Button("Used up") { store.useUp(food, restock: false) }.buttonStyle(.bordered)
                        Button("Use up + restock") { store.useUp(food, restock: true) }.buttonStyle(.bordered)
                    }.font(.caption)
                }.padding(.vertical, 6)
            }
        }.mshSurface()
    }

    private var grocerySection: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            HStack { Text("Grocery List").font(MSHTypography.cardTitle); Spacer(); Button { sheet = .addGrocery } label: { Image(systemName: "plus") } }
            if store.groceries.isEmpty { empty("Things you need will appear here.") }
            ForEach(store.groceries) { grocery in
                HStack { VStack(alignment: .leading) { Text(grocery.name).font(.headline); Text("\(grocery.quantity, specifier: "%g") \(grocery.unit)").font(.caption).foregroundStyle(MSHColor.secondaryText) }; Spacer(); Button("Purchased") { store.purchase(grocery) }.buttonStyle(.borderedProminent) }
            }
        }.mshSurface()
    }

    private var continuitySection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Food continuity", systemImage: "arrow.triangle.2.circlepath").font(MSHTypography.cardTitle)
            Text("Grocery need → purchased → on hand → used → restock. Core Food state works locally without loading the MSH website.").font(.footnote).foregroundStyle(MSHColor.secondaryText)
        }.mshSurface()
    }

    private func empty(_ text: String) -> some View { Text(text).font(.subheadline).foregroundStyle(MSHColor.secondaryText).frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 8) }

    @ViewBuilder private func sheetView(_ value: FoodSheet) -> some View {
        switch value {
        case .addFood: MSHAddFoodSheet { store.addFood($0); sheet = nil }
        case .addGrocery: MSHAddGrocerySheet { store.addGrocery($0); sheet = nil }
        case .importFood: MSHFoodImportSheet(store: store)
        case .product: MSHFoodProductEntrySheet(store: store)
        case .receipt: MSHFoodReceiptEntrySheet(store: store)
        }
    }
}

private struct MSHAddFoodSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""; @State private var quantity = "1"; @State private var unit = "item"; @State private var location = "Pantry"
    let save: (MSHFoodItem) -> Void
    var body: some View { NavigationStack { Form { TextField("Food", text: $name); TextField("Quantity", text: $quantity).keyboardType(.decimalPad); TextField("Unit", text: $unit); TextField("Storage location", text: $location) }.navigationTitle("Add Food").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Add") { guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }; save(MSHFoodItem(name: name, quantity: Double(quantity) ?? 1, unit: unit, location: location)) } } } } }
}

private struct MSHAddGrocerySheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""; @State private var quantity = "1"; @State private var unit = "item"
    let save: (MSHGroceryItem) -> Void
    var body: some View { NavigationStack { Form { TextField("Grocery item", text: $name); TextField("Quantity", text: $quantity).keyboardType(.decimalPad); TextField("Unit", text: $unit) }.navigationTitle("Add Grocery").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Add") { guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return }; save(MSHGroceryItem(name: name, quantity: Double(quantity) ?? 1, unit: unit)) } } } } }
}

private struct MSHFoodImportSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var text = ""
    var body: some View { NavigationStack { Form { Section("Paste one item per line") { TextEditor(text: $text).frame(minHeight: 220) }; Text("Imported items stay on this device and can be edited through the native Food workspace.").font(.footnote) }.navigationTitle("Import Inventory").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Import") { text.split(whereSeparator: \.isNewline).map(String.init).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.forEach { store.addFood(MSHFoodItem(name: $0)) }; dismiss() } } } } }
}

private struct MSHFoodProductEntrySheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var code = ""; @State private var name = ""
    var body: some View { NavigationStack { Form { Section("Barcode / GTIN") { TextField("UPC, EAN, or GTIN", text: $code).keyboardType(.numberPad); TextField("Product name", text: $name) }; Text("This native entry keeps the product identifier attached. Remote product lookup can enrich it through the existing MSH backend without loading the Food website.").font(.footnote) }.navigationTitle("Add Product").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Add") { guard !name.isEmpty else { return }; store.addFood(MSHFoodItem(name: name, productCode: code.isEmpty ? nil : code)); dismiss() } } } } }
}

private struct MSHFoodReceiptEntrySheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var store: MSHFoodStore
    @State private var merchant = ""; @State private var items = ""
    var body: some View { NavigationStack { Form { TextField("Store / merchant", text: $merchant); Section("Receipt items") { TextEditor(text: $items).frame(minHeight: 180) }; Text("Review the lines before adding them. This keeps receipt intake user-confirmed.").font(.footnote) }.navigationTitle("Receipt Review").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Add items") { items.split(whereSeparator: \.isNewline).map(String.init).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.forEach { store.addFood(MSHFoodItem(name: $0, merchant: merchant.isEmpty ? nil : merchant)) }; dismiss() } } } } }
}
