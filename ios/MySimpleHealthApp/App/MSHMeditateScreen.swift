import SwiftUI
import Combine
import UIKit
import AudioToolbox

struct MSHMeditateScreen: View {
    private enum Practice: String, CaseIterable, Identifiable {
        case meditation = "Meditation"
        case breathwork = "Breathwork"
        case bodyScan = "Body Scan"
        case quietTimer = "Quiet Timer"

        var id: Self { self }

        var image: String {
            switch self {
            case .meditation: "brain.head.profile"
            case .breathwork: "wind"
            case .bodyScan: "figure.mind.and.body"
            case .quietTimer: "timer"
            }
        }
    }

    private enum MeditationStyle: String, CaseIterable, Identifiable {
        case guided = "Guided"
        case selfGuided = "Self-guided"
        case prayerReflection = "Prayer & reflection"

        var id: Self { self }
    }

    private enum BreathPattern: String, CaseIterable, Identifiable {
        case simple = "Simple breathing"
        case longerExhale = "Longer exhale"
        case box = "Box breathing"
        case custom = "Custom"

        var id: Self { self }

        var detail: String {
            switch self {
            case .simple: "An even, comfortable pace."
            case .longerExhale: "Exhale a little longer than you inhale."
            case .box: "Equal inhale, hold, exhale, and hold phases."
            case .custom: "Choose the timing that feels comfortable for you."
            }
        }
    }

    private enum BreathPhaseKind {
        case inhale
        case hold
        case exhale
        case rest
    }

    private struct BreathPhase: Identifiable {
        let kind: BreathPhaseKind
        let label: String
        let duration: Int
        var id: String { "\(label)-\(duration)-\(kindID)" }

        private var kindID: String {
            switch kind {
            case .inhale: "inhale"
            case .hold: "hold"
            case .exhale: "exhale"
            case .rest: "rest"
            }
        }
    }

    private enum Reflection: String, CaseIterable, Identifiable {
        case calmer = "Calmer"
        case same = "Same"
        case moreAlert = "More alert"
        case other = "Other"

        var id: Self { self }
    }

    @State private var practice: Practice = .meditation
    @State private var meditationStyle: MeditationStyle = .selfGuided
    @State private var breathPattern: BreathPattern = .simple
    @State private var selectedMinutes = 10
    @State private var remainingSeconds = 10 * 60
    @State private var isRunning = false
    @State private var showCompletion = false
    @State private var reflection: Reflection?

    @State private var breathPhaseIndex = 0
    @State private var breathPhaseRemaining = 4
    @State private var customInhale = 4
    @State private var customHold = 0
    @State private var customExhale = 6

