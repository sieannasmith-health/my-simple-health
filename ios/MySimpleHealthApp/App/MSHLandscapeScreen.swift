import SwiftUI

struct MSHLandscapeScreen: View {
    @StateObject private var model = MSHLandscapeViewModel()

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()
            switch model.stage {
            case .landing:
                landing
            case .question:
                questionFlow
            case .summary:
                summary
            }
        }
        .navigationTitle("Landscape")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(MSHColor.canvas, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .accessibilityIdentifier("native-landscape-screen")
    }

    private var landing: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header(
                    eyebrow: "WHERE I AM · LANDSCAPE",
                    title: "Bring one part of your picture into focus.",
                    subtitle: "Choose an area that feels relevant today. One response is enough to reveal something useful, and you can decide whether to keep exploring."
                )

                if model.hasProgress {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Your partial picture is saved.")
                            .font(.headline)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Stopping was not a failure. Continue where you left off, or see the picture you have so far.")
                            .font(.subheadline)
                            .foregroundStyle(MSHColor.secondaryText)
                        HStack(spacing: 10) {
                            Button("Continue") { model.resume() }
                                .buttonStyle(.borderedProminent)
                                .tint(MSHColor.accent)
                            Button("See picture") { model.showPartialSummary() }
                                .buttonStyle(.bordered)
                                .tint(MSHColor.accent)
                        }
                    }
                    .mshLandscapeCard()
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("CHOOSE AN AREA")
                        .font(.caption.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(MSHColor.secondaryText)
                    ForEach(MSHLandscapeCatalog.domains) { domain in
                        Button {
                            model.start(domain: domain.id)
                        } label: {
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: domain.symbol)
                                    .font(.system(size: 18, weight: .medium))
                                    .foregroundStyle(MSHColor.accent)
                                    .frame(width: 28, height: 28)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(domain.label)
                                        .font(.system(size: 19, weight: .medium, design: .serif))
                                        .foregroundStyle(MSHColor.primaryText)
                                    Text(domain.description)
                                        .font(.subheadline)
                                        .foregroundStyle(MSHColor.secondaryText)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 8)
                                if let state = model.domainState(domain.id) {
                                    Text(state)
                                        .font(.caption)
                                        .foregroundStyle(MSHColor.secondaryText)
                                        .multilineTextAlignment(.trailing)
                                } else {
                                    Image(systemName: "chevron.right")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(MSHColor.secondaryText)
                                }
                            }
                            .padding(.vertical, 14)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        Divider().overlay(MSHColor.border)
                    }
                }

                if model.hasCompletedPicture {
                    Button("View completed picture") { model.showCompletedSummary() }
                        .buttonStyle(.bordered)
                        .tint(MSHColor.accent)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("A reflection, not a score.")
                        .font(.system(size: 22, weight: .medium, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text("There are no passing or failing results. A lower response does not mean something is wrong, and a higher response does not mean there is nothing to explore.")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .mshLandscapeCard()
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
    }

    private var questionFlow: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack {
                    Button {
                        model.backToLanding()
                    } label: {
                        Label("Landscape", systemImage: "chevron.left")
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(MSHColor.accent)
                    Spacer()
                    Text("\(model.exploredCount) of \(MSHLandscapeCatalog.items.count) explored")
                        .font(.caption)
                        .foregroundStyle(MSHColor.secondaryText)
                }

                ProgressView(value: model.progress)
                    .tint(MSHColor.accent)

                if let item = model.currentItem,
                   let domain = MSHLandscapeCatalog.domain(item.domain) {
                    VStack(alignment: .leading, spacing: 18) {
                        Label(domain.label.uppercased(), systemImage: domain.symbol)
                            .font(.caption.weight(.semibold))
                            .tracking(1.4)
                            .foregroundStyle(MSHColor.accent)

                        Text(item.prompt)
                            .font(.system(size: 30, weight: .medium, design: .serif))
                            .foregroundStyle(MSHColor.primaryText)
                            .fixedSize(horizontal: false, vertical: true)

                        Text("Right now")
                            .font(.caption)
                            .foregroundStyle(MSHColor.secondaryText)

                        VStack(spacing: 9) {
                            ForEach(item.options) { option in
                                Button {
                                    model.answer(option)
                                } label: {
                                    HStack {
                                        Text(option.label)
                                            .font(.body.weight(.medium))
                                        Spacer()
                                        if model.selectedOptionID == option.id {
                                            Image(systemName: "checkmark.circle.fill")
                                        }
                                    }
                                    .foregroundStyle(model.selectedOptionID == option.id ? Color.white : MSHColor.primaryText)
                                    .padding(.horizontal, 16)
                                    .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                                    .background(model.selectedOptionID == option.id ? MSHColor.accent : MSHColor.controlFill)
                                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .stroke(model.selectedOptionID == option.id ? Color.clear : MSHColor.border, lineWidth: 1)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        DisclosureGroup("Why are you asking?") {
                            Text(item.why)
                                .font(.subheadline)
                                .foregroundStyle(MSHColor.secondaryText)
                                .padding(.top, 8)
                        }
                        .foregroundStyle(MSHColor.primaryText)

                        HStack(spacing: 10) {
                            Button("Not sure") { model.skip(reason: .notSure) }
                                .buttonStyle(.bordered)
                                .tint(MSHColor.accent)
                            Button("Leave open") { model.skip(reason: .skippedItem) }
                                .buttonStyle(.bordered)
                                .tint(MSHColor.accent)
                        }

                        if model.selectedOptionID != nil {
                            Button("Continue") { model.continueForward() }
                                .buttonStyle(.borderedProminent)
                                .tint(MSHColor.accent)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                    }
                    .mshLandscapeCard()
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
    }

    private var summary: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                header(
                    eyebrow: "YOUR CURRENT PICTURE",
                    title: "Your Health Landscape",
                    subtitle: "This is a view of what you have told MSH. Nothing here has automatically become a goal, recommendation, or reminder."
                )

                VStack(spacing: 0) {
                    ForEach(model.summaries) { summary in
                        if let domain = MSHLandscapeCatalog.domain(summary.domainID) {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(domain.label)
                                        .font(.system(size: 19, weight: .medium, design: .serif))
                                        .foregroundStyle(MSHColor.primaryText)
                                    Spacer()
                                    Text(summary.state)
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(MSHColor.accent)
                                        .multilineTextAlignment(.trailing)
                                }
                                Text(summary.sentence)
                                    .font(.subheadline)
                                    .foregroundStyle(MSHColor.secondaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                                HStack(spacing: 8) {
                                    ForEach(0..<summary.itemCount, id: \.self) { index in
                                        Capsule()
                                            .fill(index < summary.observedCount ? MSHColor.accent : MSHColor.controlFill)
                                            .frame(height: 4)
                                    }
                                }
                            }
                            .padding(.vertical, 16)
                            if domain.id != model.summaries.last?.domainID {
                                Divider().overlay(MSHColor.border)
                            }
                        }
                    }
                }
                .mshLandscapeCard()

                VStack(alignment: .leading, spacing: 14) {
                    Text("WHAT MATTERS TO YOU")
                        .font(.caption.weight(.semibold))
                        .tracking(1.5)
                        .foregroundStyle(MSHColor.accent)
                    Text("Is there anywhere you want to look closer?")
                        .font(.system(size: 26, weight: .medium, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                    Text("You do not have to choose your lowest-rated area. Choose what feels meaningful, or simply keep this picture for later.")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                    ForEach(MSHLandscapeCatalog.domains) { domain in
                        Button {
                            model.start(domain: domain.id)
                        } label: {
                            HStack {
                                Text(domain.label)
                                Spacer()
                                Image(systemName: "arrow.right")
                            }
                            .foregroundStyle(MSHColor.primaryText)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                    }
                    Button("Keep my picture. No next step required.") {
                        model.backToLanding()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(MSHColor.accent)
                }
                .mshLandscapeCard()
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
    }

    private func header(eyebrow: String, title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(eyebrow)
                .font(.caption2.weight(.semibold))
                .tracking(2.0)
                .foregroundStyle(MSHColor.accent)
            Text(title)
                .font(.system(size: 34, weight: .medium, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)
            Text(subtitle)
                .font(.system(size: 16, design: .serif))
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private extension View {
    func mshLandscapeCard() -> some View {
        self
            .padding(20)
            .background(MSHColor.surface.opacity(0.9))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 1)
            }
    }
}

@MainActor
final class MSHLandscapeViewModel: ObservableObject {
    enum Stage { case landing, question, summary }
    enum MissingReason: String, Codable { case notSure = "NOT_SURE"; case skippedItem = "SKIPPED_ITEM" }

    @Published var stage: Stage = .landing
    @Published private(set) var record: MSHLandscapeRecord
    @Published private(set) var currentIndex = 0
    @Published var selectedOptionID: String?

    private let store: MSHLandscapeStore

    init(store: MSHLandscapeStore = MSHLandscapeStore()) {
        self.store = store
        record = store.load() ?? MSHLandscapeRecord.empty
        currentIndex = max(0, min(record.currentItemIndex, MSHLandscapeCatalog.items.count - 1))
    }

    var currentItem: MSHLandscapeItem? {
        guard MSHLandscapeCatalog.items.indices.contains(currentIndex) else { return nil }
        return MSHLandscapeCatalog.items[currentIndex]
    }

    var exploredCount: Int { record.responses.count }
    var progress: Double { Double(exploredCount) / Double(MSHLandscapeCatalog.items.count) }
    var hasProgress: Bool { record.status == .inProgress && !record.responses.isEmpty }
    var hasCompletedPicture: Bool { record.status == .completed }

    var summaries: [MSHLandscapeDomainSummary] {
        MSHLandscapeCatalog.domains.map { summarize($0.id) }
    }

    func domainState(_ domainID: String) -> String? {
        let summary = summarize(domainID)
        return summary.exploredCount > 0 ? summary.state : nil
    }

    func start(domain domainID: String) {
        if record.id.isEmpty || record.status == .completed {
            record = MSHLandscapeRecord.fresh()
        }
        let indices = MSHLandscapeCatalog.items.indices.filter { MSHLandscapeCatalog.items[$0].domain == domainID }
        currentIndex = indices.first(where: { index in
            !record.responses.contains(where: { $0.itemID == MSHLandscapeCatalog.items[index].id })
        }) ?? indices.first ?? 0
        record.currentItemIndex = currentIndex
        selectedOptionID = response(for: currentItem?.id)?.value
        persist()
        stage = .question
    }

    func resume() {
        let next = nextUnexploredIndex(after: max(-1, record.currentItemIndex - 1))
        currentIndex = next ?? max(0, min(record.currentItemIndex, MSHLandscapeCatalog.items.count - 1))
        selectedOptionID = response(for: currentItem?.id)?.value
        stage = next == nil ? .summary : .question
    }

    func answer(_ option: MSHLandscapeOption) {
        guard let item = currentItem else { return }
        let response = MSHLandscapeResponse(
            itemID: item.id,
            domain: item.domain,
            construct: item.construct,
            value: option.value,
            label: option.label,
            signal: option.signal,
            direction: option.direction,
            missingReason: nil,
            answeredAt: Date()
        )
        upsert(response)
        selectedOptionID = option.id
        persist()
    }

    func skip(reason: MissingReason) {
        guard let item = currentItem else { return }
        let response = MSHLandscapeResponse(
            itemID: item.id,
            domain: item.domain,
            construct: item.construct,
            value: nil,
            label: reason == .notSure ? "Not sure" : "Skipped",
            signal: nil,
            direction: nil,
            missingReason: reason.rawValue,
            answeredAt: Date()
        )
        upsert(response)
        persist()
        continueForward()
    }

    func continueForward() {
        guard response(for: currentItem?.id) != nil else { return }
        if let next = nextUnexploredIndex(after: currentIndex) {
            currentIndex = next
            record.currentItemIndex = next
            selectedOptionID = response(for: currentItem?.id)?.value
            persist()
            stage = .question
        } else {
            record.status = .completed
            record.completedAt = Date()
            persist()
            stage = .summary
        }
    }

    func showPartialSummary() { stage = .summary }
    func showCompletedSummary() { stage = .summary }
    func backToLanding() { persist(); stage = .landing }

    private func response(for itemID: String?) -> MSHLandscapeResponse? {
        guard let itemID else { return nil }
        return record.responses.first(where: { $0.itemID == itemID })
    }

    private func upsert(_ response: MSHLandscapeResponse) {
        record.responses.removeAll(where: { $0.itemID == response.itemID })
        record.responses.append(response)
        record.status = .inProgress
        record.updatedAt = Date()
    }

    private func nextUnexploredIndex(after index: Int) -> Int? {
        let explored = Set(record.responses.map(\.itemID))
        guard explored.count < MSHLandscapeCatalog.items.count else { return nil }
        for offset in 1...MSHLandscapeCatalog.items.count {
            let candidate = (max(-1, index) + offset + MSHLandscapeCatalog.items.count) % MSHLandscapeCatalog.items.count
            if !explored.contains(MSHLandscapeCatalog.items[candidate].id) { return candidate }
        }
        return nil
    }

    private func summarize(_ domainID: String) -> MSHLandscapeDomainSummary {
        let domainResponses = record.responses.filter { $0.domain == domainID }
        let observed = domainResponses.filter { $0.value != nil }
        let missing = domainResponses.filter { $0.value == nil }
        let itemCount = MSHLandscapeCatalog.items.filter { $0.domain == domainID }.count
        let attention = observed.filter { $0.signal == "attention" }.count
        let mixed = observed.filter { $0.signal == "mixed" }.count
        let fit = observed.filter { $0.signal == "fit" }.count
        let directional = observed.filter { $0.direction != nil && $0.direction != "fit" }

        var state = "Not explored yet"
        if !observed.isEmpty {
            state = "Fits well"
            if attention > 0 { state = "Worth noticing" }
            else if mixed > 0 { state = "Mixed" }
            if directional.count == observed.count && fit == 0 {
                let low = directional.filter { $0.direction == "low" }.count
                let high = directional.filter { $0.direction == "high" }.count
                if low == directional.count { state = "Less than fits right now" }
                if high == directional.count { state = "More than fits right now" }
            }
        } else if !missing.isEmpty {
            state = "Open for later"
        }

        let domain = MSHLandscapeCatalog.domain(domainID)
        let sentence: String
        if observed.isEmpty {
            sentence = missing.isEmpty ? "This part of the picture has not been explored yet." : "You left this part open. Nothing has been assumed in its place."
        } else if state == "Fits well" {
            sentence = "The \(domain?.label.lowercased() ?? domainID) signals explored so far generally fit well right now."
        } else if state == "More than fits right now" {
            sentence = "You described the amount here as more than feels right at the moment."
        } else if state == "Less than fits right now" {
            sentence = "You described the amount here as less than feels right at the moment."
        } else if state == "Worth noticing" {
            sentence = "Something in \(domain?.label.lowercased() ?? domainID) came into view as worth noticing. That does not mean it needs to become a goal."
        } else {
            sentence = "The \(domain?.label.lowercased() ?? domainID) signals explored so far are mixed. More context may change the picture."
        }

        return MSHLandscapeDomainSummary(
            domainID: domainID,
            state: state,
            sentence: sentence,
            exploredCount: domainResponses.count,
            observedCount: observed.count,
            missingCount: missing.count,
            itemCount: itemCount
        )
    }

    private func persist() {
        record.currentItemIndex = currentIndex
        record.updatedAt = Date()
        store.save(record)
    }
}

struct MSHLandscapeDomainSummary: Identifiable {
    var id: String { domainID }
    let domainID: String
    let state: String
    let sentence: String
    let exploredCount: Int
    let observedCount: Int
    let missingCount: Int
    let itemCount: Int
}

struct MSHLandscapeRecord: Codable {
    enum Status: String, Codable { case inProgress = "in_progress"; case completed }

    var id: String
    var instrumentVersion: String
    var experienceVersion: String
    var status: Status
    var startedAt: Date
    var updatedAt: Date
    var completedAt: Date?
    var currentItemIndex: Int
    var responses: [MSHLandscapeResponse]

    static var empty: Self {
        .init(id: "", instrumentVersion: MSHLandscapeCatalog.instrumentVersion, experienceVersion: MSHLandscapeCatalog.experienceVersion, status: .inProgress, startedAt: Date(), updatedAt: Date(), completedAt: nil, currentItemIndex: 0, responses: [])
    }

    static func fresh() -> Self {
        let now = Date()
        return .init(id: "landscape_\(UUID().uuidString)", instrumentVersion: MSHLandscapeCatalog.instrumentVersion, experienceVersion: MSHLandscapeCatalog.experienceVersion, status: .inProgress, startedAt: now, updatedAt: now, completedAt: nil, currentItemIndex: 0, responses: [])
    }
}

struct MSHLandscapeResponse: Codable {
    let itemID: String
    let domain: String
    let construct: String
    let value: String?
    let label: String
    let signal: String?
    let direction: String?
    let missingReason: String?
    let answeredAt: Date
}

struct MSHLandscapeStore {
    private let key = "msh.native.landscape.v1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    func load() -> MSHLandscapeRecord? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(MSHLandscapeRecord.self, from: data)
    }

    func save(_ record: MSHLandscapeRecord) {
        guard let data = try? JSONEncoder().encode(record) else { return }
        defaults.set(data, forKey: key)
    }
}

struct MSHLandscapeDomain: Identifiable {
    let id: String
    let label: String
    let description: String
    let symbol: String
}

struct MSHLandscapeOption: Identifiable {
    var id: String { value }
    let value: String
    let label: String
    let signal: String
    let direction: String?

    init(_ value: String, _ label: String, _ signal: String, direction: String? = nil) {
        self.value = value
        self.label = label
        self.signal = signal
        self.direction = direction
    }
}

struct MSHLandscapeItem: Identifiable {
    let id: String
    let domain: String
    let construct: String
    let prompt: String
    let why: String
    let options: [MSHLandscapeOption]
}

enum MSHLandscapeCatalog {
    static let instrumentVersion = "WL-PROTOTYPE-1"
    static let experienceVersion = "DIMENSIONS-OF-HEALTH-V2"

    static let fit5 = [
        MSHLandscapeOption("not_at_all", "Not at all", "attention"), MSHLandscapeOption("a_little", "A little", "attention"), MSHLandscapeOption("somewhat", "Somewhat", "mixed"), MSHLandscapeOption("mostly", "Mostly", "fit"), MSHLandscapeOption("very_well", "Very well", "fit")
    ]
    static let amountFit5 = [
        MSHLandscapeOption("much_too_little", "Much too little", "attention", direction: "low"), MSHLandscapeOption("a_little_too_little", "A little too little", "mixed", direction: "low"), MSHLandscapeOption("about_right", "About right", "fit", direction: "fit"), MSHLandscapeOption("a_little_too_much", "A little too much", "mixed", direction: "high"), MSHLandscapeOption("much_too_much", "Much too much", "attention", direction: "high")
    ]
    static let frequencyPositive5 = [
        MSHLandscapeOption("rarely", "Rarely", "attention"), MSHLandscapeOption("not_often", "Not often", "attention"), MSHLandscapeOption("sometimes", "Sometimes", "mixed"), MSHLandscapeOption("often", "Often", "fit"), MSHLandscapeOption("almost_always", "Almost always", "fit")
    ]
    static let frequencyBurden5 = [
        MSHLandscapeOption("rarely", "Rarely", "fit"), MSHLandscapeOption("not_often", "Not often", "fit"), MSHLandscapeOption("sometimes", "Sometimes", "mixed"), MSHLandscapeOption("often", "Often", "attention"), MSHLandscapeOption("almost_always", "Almost always", "attention")
    ]
    static let manageability5 = [
        MSHLandscapeOption("not_manageable", "Not manageable", "attention"), MSHLandscapeOption("barely_manageable", "Barely manageable", "attention"), MSHLandscapeOption("somewhat_manageable", "Somewhat manageable", "mixed"), MSHLandscapeOption("mostly_manageable", "Mostly manageable", "fit"), MSHLandscapeOption("very_manageable", "Very manageable", "fit")
    ]

    static let domains: [MSHLandscapeDomain] = [
        .init(id: "physical", label: "Physical", description: "Energy, restoration, physical function, and interference.", symbol: "figure.walk"),
        .init(id: "emotional", label: "Emotional", description: "Understanding emotions and responding when they are difficult.", symbol: "heart"),
        .init(id: "social", label: "Social", description: "Connection, usable support, relationship quality, and interaction fit.", symbol: "person.2"),
        .init(id: "environment", label: "Environment", description: "Safety, comfort, and whether your surroundings support everyday life.", symbol: "house"),
        .init(id: "work", label: "Work & Responsibilities", description: "The value, function, and fit of the responsibilities you carry.", symbol: "briefcase"),
        .init(id: "financial", label: "Financial", description: "Sufficiency, strain, and room for unexpected needs.", symbol: "dollarsign.circle"),
        .init(id: "mental", label: "Mental Engagement", description: "Whether the amount and kind of mental engagement fit you.", symbol: "brain.head.profile"),
        .init(id: "meaning", label: "What Matters", description: "Meaning, direction, and alignment with what matters to you.", symbol: "sparkles"),
        .init(id: "whole", label: "Whole Life", description: "How manageable your overall plate feels and how well the pieces fit together.", symbol: "circle.hexagongrid")
    ]

    static let items: [MSHLandscapeItem] = [
        .init(id:"PHY-01",domain:"physical",construct:"energy",prompt:"How well does your physical energy support the things you need and want to do?",why:"This looks at whether your available physical energy supports everyday life, not how productive or active you are.",options:fit5),
        .init(id:"PHY-02",domain:"physical",construct:"restoration",prompt:"How often do you feel physically restored enough for the life you are living?",why:"Restoration is about whether your body feels replenished enough for your current demands.",options:frequencyPositive5),
        .init(id:"PHY-03",domain:"physical",construct:"meaningful_function",prompt:"How well can your body do the everyday things that matter to you?",why:"This focuses on personally meaningful function rather than comparing your ability with anyone else.",options:fit5),
        .init(id:"PHY-04",domain:"physical",construct:"interference",prompt:"How often do physical symptoms, discomfort, or limitations interfere with the things you need or want to do?",why:"This asks about interference with your life. It does not diagnose the reason for that interference.",options:frequencyBurden5),
        .init(id:"EMO-01",domain:"emotional",construct:"clarity",prompt:"How well can you usually make sense of what you are feeling?",why:"Emotional clarity is the ability to recognize and understand your emotional experience, not the absence of difficult emotions.",options:fit5),
        .init(id:"EMO-02",domain:"emotional",construct:"response_capacity",prompt:"When emotions are difficult, how well can you respond in ways that work for you and the situation?",why:"This asks about your ability to respond to emotions, not whether you experience them.",options:fit5),
        .init(id:"SOC-01",domain:"social",construct:"unwanted_disconnection",prompt:"How often do you feel more disconnected from other people than you want to be?",why:"The focus is unwanted disconnection. A small social life is not automatically a problem if it fits you.",options:frequencyBurden5),
        .init(id:"SOC-02",domain:"social",construct:"support_availability",prompt:"When you genuinely need support, how available does it feel to you?",why:"This asks whether support is available when needed, not how many people are in your network.",options:fit5),
        .init(id:"SOC-03",domain:"social",construct:"support_fit",prompt:"How well does the support available to you fit the kind of help you would actually want?",why:"Support can exist without being the right kind of support for the situation or the person.",options:fit5),
        .init(id:"SOC-04",domain:"social",construct:"relationship_quality",prompt:"Overall, how well do your important relationships work for you right now?",why:"This is a broad relationship-quality reflection. You can add context if one relationship differs from the overall picture.",options:fit5),
        .init(id:"SOC-05",domain:"social",construct:"interaction_amount_fit",prompt:"How does the amount of social interaction in your life feel for you right now?",why:"More interaction is not automatically better. This asks whether the amount fits you.",options:amountFit5),
        .init(id:"ENV-01",domain:"environment",construct:"safety",prompt:"How safe do the environments where you spend most of your time generally feel?",why:"This asks about your lived sense of safety in your usual environments.",options:fit5),
        .init(id:"ENV-02",domain:"environment",construct:"comfort",prompt:"How comfortable are the environments where you spend most of your time?",why:"Comfort can include noise, temperature, privacy, crowding, sensory conditions, and other features that affect daily life.",options:fit5),
        .init(id:"ENV-03",domain:"environment",construct:"functional_support",prompt:"How well do your surroundings support the everyday things you need and want to do?",why:"This looks at whether your environment makes everyday functioning easier or harder.",options:fit5),
        .init(id:"WRK-01",domain:"work",construct:"role_value",prompt:"How worthwhile do your current responsibilities feel to you overall?",why:"Responsibilities can include paid work, school, homemaking, parenting, caregiving, personal management, and other meaningful roles.",options:fit5),
        .init(id:"WRK-02",domain:"work",construct:"role_function",prompt:"How workable is the way your current responsibilities are structured?",why:"This asks whether the structure of your responsibilities works in practice, not whether the responsibilities are easy.",options:fit5),
        .init(id:"WRK-03",domain:"work",construct:"role_fit",prompt:"How well do your current responsibilities fit the life you are trying to live?",why:"A role can be meaningful and still fit poorly with other important parts of life.",options:fit5),
        .init(id:"FIN-01",domain:"financial",construct:"sufficiency",prompt:"How well are your current financial resources covering the things you need?",why:"This is about sufficiency relative to your actual needs, not income level or comparison with other people.",options:fit5),
        .init(id:"FIN-02",domain:"financial",construct:"strain",prompt:"How often does managing current financial needs feel difficult or stressful?",why:"Financial strain describes the burden of maintaining current needs, even when those needs may technically be met.",options:frequencyBurden5),
        .init(id:"FIN-03",domain:"financial",construct:"margin",prompt:"How much room do your finances currently have for an unexpected need or change?",why:"Margin asks whether the current financial system has room to absorb disruption.",options:[.init("none","None","attention"),.init("very_little","Very little","attention"),.init("some","Some","mixed"),.init("a_good_amount","A good amount","fit"),.init("plenty","Plenty","fit")]),
        .init(id:"MEN-01",domain:"mental",construct:"amount_fit",prompt:"How does the amount of mental engagement in your life feel right now?",why:"Mental engagement includes concentrating, learning, planning, problem-solving, and other sustained mental effort. More is not automatically better.",options:amountFit5),
        .init(id:"MEN-02",domain:"mental",construct:"kind_fit",prompt:"How well do the kinds of things engaging your mind fit your interests, needs, or what matters to you?",why:"This separates the amount of mental engagement from whether the content itself feels worthwhile or fitting.",options:fit5),
        .init(id:"MAT-01",domain:"meaning",construct:"meaning",prompt:"How much does your life currently include things that feel meaningful to you?",why:"Meaning is personal. This does not assume which activities, roles, beliefs, or relationships should provide it.",options:fit5),
        .init(id:"MAT-02",domain:"meaning",construct:"direction",prompt:"How clear does your current sense of direction feel?",why:"Direction can be clear, emerging, or uncertain. Uncertainty is not automatically a problem unless it matters to you.",options:fit5),
        .init(id:"MAT-03",domain:"meaning",construct:"alignment",prompt:"How well does the way you are living currently line up with what matters to you?",why:"This asks about alignment between everyday life and what you consider important.",options:fit5),
        .init(id:"WHO-01",domain:"whole",construct:"capacity",prompt:"How manageable does everything you are carrying feel right now?",why:"This looks at your overall plate. Time, mental energy, physical energy, emotional demand, responsibility, and other demands can all affect manageability.",options:manageability5),
        .init(id:"WHO-02",domain:"whole",construct:"integration",prompt:"How well are the important parts of your life working together right now?",why:"This asks whether important parts of life can coexist without unnecessary conflict, not whether every part is equally important.",options:fit5)
    ]

    static func domain(_ id: String) -> MSHLandscapeDomain? { domains.first(where: { $0.id == id }) }
}
