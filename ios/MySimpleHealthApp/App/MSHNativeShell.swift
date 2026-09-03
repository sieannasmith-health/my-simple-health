import SwiftUI

enum MSHAppSection: String, CaseIterable, Identifiable {
    case myHealth, explore, simple, progress, me
    var id: Self { self }
    var title: String { switch self { case .myHealth: "My Health"; case .explore: "Explore"; case .simple: "Simple"; case .progress: "Progress"; case .me: "Me" } }
    var systemImage: String { switch self { case .myHealth: "heart.text.square"; case .explore: "safari"; case .simple: "sparkles"; case .progress: "chart.line.uptrend.xyaxis"; case .me: "person.crop.circle" } }
    var introduction: String { switch self { case .myHealth: "See what is useful for you right now."; case .explore: "Explore everything My Simple Health can help with."; case .simple: "Make sense of what is happening with Simple."; case .progress: "See what has changed, what you tried, and what you learned."; case .me: "Manage your account, connections, sharing, and preferences." } }
    var isImplemented: Bool { true }
}

enum MSHAppearancePreference: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: Self { self }
    var title: String { switch self { case .system: "System"; case .light: "Light"; case .dark: "Dark" } }
    var colorScheme: ColorScheme? { switch self { case .system: nil; case .light: .light; case .dark: .dark } }
}

struct MSHAppShell: View {
    @State private var selection: MSHAppSection = .myHealth
    @StateObject private var notificationRouter = MSHNotificationRouter.shared
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue
    private var appearance: MSHAppearancePreference { MSHAppearancePreference(rawValue: appearanceRawValue) ?? .system }
    var body: some View {
        TabView(selection: $selection) {
            ForEach(MSHAppSection.allCases) { section in
                MSHSectionNavigation(section: section, notificationRoute: notificationRouter.route?.appSection == section ? notificationRouter.route : nil)
                    .tabItem { Label(section.title, systemImage: section.systemImage) }.tag(section)
            }
        }
        .background(MSHColor.canvas.ignoresSafeArea()).toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) { MSHBottomTabBar(selection: $selection) }
        .preferredColorScheme(appearance.colorScheme)
        .onAppear { openNotificationRouteIfNeeded(notificationRouter.route) }
        .onChange(of: notificationRouter.route) { _, route in openNotificationRouteIfNeeded(route) }
    }
    private func openNotificationRouteIfNeeded(_ route: MSHWebRoute?) { guard let route else { return }; selection = route.appSection }
}

struct MSHBottomTabBar: View {
    @Binding var selection: MSHAppSection