    @State private var bodyRegionIndex = 0
    @State private var startEndCueEnabled = true
    @State private var hapticsEnabled = true

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let bodyRegions = ["Head", "Jaw", "Shoulders", "Chest", "Abdomen", "Hips", "Legs", "Feet"]

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: MSHSpacing.large) {
                    header
                    practicePicker
                    practiceContent
                    sessionCard
                }
                .padding(MSHSpacing.medium)
            }

            if showCompletion {
                completionOverlay
            }
        }
        .navigationTitle("Meditate")
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(timer) { _ in
            tick()
        }
        .onChange(of: practice) { _, _ in
            resetSession(forNewPractice: true)
        }
        .onChange(of: selectedMinutes) { _, newValue in
            guard !isRunning else { return }
            remainingSeconds = newValue * 60
        }
        .onChange(of: breathPattern) { _, _ in
            resetBreathCycle()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.small) {
            Text("Meditate")
                .font(MSHTypography.destinationTitle)
                .foregroundStyle(MSHColor.primaryText)

            Text("Choose a practice, begin simply, and return to your day when you are done.")
                .font(MSHTypography.body)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var practicePicker: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: MSHSpacing.small) {
            ForEach(Practice.allCases) { item in
                Button {
                    practice = item
                } label: {
                    VStack(alignment: .leading, spacing: MSHSpacing.small) {
                        Image(systemName: item.image)
                            .font(.title3)
                        Text(item.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .multilineTextAlignment(.leading)
                    }
                    .foregroundStyle(practice == item ? MSHColor.warmWhite : MSHColor.primaryText)
                    .frame(maxWidth: .infinity, minHeight: 82, alignment: .leading)
                    .padding(MSHSpacing.medium)
                    .background(practice == item ? MSHColor.forest : MSHColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
                    .overlay {
                        if practice != item {
                            RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                                .stroke(MSHColor.border, lineWidth: 1)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var practiceContent: some View {
        switch practice {
        case .meditation:
            meditationContent
        case .breathwork:
            breathworkContent
        case .bodyScan:
            bodyScanContent
        case .quietTimer:
            quietTimerContent
        }
    }

    private var meditationContent: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            practiceHeading(
                title: "Meditation",
                text: "Choose the kind of space you want. The timer keeps the session simple without requiring a recording.",
                image: "brain.head.profile"
            )

            Picker("Meditation style", selection: $meditationStyle) {
                ForEach(MeditationStyle.allCases) { style in
                    Text(style.rawValue).tag(style)
                }
            }
            .pickerStyle(.menu)
            .tint(MSHColor.accent)

            Text(meditationStyleDescription)
                .font(.subheadline)
                .foregroundStyle(MSHColor.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .mshSurface()
    }

    private var breathworkContent: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            practiceHeading(
                title: "Breathwork",
                text: "Use a gentle visual pace for breathing. Stop the pattern and breathe normally whenever you want.",
                image: "wind"
            )

            VStack(spacing: MSHSpacing.small) {
                ForEach(BreathPattern.allCases) { pattern in
                    Button {
                        breathPattern = pattern
                    } label: {
                        HStack(alignment: .top, spacing: MSHSpacing.small) {
                            Image(systemName: breathPattern == pattern ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(breathPattern == pattern ? MSHColor.accent : MSHColor.secondaryText)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(pattern.rawValue)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(MSHColor.primaryText)
                                Text(pattern.detail)
                                    .font(.caption)
                                    .foregroundStyle(MSHColor.secondaryText)
                                    .multilineTextAlignment(.leading)
                            }
                            Spacer()
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                }
            }

            if breathPattern == .custom {
                VStack(spacing: MSHSpacing.small) {
                    Stepper("Inhale: \(customInhale) sec", value: $customInhale, in: 2...10)
                    Stepper("Hold: \(customHold) sec", value: $customHold, in: 0...10)
                    Stepper("Exhale: \(customExhale) sec", value: $customExhale, in: 2...12)
                }
                .font(.subheadline)
                .onChange(of: customInhale) { _, _ in resetBreathCycle() }
                .onChange(of: customHold) { _, _ in resetBreathCycle() }
                .onChange(of: customExhale) { _, _ in resetBreathCycle() }
            }

            breathingGuide
        }
        .mshSurface()
    }

    private var breathingGuide: some View {
        VStack(spacing: MSHSpacing.medium) {
            ZStack {
                Circle()
                    .fill(MSHColor.sage.opacity(0.14))
                    .frame(width: 180, height: 180)

                Circle()
                    .fill(MSHColor.accent.opacity(0.22))
                    .frame(width: 132, height: 132)
                    .scaleEffect(breathVisualScale)
                    .animation(
                        .easeInOut(duration: Double(max(1, currentBreathPhase.duration))),
                        value: breathPhaseIndex
                    )

                VStack(spacing: 5) {
                    Text(currentBreathPhase.label.uppercased())
                        .font(.caption.weight(.semibold))
                        .tracking(1.2)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text("\(breathPhaseRemaining)")
                        .font(.system(size: 36, weight: .light, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(MSHColor.primaryText)
                }
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(currentBreathPhase.label), \(breathPhaseRemaining) seconds")

            Text("Follow the guide only if the pace feels comfortable.")
                .font(.caption)
                .foregroundStyle(MSHColor.secondaryText)
        }
    }

    private var bodyScanContent: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            practiceHeading(
                title: "Body Scan",
                text: "Move attention gradually through the body. Notice sensations without needing to change them.",
                image: "figure.mind.and.body"
            )

            VStack(spacing: MSHSpacing.small) {
                Text("Current area")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(MSHColor.secondaryText)
                    .textCase(.uppercase)
                Text(bodyRegions[bodyRegionIndex])
                    .font(.system(size: 34, weight: .light, design: .rounded))
                    .foregroundStyle(MSHColor.primaryText)

                ProgressView(value: Double(bodyRegionIndex + 1), total: Double(bodyRegions.count))
                    .tint(MSHColor.accent)

                HStack {
                    Button("Previous") {
                        bodyRegionIndex = max(0, bodyRegionIndex - 1)
                    }
                    .disabled(bodyRegionIndex == 0)

                    Spacer()

                    Button(bodyRegionIndex == bodyRegions.count - 1 ? "Start over" : "Next") {
                        bodyRegionIndex = bodyRegionIndex == bodyRegions.count - 1 ? 0 : bodyRegionIndex + 1
                    }
                }
                .font(.subheadline.weight(.semibold))
                .tint(MSHColor.accent)
            }
        }
        .mshSurface()
    }

    private var quietTimerContent: some View {
        VStack(alignment: .leading, spacing: MSHSpacing.medium) {
            practiceHeading(
                title: "Quiet Timer",
                text: "Use an uncluttered timer for silence, prayer, reflection, or simply sitting without another task.",
                image: "timer"
            )

            Toggle("Start and ending cue", isOn: $startEndCueEnabled)
                .tint(MSHColor.accent)
            Toggle("Gentle haptic cue", isOn: $hapticsEnabled)
                .tint(MSHColor.accent)

            Text("No ambient audio is added automatically. Quiet stays quiet unless you choose something else outside this session.")
                .font(.caption)
                .foregroundStyle(MSHColor.secondaryText)
        }
        .mshSurface()
    }

    private var sessionCard: some View {
        VStack(spacing: MSHSpacing.medium) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("SESSION")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.1)
                        .foregroundStyle(MSHColor.secondaryText)
                    Text(practice.rawValue)
                        .font(.headline)
                        .foregroundStyle(MSHColor.primaryText)
                }
                Spacer()
                Text(timeString)
                    .font(.system(size: 38, weight: .light, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(MSHColor.primaryText)
            }

            durationPicker

            Stepper("Custom duration: \(selectedMinutes) min", value: $selectedMinutes, in: 1...60)
                .font(.subheadline)
                .disabled(isRunning)

            HStack(spacing: MSHSpacing.small) {
                Button {
                    toggleSession()
                } label: {
                    Label(isRunning ? "Pause" : "Start", systemImage: isRunning ? "pause.fill" : "play.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MSHColor.warmWhite)
                .background(MSHColor.forest)
                .clipShape(Capsule())

                Button {
                    resetSession(forNewPractice: false)
                } label: {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.headline)
                        .frame(width: 48, height: 48)
                }
                .buttonStyle(.plain)
                .foregroundStyle(MSHColor.primaryText)
                .background(MSHColor.controlFill)
                .clipShape(Circle())
                .accessibilityLabel("Reset session")
            }
        }
        .mshSurface()
    }

    private var durationPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: MSHSpacing.small) {
                ForEach(durations, id: \.self) { minutes in
                    Button("\(minutes) min") {
                        guard !isRunning else { return }
                        selectedMinutes = minutes
                        remainingSeconds = minutes * 60
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(selectedMinutes == minutes ? MSHColor.warmWhite : MSHColor.primaryText)
                    .padding(.horizontal, MSHSpacing.medium)
                    .frame(height: 36)
                    .background(selectedMinutes == minutes ? MSHColor.forest : MSHColor.controlFill)
                    .clipShape(Capsule())
                    .disabled(isRunning)
                }
            }
        }
    }

    private var completionOverlay: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()

            VStack(alignment: .leading, spacing: MSHSpacing.large) {
                VStack(alignment: .leading, spacing: MSHSpacing.small) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32, weight: .regular))
                        .foregroundStyle(MSHColor.accent)
                    Text("Session complete")
                        .font(MSHTypography.destinationTitle)
                        .foregroundStyle(MSHColor.primaryText)
                    Text("\(selectedMinutes) minutes · \(practice.rawValue)")
                        .font(.subheadline)
                        .foregroundStyle(MSHColor.secondaryText)
                }

                VStack(alignment: .leading, spacing: MSHSpacing.small) {
                    Text("How do you feel now?")
                        .font(MSHTypography.cardTitle)
                        .foregroundStyle(MSHColor.primaryText)

                    FlowLayout(spacing: MSHSpacing.small) {
                        ForEach(Reflection.allCases) { option in
                            Button(option.rawValue) {
                                reflection = option
                            }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(reflection == option ? MSHColor.warmWhite : MSHColor.primaryText)
                            .padding(.horizontal, MSHSpacing.medium)
                            .frame(height: 38)
                            .background(reflection == option ? MSHColor.forest : MSHColor.controlFill)
                            .clipShape(Capsule())
                        }
                    }
                }

                HStack {
                    Button("Skip") {
                        reflection = nil
                        dismissCompletion()
                    }
                    .foregroundStyle(MSHColor.secondaryText)

                    Spacer()

                    Button("Done") {
                        dismissCompletion()
                    }
                    .font(.headline)
                    .foregroundStyle(MSHColor.warmWhite)
                    .padding(.horizontal, MSHSpacing.large)
                    .frame(height: 46)
                    .background(MSHColor.forest)
                    .clipShape(Capsule())
                }
            }
            .padding(MSHSpacing.large)
            .background(MSHColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: MSHRadius.medium, style: .continuous)
                    .stroke(MSHColor.border, lineWidth: 1)
            }
            .padding(MSHSpacing.large)
        }
    }

    private func practiceHeading(title: String, text: String, image: String) -> some View {
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
    }

    private var meditationStyleDescription: String {
        switch meditationStyle {
        case .guided:
            "Use the session timer as a light structure. Recorded guided sessions can be added later without changing this practice flow."
        case .selfGuided:
            "Sit in your own way with only the timer keeping time."
        case .prayerReflection:
            "Use the session for prayer, reflection, or another personally meaningful contemplative practice."
        }
    }

    private var durations: [Int] {
        switch practice {
        case .meditation: [2, 5, 10, 15, 20]
        case .breathwork: [2, 5, 10, 15]
        case .bodyScan: [5, 10, 15]
        case .quietTimer: [5, 10, 15, 20, 30]
        }
    }

    private var breathPhases: [BreathPhase] {
        switch breathPattern {
        case .simple:
            [
                BreathPhase(kind: .inhale, label: "Inhale", duration: 4),
                BreathPhase(kind: .exhale, label: "Exhale", duration: 4)
            ]
        case .longerExhale:
            [
                BreathPhase(kind: .inhale, label: "Inhale", duration: 4),
                BreathPhase(kind: .exhale, label: "Exhale", duration: 6)
            ]
        case .box:
            [
                BreathPhase(kind: .inhale, label: "Inhale", duration: 4),
                BreathPhase(kind: .hold, label: "Hold", duration: 4),
                BreathPhase(kind: .exhale, label: "Exhale", duration: 4),
                BreathPhase(kind: .rest, label: "Hold", duration: 4)
            ]
        case .custom:
            [
                BreathPhase(kind: .inhale, label: "Inhale", duration: customInhale),
                customHold > 0 ? BreathPhase(kind: .hold, label: "Hold", duration: customHold) : nil,
                BreathPhase(kind: .exhale, label: "Exhale", duration: customExhale)
            ].compactMap { $0 }
        }
    }

    private var currentBreathPhase: BreathPhase {
        let phases = breathPhases
        guard !phases.isEmpty else { return BreathPhase(kind: .inhale, label: "Inhale", duration: 4) }
        return phases[min(breathPhaseIndex, phases.count - 1)]
    }

    private var breathVisualScale: CGFloat {
        switch currentBreathPhase.kind {
        case .inhale: 1.0
        case .hold: 1.0
        case .exhale: 0.62
        case .rest: 0.62
        }
    }

    private var timeString: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private func toggleSession() {
        if isRunning {
            isRunning = false
            return
        }

        if remainingSeconds <= 0 {
            remainingSeconds = selectedMinutes * 60
        }
        if practice == .breathwork {
            resetBreathCycle()
        }
        isRunning = true
        cue(starting: true)
    }

    private func tick() {
        guard isRunning, remainingSeconds > 0 else { return }

        remainingSeconds -= 1

        if practice == .breathwork {
            advanceBreathCycle()
        } else if practice == .bodyScan {
            advanceBodyScanForElapsedTime()
        }

        if remainingSeconds == 0 {
            isRunning = false
            cue(starting: false)
            showCompletion = true
        }
    }

    private func advanceBreathCycle() {
        if breathPhaseRemaining > 1 {
            breathPhaseRemaining -= 1
            return
        }

        let phases = breathPhases
        guard !phases.isEmpty else { return }
        breathPhaseIndex = (breathPhaseIndex + 1) % phases.count
        breathPhaseRemaining = currentBreathPhase.duration
    }

    private func advanceBodyScanForElapsedTime() {
        let total = max(1, selectedMinutes * 60)
        let elapsed = total - remainingSeconds
        let secondsPerRegion = max(1, total / bodyRegions.count)
        bodyRegionIndex = min(bodyRegions.count - 1, elapsed / secondsPerRegion)
    }

    private func resetBreathCycle() {
        breathPhaseIndex = 0
        breathPhaseRemaining = currentBreathPhase.duration
    }

    private func resetSession(forNewPractice: Bool) {
        isRunning = false
        showCompletion = false
        reflection = nil
        bodyRegionIndex = 0

        if forNewPractice {
            selectedMinutes = durations.contains(10) ? 10 : (durations.first ?? 5)
        }
        remainingSeconds = selectedMinutes * 60
        resetBreathCycle()
    }

    private func dismissCompletion() {
        showCompletion = false
        remainingSeconds = selectedMinutes * 60
        bodyRegionIndex = 0
        resetBreathCycle()
    }

    private func cue(starting: Bool) {
        if startEndCueEnabled {
            AudioServicesPlaySystemSound(starting ? 1104 : 1114)
        }
        if hapticsEnabled {
            UINotificationFeedbackGenerator().notificationOccurred(starting ? .success : .warning)
        }
    }
}

private struct FlowLayout<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(spacing: spacing) {
            content()
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}
