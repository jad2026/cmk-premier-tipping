import SwiftUI
import WidgetKit

struct CRTWidgetEntryView: View {
    var entry: CRTEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if !entry.loggedIn {
            loggedOutView
        } else if entry.comps.isEmpty {
            emptyView
        } else {
            switch family {
            case .systemSmall:
                smallView(comp: entry.comps[0])
            case .systemMedium:
                mediumView
            default:
                smallView(comp: entry.comps[0])
            }
        }
    }

    private var loggedOutView: some View {
        VStack(spacing: 8) {
            Image(systemName: "sportscourt")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("Open Club Rugby Tipping")
                .font(.caption)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://open"))
    }

    private var emptyView: some View {
        VStack(spacing: 8) {
            Image(systemName: "sportscourt")
                .font(.title2)
                .foregroundColor(.secondary)
            Text("No competitions")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://open"))
    }

    // MARK: - Small widget (one comp)

    private func smallView(comp: WidgetComp) -> some View {
        let accent = Color(hex: comp.accentColor)
        return VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                if let logoUrl = comp.logoUrl, let url = URL(string: logoUrl) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Circle().fill(accent.opacity(0.3))
                    }
                    .frame(width: 20, height: 20)
                    .clipShape(Circle())
                }
                Text(comp.name)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                    .foregroundColor(accent)
            }

            Spacer(minLength: 0)

            if let round = comp.roundLabel {
                Text(round)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if let deadline = comp.deadline, let date = parseISO(deadline) {
                deadlineRow(date: date)
            } else {
                Text("No deadline")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer(minLength: 0)

            HStack {
                tipsStatus(comp: comp)
                Spacer()
                if let rank = comp.rank {
                    Text("#\(rank)")
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(accent)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(URL(string: "\(CRTShared.urlScheme)://tips?comp=\(comp.id)"))
    }

    // MARK: - Medium widget (up to 2 comps)

    private var mediumView: some View {
        let comps = Array(entry.comps.prefix(2))
        return HStack(spacing: 0) {
            ForEach(Array(comps.enumerated()), id: \.element.id) { index, comp in
                if index > 0 {
                    Divider().padding(.vertical, 8)
                }
                smallCompCard(comp: comp)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func smallCompCard(comp: WidgetComp) -> some View {
        let accent = Color(hex: comp.accentColor)
        return Link(destination: URL(string: "\(CRTShared.urlScheme)://tips?comp=\(comp.id)")!) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if let logoUrl = comp.logoUrl, let url = URL(string: logoUrl) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fit)
                        } placeholder: {
                            Circle().fill(accent.opacity(0.3))
                        }
                        .frame(width: 18, height: 18)
                        .clipShape(Circle())
                    }
                    Text(comp.name)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                        .foregroundColor(accent)
                }

                Spacer(minLength: 0)

                if let round = comp.roundLabel {
                    Text(round)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                if let deadline = comp.deadline, let date = parseISO(deadline) {
                    deadlineRow(date: date)
                }

                Spacer(minLength: 0)

                HStack {
                    tipsStatus(comp: comp)
                    Spacer()
                    if let rank = comp.rank {
                        Text("#\(rank)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(accent)
                    }
                }
            }
            .padding(12)
        }
    }

    // MARK: - Helpers

    private func deadlineRow(date: Date) -> some View {
        HStack(spacing: 4) {
            Image(systemName: "clock")
                .font(.system(size: 10))
                .foregroundColor(.secondary)
            Text(date, style: .relative)
                .font(.caption2)
                .foregroundColor(.primary)
        }
    }

    @ViewBuilder
    private func tipsStatus(comp: WidgetComp) -> some View {
        if comp.total > 0 {
            HStack(spacing: 3) {
                Image(systemName: comp.tipsComplete ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(.system(size: 12))
                    .foregroundColor(comp.tipsComplete ? .green : .orange)
                Text("\(comp.picked)/\(comp.total)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func parseISO(_ string: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: string) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: string)
    }
}

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
