import SwiftUI
import WidgetKit

struct CRTWidgetEntryView: View {
    var entry: CRTEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if !entry.loggedIn {
            loggedOutView
        } else if entry.displays.isEmpty {
            emptyView
        } else {
            switch family {
            case .systemMedium:
                mediumView
            default:
                smallView(display: entry.displays[0])
            }
        }
    }

    // MARK: - Logged out

    private var loggedOutView: some View {
        VStack(spacing: 8) {
            Image(systemName: "sportscourt.fill")
                .font(.system(size: 28))
                .foregroundColor(.white.opacity(0.6))
            Text("Sign in to get started")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://open"))
    }

    // MARK: - Empty

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "sportscourt.fill")
                .font(.system(size: 28))
                .foregroundColor(.white.opacity(0.6))
            Text("No competitions")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://open"))
    }

    // MARK: - Small widget

    private func smallView(display: CompDisplay) -> some View {
        let accent = Color(hex: display.comp.accentColor)
        let label = display.comp.shortLabel ?? display.comp.name
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                logoView(display: display, size: 22)
                VStack(alignment: .leading, spacing: 1) {
                    Text(label)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    if let round = display.comp.roundLabel {
                        Text(shortRoundLabel(round))
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.white.opacity(0.65))
                    }
                }
            }

            Spacer(minLength: 4)

            if display.comp.comingSoon {
                Text("Next round\ncoming soon")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white.opacity(0.6))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            } else if let dl = display.comp.deadline, let date = parseISO(dl) {
                Text(date, style: .relative)
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .foregroundColor(.white)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            } else {
                Text("—")
                    .font(.system(size: 28, weight: .heavy))
                    .foregroundColor(.white.opacity(0.3))
            }

            Spacer(minLength: 4)

            if !display.comp.comingSoon {
                HStack(spacing: 0) {
                    if display.comp.total > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: display.comp.tipsComplete
                                  ? "checkmark.circle.fill"
                                  : "exclamationmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundColor(display.comp.tipsComplete ? .green : .orange)
                            Text("\(display.comp.picked)/\(display.comp.total)")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                    Spacer()
                    if let rank = display.comp.rank {
                        Text("#\(rank)")
                            .font(.system(size: 14, weight: .heavy, design: .rounded))
                            .foregroundColor(accent)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://tips?comp=\(display.comp.id)"))
    }

    // MARK: - Medium widget

    private var mediumView: some View {
        let displays = Array(entry.displays.prefix(2))
        return HStack(spacing: 0) {
            ForEach(Array(displays.enumerated()), id: \.element.comp.id) { index, display in
                if index > 0 {
                    Rectangle()
                        .fill(.white.opacity(0.1))
                        .frame(width: 0.5)
                }
                mediumCard(display: display)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func mediumCard(display: CompDisplay) -> some View {
        let accent = Color(hex: display.comp.accentColor)
        return Link(destination: URL(string: "\(CRTShared.urlScheme)://tips?comp=\(display.comp.id)")!) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 5) {
                    logoView(display: display, size: 18)
                    Text(display.comp.name)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }

                if let round = display.comp.roundLabel {
                    Text(round)
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.white.opacity(0.6))
                        .padding(.top, 1)
                }

                Spacer(minLength: 2)

                if display.comp.comingSoon {
                    Text("Next round\ncoming soon")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white.opacity(0.6))
                        .lineLimit(2)
                } else if let dl = display.comp.deadline, let date = parseISO(dl) {
                    Text(date, style: .relative)
                        .font(.system(size: 20, weight: .heavy, design: .rounded))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                }

                Spacer(minLength: 2)

                if !display.comp.comingSoon {
                    HStack(spacing: 0) {
                        if display.comp.total > 0 {
                            HStack(spacing: 3) {
                                Image(systemName: display.comp.tipsComplete
                                      ? "checkmark.circle.fill"
                                      : "exclamationmark.circle.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(display.comp.tipsComplete ? .green : .orange)
                                Text("\(display.comp.picked)/\(display.comp.total)")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(.white.opacity(0.8))
                            }
                        }
                        Spacer()
                        if let rank = display.comp.rank {
                            Text("#\(rank)")
                                .font(.system(size: 13, weight: .heavy, design: .rounded))
                                .foregroundColor(accent)
                        }
                    }
                }
            }
            .padding(12)
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func logoView(display: CompDisplay, size: CGFloat) -> some View {
        if let uiImage = display.logoImage {
            Image(uiImage: uiImage)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .clipShape(Circle())
        } else {
            Circle()
                .fill(.white.opacity(0.2))
                .frame(width: size, height: size)
                .overlay(
                    Text(String((display.comp.shortLabel ?? display.comp.name).prefix(1)))
                        .font(.system(size: size * 0.5, weight: .bold))
                        .foregroundColor(.white.opacity(0.7))
                )
        }
    }

    private func shortRoundLabel(_ label: String) -> String {
        if let match = label.range(of: #"Round \d+"#, options: .regularExpression) {
            return String(label[match])
        }
        return label
    }

    private func parseISO(_ string: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: string) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: string)
    }
}

// MARK: - Widget Background

struct WidgetBackgroundView: View {
    let entry: CRTEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if !entry.loggedIn || entry.displays.isEmpty {
            neutralGradient
        } else if family == .systemMedium && entry.displays.count >= 2 {
            HStack(spacing: 0) {
                surfaceGradient(display: entry.displays[0])
                surfaceGradient(display: entry.displays[1])
            }
        } else {
            surfaceGradient(display: entry.displays[0])
        }
    }

    private var neutralGradient: some View {
        LinearGradient(
            colors: [Color(white: 0.15), Color(white: 0.08)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func surfaceGradient(display: CompDisplay) -> some View {
        let base: Color
        if let hex = display.comp.surfaceColor {
            base = Color(hex: hex)
        } else {
            base = Color(white: 0.12)
        }
        let lighter = base.opacity(1)
        let darker = Color.black.opacity(0.4)
        return ZStack {
            base
            LinearGradient(
                colors: [lighter, darker],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}

// MARK: - Color Extensions

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: Double
        switch hex.count {
        case 6:
            r = Double((int >> 16) & 0xFF) / 255
            g = Double((int >> 8) & 0xFF) / 255
            b = Double(int & 0xFF) / 255
        default:
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b)
    }
}

extension UIColor {
    convenience init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: CGFloat
        switch hex.count {
        case 6:
            r = CGFloat((int >> 16) & 0xFF) / 255
            g = CGFloat((int >> 8) & 0xFF) / 255
            b = CGFloat(int & 0xFF) / 255
        default:
            r = 0; g = 0; b = 0
        }
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}