    var body: some View {
        HStack(spacing: 2) {
            ForEach(MSHAppSection.allCases) { section in
                Button {
                    if selection != section { MSHNativeHaptic.selection.play() }
                    selection = section
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: section.systemImage)
                            .font(.system(size: section == .simple ? 20 : 19, weight: .medium))
                            .frame(height: 22)
                        Text(section.title)
                            .font(.caption2.weight(selection == section ? .semibold : .regular))
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                    }
                    .foregroundStyle(selection == section ? Color.white : Color.white.opacity(0.66))
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 50)
                    .contentShape(Rectangle())
                    .background {
                        if selection == section {
                            RoundedRectangle(cornerRadius: 15, style: .continuous)
                                .fill(Color.white.opacity(0.025))
                                .mshNativeGlass(
                                    in: RoundedRectangle(cornerRadius: 15, style: .continuous),
                                    tint: section == .simple ? MSHColor.sage : MSHColor.powder,
                                    edgeStrength: section == .simple ? 1.18 : 0.94,
                                    shadowStrength: 0.72,
                                    glowStrength: section == .simple ? 0.48 : 0.32
                                )
                                .padding(.horizontal, 3)
                                .padding(.vertical, 2)
                        }
                    }
                }
                .buttonStyle(MSHBottomTabButtonStyle(isSelected: selection == section))
                .accessibilityLabel(section.title)
                .accessibilityValue(selection == section ? "Selected" : "")
                .accessibilityAddTraits(selection == section ? .isSelected : [])
                .accessibilityIdentifier("msh-tab-\(section.rawValue)")
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
        .background {
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(
                    LinearGradient(
                        colors: [Color.white.opacity(0.08), Color.black.opacity(0.10)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            LinearGradient(
                colors: [
                    Color(red: 0.78, green: 0.46, blue: 1.0).opacity(0.46),
                    Color.white.opacity(0.58),
                    Color(red: 0.42, green: 0.82, blue: 1.0).opacity(0.46)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 0.8)
            .blur(radius: 0.15)
        }
        .shadow(color: Color(red: 0.44, green: 0.78, blue: 1.0).opacity(0.11), radius: 12, y: -2)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("msh-bottom-tab-bar")
    }
}

private struct MSHBottomTabButtonStyle: ButtonStyle {
    let isSelected: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 1.055 : 1)
            .brightness(configuration.isPressed ? 0.06 : 0)
            .shadow(
                color: Color(red: 0.48, green: 0.82, blue: 1.0).opacity(configuration.isPressed ? 0.24 : (isSelected ? 0.10 : 0)),
                radius: configuration.isPressed ? 14 : 7,
                y: configuration.isPressed ? 0 : 2
            )
            .animation(reduceMotion ? nil : .spring(response: 0.19, dampingFraction: 0.75), value: configuration.isPressed)
    }
}

private struct MSHSectionNavigation: View {
    let section: MSHAppSection; let notificationRoute: MSHWebRoute?
    var body: some View {
        NavigationStack {
            ZStack {
                MSHColor.canvas.ignoresSafeArea()
                Group {
                    switch section {
                    case .myHealth: if let notificationRoute { MSHNotificationWebRouteScreen(route: notificationRoute) } else { MSHMyHealthHomeScreen() }
                    case .explore: if let notificationRoute { MSHNotificationWebRouteScreen(route: notificationRoute) } else { MSHExploreScreen() }
                    case .simple: if let notificationRoute { MSHNotificationWebRouteScreen(route: notificationRoute) } else { MSHSimpleScreen() }
                    case .progress: if let notificationRoute { MSHNotificationWebRouteScreen(route: notificationRoute) } else { MSHProgressScreen() }
                    case .me: MSHProfileSettingsScreen()
                    }
                }
            }.navigationTitle(section.title).navigationBarTitleDisplayMode(.inline).toolbarBackground(MSHColor.canvas, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar)
        }.mshNavigationSurface()
    }
}

private struct MSHNotificationWebRouteScreen: View { let route: MSHWebRoute; var body: some View { ZStack { MSHColor.canvas.ignoresSafeArea(); MSHWebView(route: route) }.toolbarBackground(MSHColor.canvas, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar).accessibilityIdentifier("notification-route-\(route.rawValue)") } }
private struct MSHSimpleScreen: View { private let route = MSHWebRoute(rawValue: "hello.html")!; var body: some View { ZStack { MSHColor.canvas.ignoresSafeArea(); MSHWebView(route: route) }.accessibilityIdentifier("simple-conversation-screen") } }
struct MSHWebFeatureScreen: View { let destination: MSHFeatureDestination; var body: some View { MSHImmediateDestination(title: destination.title) { ZStack { MSHColor.canvas.ignoresSafeArea(); MSHWebView(destination: destination) } }.navigationTitle(destination.title).navigationBarTitleDisplayMode(.inline).toolbarBackground(MSHColor.canvas, for: .navigationBar).toolbarBackground(.visible, for: .navigationBar).accessibilityIdentifier("native-feature-\(destination.rawValue)") } }

private struct MSHProgressScreen: View {
    private let reflection: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [(.healthStory,"See the living story your confirmed health experiences are creating.","book.pages"),(.landscape,"Return to the whole-health picture of where you are now.","map"),(.selfInsight,"Look more closely when one part of your experience needs context.","sparkles.rectangle.stack"),(.journey,"See what has changed over time without turning it into a score.","clock.arrow.circlepath")]
    private let direction: [(destination: MSHFeatureDestination, subtitle: String, image: String)] = [(.horizon,"Notice where you may want to head.","sun.horizon"),(.path,"Keep what you are intentionally working toward in view.","point.topleft.down.to.point.bottomright.curvepath"),(.practice,"Return to what you are trying in real life.","leaf"),(.discovery,"Capture what experience is showing you.","lightbulb")]
    var body: some View { ScrollView { LazyVStack(alignment:.leading,spacing:30) { MSHEditorialHeader(eyebrow:"PROGRESS",title:"See how things are changing.",subtitle:"What happened, what you tried, and what you learned belong together here."); MSHDestinationGroup(title:"Your picture over time",destinations:reflection); MSHDestinationGroup(title:"Your direction",destinations:direction) }.padding(.horizontal,20).padding(.top,18).padding(.bottom,36) }.background(MSHColor.canvas).accessibilityIdentifier("progress-integration-screen") }
}

private struct MSHExploreScreen: View {
    private let timeAndMovement:[(destination:MSHFeatureDestination,subtitle:String,image:String)] = [(.calendar,"See health and life together in time.","calendar"),(.movementPlan,"Plan movement in the context of your real schedule.","figure.walk.motion"),(.movementLibrary,"Return to workouts, classes, videos, routines, and favorites.","figure.run")]
    private let care:[(destination:MSHFeatureDestination,subtitle:String,image:String)] = [(.cycle,"Keep cycle context close to the rest of your health.","circle.dotted.circle"),(.medications,"Manage medication supply, refill timing, and follow-through.","pills")]
    private let everyday:[(destination:MSHFeatureDestination,subtitle:String,image:String)] = [(.food,"Use your personal food workspace.","fork.knife"),(.financialHealth,"See where money is going and understand it in the context of your life.","chart.pie")]
    private let understanding:[(destination:MSHFeatureDestination,subtitle:String,image:String)] = [(.landscape,"Explore the whole-health picture of where you are now.","map"),(.selfInsight,"Look more closely when one part of your experience needs context.","sparkles.rectangle.stack")]
    var body: some View { ScrollView { LazyVStack(alignment:.leading,spacing:30) { MSHEditorialHeader(eyebrow:"EXPLORE",title:"Everything is here when you want it.",subtitle:"My Health stays selective. Explore is where you can browse the broader capabilities of My Simple Health."); MSHDestinationGroup(title:"Health in time",destinations:timeAndMovement); MSHDestinationGroup(title:"Understand your health",destinations:understanding); MSHDestinationGroup(title:"Care",destinations:care); MSHDestinationGroup(title:"Everyday life",destinations:everyday) }.padding(.horizontal,20).padding(.top,18).padding(.bottom,36) }.background(MSHColor.canvas).accessibilityIdentifier("explore-integration-screen") }
}

private struct MSHEditorialHeader: View { let eyebrow:String; let title:String; let subtitle:String; var body: some View { VStack(alignment:.leading,spacing:10) { Text(eyebrow).font(.caption2.weight(.semibold)).tracking(2.2).foregroundStyle(MSHColor.accent); Text(title).font(.system(size:30,weight:.medium,design:.serif)).foregroundStyle(MSHColor.primaryText).fixedSize(horizontal:false,vertical:true); Text(subtitle).font(.system(size:16,design:.serif)).foregroundStyle(MSHColor.secondaryText).fixedSize(horizontal:false,vertical:true) }.frame(maxWidth:.infinity,alignment:.leading) } }
private struct MSHDestinationGroup: View { let title:String; let destinations:[(destination:MSHFeatureDestination,subtitle:String,image:String)]; var body: some View { VStack(alignment:.leading,spacing:0) { Text(title.uppercased()).font(.caption.weight(.semibold)).tracking(1.3).foregroundStyle(MSHColor.secondaryText).padding(.bottom,8); ForEach(destinations.indices,id:\.self) { i in let item=destinations[i]; NavigationLink { MSHWebFeatureScreen(destination:item.destination) } label: { MSHEditorialDoorway(title:item.destination.title,subtitle:item.subtitle,systemImage:item.image) }.buttonStyle(.plain) } } } }
private struct MSHEditorialDoorway: View { let title:String; let subtitle:String; let systemImage:String; var body: some View { HStack(alignment:.top,spacing:14) { Image(systemName:systemImage).font(.system(size:18,weight:.medium)).foregroundStyle(MSHColor.accent).frame(width:30,height:30); VStack(alignment:.leading,spacing:5) { Text(title).font(.system(size:18,weight:.medium,design:.serif)).foregroundStyle(MSHColor.primaryText); Text(subtitle).font(.subheadline).foregroundStyle(MSHColor.secondaryText).fixedSize(horizontal:false,vertical:true) }; Spacer(minLength:8); Image(systemName:"chevron.right").font(.caption.weight(.semibold)).foregroundStyle(MSHColor.secondaryText.opacity(0.7)).padding(.top,5) }.padding(.vertical,16).overlay(alignment:.bottom){Rectangle().fill(MSHColor.border.opacity(0.7)).frame(height:0.5)}.contentShape(Rectangle()) } }
struct MSHFeatureDoorway: View { let title:String; let subtitle:String; let systemImage:String; var body: some View { MSHEditorialDoorway(title:title,subtitle:subtitle,systemImage:systemImage) } }

struct MSHProfileSettingsScreen: View {
    @AppStorage("msh.displayName") private var displayName = ""
    @AppStorage("msh.appearance") private var appearanceRawValue = MSHAppearancePreference.system.rawValue
    @AppStorage("msh.mySpace") private var mySpaceRawValue = MSHMySpace.warmHouse.rawValue
    @AppStorage("msh.mySpaceLighting") private var lightingRawValue = MSHSpaceLighting.auto.rawValue
    var body: some View {
        ZStack { MSHColor.canvas.ignoresSafeArea(); ScrollView { VStack(alignment:.leading,spacing:28) {
            MSHEditorialHeader(eyebrow:"ME",title:"Your space.",subtitle:"Your profile, appearance, connections, sharing, and privacy controls live here.")
            VStack(alignment:.leading,spacing:12) { Text("Profile").font(.headline); TextField("Name or nickname",text:$displayName).textInputAutocapitalization(.words).padding(.horizontal,16).frame(height:48).background(MSHColor.controlFill).clipShape(RoundedRectangle(cornerRadius:16)) }
            VStack(alignment:.leading,spacing:12) { Text("Appearance").font(.headline); Picker("Appearance",selection:$appearanceRawValue) { ForEach(MSHAppearancePreference.allCases){p in Text(p.title).tag(p.rawValue)} }.pickerStyle(.segmented); Text("My Space").font(.headline).padding(.top,8); Picker("My Space",selection:$mySpaceRawValue){ForEach(MSHMySpace.allCases){s in Text(s.title).tag(s.rawValue)}}; Text("Lighting").font(.headline); Picker("Lighting",selection:$lightingRawValue){ForEach(MSHSpaceLighting.allCases){l in Text(l.title).tag(l.rawValue)}}.pickerStyle(.segmented) }
            NavigationLink { MSHImmediateDestination(title:"People & Sharing") { MSHPeopleSharingScreen() } } label: { MSHFeatureDoorway(title:"People & Sharing",subtitle:"Choose exactly what you share and with whom.",systemImage:"person.2") }.buttonStyle(.plain)
        }.padding(.horizontal,20).padding(.top,18).padding(.bottom,36) } }.navigationTitle("Me").navigationBarTitleDisplayMode(.inline).toolbarBackground(MSHColor.canvas,for:.navigationBar).toolbarBackground(.visible,for:.navigationBar)
    }
}
