import SwiftUI
import WebKit
import Combine

struct MSHMeditateScreen: View {
    private enum Mode: String, CaseIterable, Identifiable {
        case quiet = "Quiet"
        case read = "Read & Reflect"
        case listen = "Listen"
        case reflect = "Reflect"

        var id: Self { self }
    }

    @State private var mode: Mode = .quiet
    @State private var selectedMinutes = 10
    @State private var remainingSeconds = 10 * 60
    @State private var isRunning = false
    @State private var searchText = ""
    @State private var searchURL: URL?

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let durations = [5, 10, 20, 30]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    header
                    modePicker
                    sessionCard
                    modeContent
                }
                .padding(MSHSpacing.medium)
            }
        }
        .navigationTitle("Meditate")
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(timer) { _ in
            guard isRunning, remainingSeconds > 0 else { return }
            remainingSeconds -= 1
            if remainingSeconds == 0 {
                isRunning = false
            }
        }
        .onChange(of: selectedMinutes) { _, newValue in
            guard !isRunning else { return }
            remainingSeconds = newValue * 60
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("Meditate")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)

            Text("Make space for quiet, reflection, prayer, meaningful reading, or sound without prescribing what the practice should be.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var modePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MSHSpacing.small) {
                ForEach(Mode.allCases) { item in
                    Button {
                        mode = item
                    } label: {
                        Text(item.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(mode == item ? MSHColor.warmWhite : MSHColor.primaryText)
                            .padding(.horizontal, MSHSpacing.medium)
                            .frame(height: 38)
                            .background(mode == item ? MSHColor.forest : MSHColor.surface)
                            .clipShape(Capsule())
                            .overlay {
                                if mode != item {
                                    Capsule().stroke(MSHColor.border, lineWidth: 1)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var sessionCard: some View {
        VStack(spacing: MSHSpacing.medium) {
            Text(timeString)
                .font(.system(size: 54, weight: .light, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(MSHColor.primaryText)

            HStack(spacing: MSHSpacing.small) {
                ForEach(durations, id: \.self) { minutes in
                    Button("\(minutes)") {
                        guard !isRunning else { return }
                        selectedMinutes = minutes
                        remainingSeconds = minutes * 60
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(selectedMinutes == minutes ? MSHColor.warmWhite : MSHColor.primaryText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(selectedMinutes == minutes ? MSHColor.forest : MSHColor.canvas)
                    .clipShape(Capsule())
                    .disabled(isRunning)
                }
            }

            HStack(spacing: MSHSpacing.small) {
                Button {
                    isRunning.toggle()
                } label: {
                    Label(isRunning ? "Pause" : "Start session", systemImage: isRunning ? "pause.fill" : "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MSHColor.warmWhite)
                .background(MSHColor.forest)
                .clipShape(Capsule())

                Button {
                    isRunning = false
                    remainingSeconds = selectedMinutes * 60
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.headline)
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MSHColor.primaryText)
                .background(MSHColor.canvas)
                .clipShape(Circle())
                .accessibilityLabel("Reset timer")
            }
        }
        .mshSurface()
    }

    @ViewBuilder
    private var modeContent: some View {
        switch mode {
        case .quiet:
            informationCard(
                title: "Quiet",
                text: "Use the timer for silence, prayer, breathing, contemplation, or simply sitting without another task.",
                image: "moon.stars"
            )

        case .read:
            readAndReflect

        case .listen:
            VStack(alignment: .leading, spacing: MSHSpacing.medium) {
                informationCard(
                    title: "Sound environment",
                    text: "Choose an audio environment while your timer keeps running. The first build establishes the session space; playable audio sources are the next layer.",
                    image: "waveform"
                )

                soundPreview(title: "Nature sounds", subtitle: "Rain, ocean, forest, stream", image: "leaf")
                soundPreview(title: "Frequency audio", subtitle: "Optional gamma-frequency and other tone-based tracks", image: "waveform.path")
                soundPreview(title: "Relaxation music", subtitle: "Evidence-informed calming music, with claims kept separate from preference", image: "music.note")
            }

        case .reflect:
            informationCard(
                title: "Reflect",
                text: "A future home for My Simple Health cards, saved prompts, and personal reflections you choose to sit with.",
                image: "rectangle.stack"
            )
        }
    }

    private var readAndReflect: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            VStack(alignment: .leading, spacing: MSHSpacing.small) {
                Text("Search your own source")
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)

                Text("MSH does not choose a book or belief system. Search for a passage, topic, affirmation, or source and read it inside this meditation space.")
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)

                HStack(spacing: MSHSpacing.small) {
                    TextField("Psalm 23, patience, affirmation...", text: $searchText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding(.horizontal, MSHSpacing.medium)
                        .frame(height: 46)
                        .background(MSHColor.canvas)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

                    Button {
                        performSearch()
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.headline)
                            .frame(width: 46, height: 46)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(MSHColor.warmWhite)
                    .background(MSHColor.forest)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))
                    .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .mshSurface()

            if let searchURL {
                VStack(alignment: .leading, spacing: MSHSpacing.small) {
                    HStack {
                        Text("Reader")
                            .font(MSHTypography.cardTitle)
                            .foregroundStyle(MSHColor.primaryText)
                        Spacer()
                        Button("Clear") {
                            self.searchURL = nil
                        }
                        .font(.subheadline.weight(.semibold))
                    }

                    MSHMeditateWebReader(url: searchURL)
                        .frame(minHeight: 520)
                        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                }
            }
        }
    }

    private func informationCard(title: String, text: String, image: String) -> some View {
        HStack(alignment: .top, spacing: MSHSpacing.medium) {
            Image(systemName: image)
                .font(.title2)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 44, height: 44)
                .background(MSHColor.sage.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: MSHRadius.small, style: .continuous))

            VStack(alignment: .leading, spacing: MSHSpacing.xSmall) {
                Text(title)
                    .font(MSHTypography.cardTitle)
                    .foregroundStyle(MSHColor.primaryText)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .mshSurface()
    }

    private func soundPreview(title: String, subtitle: String, image: String) -> some View {
        HStack(spacing: MSHSpacing.medium) {
            Image(systemName: image)
                .foregroundStyle(MSHColor.accent)
                .frame(width: 38, height: 38)
                .background(MSHColor.sage.opacity(0.14))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(MSHColor.secondaryText)
            }

            Spacer()

            Text("Next")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText)
        }
        .padding(MSHSpacing.medium)
        .background(MSHColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                .stroke(MSHColor.border, lineWidth: 1)
        }
    }

    private var timeString: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func performSearch() {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }

        var components = URLComponents(string: "https://www.google.com/search")
        components?.queryItems = [URLQueryItem(name: "q", value: query)]
        searchURL = components?.url
    }
}

private struct MSHMeditateWebReader: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.allowsBackForwardNavigationGestures = true
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url != url {
            webView.load(URLRequest(url: url))
        }
    }
}
