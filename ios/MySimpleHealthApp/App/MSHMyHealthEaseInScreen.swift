import SwiftUI

/// The My Health front door. This screen intentionally does not load or display
/// health measurements. People choose when they want to move into data or work.
struct MSHMyHealthEaseInScreen: View {
    @AppStorage("msh.displayName") private var displayName = ""

    private var timeGreeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Good morning"
        case 12..<17: return "Good afternoon"
        case 17..<22: return "Good evening"
        default: return "Welcome back"
        }
    }

    private var arrivalMessage: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "Take your time. You can decide what you want from your health space today."
        case 12..<17: return "Come in for a moment. Nothing here needs to become work unless you choose it."
        case 17..<22: return "Let the day settle. Your health can wait until you feel ready to look closer."
        default: return "Keep this quiet. There is nothing you need to do just because you opened My Health."
        }
    }

    private var greeting: String {
        let name = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "\(timeGreeting)." : "\(timeGreeting), \(name)."
    }

    var body: some View {
        ZStack {
            MSHColor.canvas.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 30) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(greeting)
                            .font(MSHTypography.destinationTitle)
                            .foregroundStyle(MSHColor.primaryText)

                        Text("You’re home.")
                            .font(.system(.title2, design: .serif))
                            .foregroundStyle(MSHColor.primaryText)

                        Text(arrivalMessage)
                            .font(MSHTypography.body)
                            .foregroundStyle(MSHColor.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.top, 18)

                    MSHArrivalPause()

                    VStack(alignment: .leading, spacing: 14) {
                        Text("Whenever you’re ready")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(MSHColor.primaryText)

                        NavigationLink {
                            MSHMyHealthScreen()
                                .navigationTitle("Your Health")
                                .navigationBarTitleDisplayMode(.inline)
                        } label: {
                            MSHArrivalDoorway(
                                title: "Explore your health",
                                subtitle: "Open your health areas, Apple Health, and personal data when you want them.",
                                systemImage: "heart.text.square"
                            )
                        }
                        .buttonStyle(.plain)

                        NavigationLink {
                            MSHWebFeatureScreen(destination: .calendar)
                        } label: {
                            MSHArrivalDoorway(
                                title: "See what’s coming up",
                                subtitle: "Look at your Calendar without turning the rest of your health into a task list.",
                                systemImage: "calendar"
                            )
                        }
                        .buttonStyle(.plain)

                        NavigationLink {
                            MSHWebFeatureScreen(destination: .path)
                        } label: {
                            MSHArrivalDoorway(
                                title: "Work on something",
                                subtitle: "Choose this only when there is something you actually want to work toward.",
                                systemImage: "leaf"
                            )
                        }
                        .buttonStyle(.plain)
                    }

                    Text("You can also just be here. Opening My Health does not create an assignment.")
                        .font(.footnote)
                        .foregroundStyle(MSHColor.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, MSHSpacing.medium)
                .padding(.bottom, 96)
            }
        }
        .accessibilityIdentifier("my-health-ease-in")
    }
}

private struct MSHArrivalPause: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "house.fill")
                    .foregroundStyle(MSHColor.accent)
                Text("SETTLE IN")
                    .font(.caption.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(MSHColor.accent)
            }

            Text("Stay for a minute, look around, or go deeper. You choose the pace.")
                .font(.system(.title3, design: .serif))
                .foregroundStyle(MSHColor.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
    }
}

private struct MSHArrivalDoorway: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: systemImage)
                .font(.body.weight(.medium))
                .foregroundStyle(MSHColor.accent)
                .frame(width: 38, height: 38)
                .background(MSHColor.controlFill)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 5) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(MSHColor.primaryText)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(MSHColor.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer(minLength: 4)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MSHColor.secondaryText)
                .padding(.top, 12)
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
