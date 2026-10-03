import WidgetKit
import SwiftUI

@main
struct CRTWidget: Widget {
    let kind = "CRTWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CRTTimelineProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                CRTWidgetEntryView(entry: entry)
                    .containerBackground(for: .widget) {
                        WidgetBackgroundView(entry: entry)
                    }
            } else {
                ZStack {
                    WidgetBackgroundView(entry: entry)
                    CRTWidgetEntryView(entry: entry)
                }
            }
        }
        .configurationDisplayName("Club Rugby Tipping")
        .description("See your next tipping deadline, tips status, and rank.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
