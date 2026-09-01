import SwiftUI

struct MSHReaderScreen: View {
    private enum ReaderKind: String, CaseIterable, Identifiable {
        case poetry = "Poetry"
        case scripture = "Scripture"
        case essay = "Essay"
        case image = "Image"

        var id: Self { self }

        var systemImage: String {
            switch self {
            case .poetry: "quote.bubble"
            case .scripture: "book.closed"
            case .essay: "doc.text"
            case .image: "photo"
            }
        }
    }

    @State private var selectedKind: ReaderKind = .poetry
    @State private var request = ""
    @State private var title = ""
    @State private var source = ""
    @State private var readingText = ""
    @State private var note = ""
    @State private var showingReader = false

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("Reader")
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Text("Bring something here to read. The source stays primary; OpenAI can sit beside it to explain, give context, reflect, or answer questions.")
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Text("What would you like to read?")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MSHSpacing.small) {
                            ForEach(ReaderKind.allCases) { kind in
                                Button {
                                    selectedKind = kind
                                } label: {
                                    HStack(spacing: MSHSpacing.small) {
                                        Image(systemName: kind.systemImage)
                                        Text(kind.rawValue)
                                            .font(.subheadline.weight(.semibold))
                                        Spacer(minLength: 0)
                                    }
                                    .foregroundStyle(selectedKind == kind ? MSHColor.warmWhite : MSHColor.primaryText)
                                    .padding(MSHSpacing.small)
                                    .background(selectedKind == kind ? MSHColor.forest : MSHColor.controlFill)
                                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        TextField("Try: a poem, passage, essay, or image", text: $request, axis: .vertical)
                            .lineLimit(2...4)
                            .padding(MSHSpacing.medium)
                            .background(MSHColor.controlFill)
                            .foregroundStyle(MSHColor.primaryText)
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                                    .stroke(MSHColor.border, lineWidth: 1)
                            }

                        Text("For this first Reader build, paste the text you want to read below. OpenAI retrieval and source lookup will be connected separately so the app does not invent or silently alter source text.")
                            .font(.footnote)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .mshSurface()

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        Text("Reading")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        TextField("Title", text: $title)
                            .readerFieldStyle()

                        TextField("Source or attribution", text: $source)
                            .readerFieldStyle()

                        ZStack(alignment: .topLeading) {
                            if readingText.isEmpty {
                                Text("Paste or type the reading here…")
                                    .font(MSHTypography.body)
                                    .foregroundStyle(MSHColor.secondaryText)
                                    .padding(.horizontal, MSHSpacing.medium)
                                    .padding(.vertical, 18)
                                    .allowsHitTesting(false)
                            }

                            TextEditor(text: $readingText)
                                .font(.system(.body, design: .serif))
                                .foregroundStyle(MSHColor.primaryText)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 180)
                                .padding(MSHSpacing.small)
                        }
                        .background(MSHColor.controlFill)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                                .stroke(MSHColor.border, lineWidth: 1)
                        }

                        Button {
                            showingReader = true
                        } label: {
                            Text("Open Reader")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(MSHColor.warmWhite)
                        .background(MSHColor.forest)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                        .disabled(readingText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .opacity(readingText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                    }
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Reader")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $showingReader) {
            MSHReadingSurface(
                title: title.isEmpty ? selectedKind.rawValue : title,
                source: source,
                text: readingText,
                note: $note
            )
        }
    }
}

private struct MSHReadingSurface: View {
    let title: String
    let source: String
    let text: String
    @Binding var note: String

    @State private var assistantPrompt = ""
    @State private var selectedAction: String?

    private let actions: [(String, String)] = [
        ("Explain", "text.magnifyingglass"),
        ("Context", "books.vertical"),
        ("Reflect", "sparkles"),
        ("Ask", "bubble.left.and.bubble.right")
    ]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text(title)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        if !source.isEmpty {
                            Text(source)
                                .font(.subheadline)
                                .foregroundStyle(MSHColor.secondaryText)
                        }
                    }

                    Text(text)
                        .font(.system(.title3, design: .serif))
                        .foregroundStyle(MSHColor.primaryText)
                        .lineSpacing(7)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(MSHSpacing.large)
                        .background(MSHColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                                .stroke(MSHColor.border, lineWidth: 1)
                        }

                    VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                        HStack {
                            Text("OpenAI beside the reading")
                                .font(MSHTypography.cardTitle)
                                .foregroundStyle(MSHColor.primaryText)
                            Spacer()
                            Image(systemName: "sparkles")
                                .foregroundStyle(MSHColor.accent)
                        }

                        Text("The reading remains the source of truth. These controls are the Reader interface; the live OpenAI request layer is the next connection step.")
                            .font(.footnote)
                            .foregroundStyle(MSHColor.secondaryText)

                        HStack(spacing: MSHSpacing.small) {
                            ForEach(actions, id: \.0) { action in
                                Button {
                                    selectedAction = action.0
                                    assistantPrompt = action.0 == "Ask" ? "" : "\(action.0) this reading"
                                } label: {
                                    VStack(spacing: 5) {
                                        Image(systemName: action.1)
                                        Text(action.0)
                                            .font(.caption.weight(.semibold))
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, MSHSpacing.small)
                                    .foregroundStyle(selectedAction == action.0 ? MSHColor.warmWhite : MSHColor.primaryText)
                                    .background(selectedAction == action.0 ? MSHColor.forest : MSHColor.controlFill)
                                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        TextField("Ask about this reading", text: $assistantPrompt, axis: .vertical)
                            .lineLimit(1...4)
                            .readerFieldStyle()
                    }
                    .mshSurface()

                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Text("My note")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        TextEditor(text: $note)
                            .frame(minHeight: 110)
                            .scrollContentBackground(.hidden)
                            .padding(MSHSpacing.small)
                            .background(MSHColor.controlFill)
                            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                    }
                    .mshSurface()
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Reader")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private extension View {
    func readerFieldStyle() -> some View {
        self
            .padding(.horizontal, MSHSpacing.medium)
            .frame(minHeight: 48)
            .background(MSHColor.controlFill)
            .foregroundStyle(MSHColor.primaryText)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 1)
            }
    }
}
