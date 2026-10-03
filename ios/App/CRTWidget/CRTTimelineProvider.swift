import WidgetKit
import Foundation

struct CRTEntry: TimelineEntry {
    let date: Date
    let comps: [WidgetComp]
    let loggedIn: Bool
}

struct CRTTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> CRTEntry {
        CRTEntry(date: .now, comps: [], loggedIn: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (CRTEntry) -> Void) {
        completion(CRTEntry(date: .now, comps: [], loggedIn: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CRTEntry>) -> Void) {
        guard let token = readToken() else {
            let entry = CRTEntry(date: .now, comps: [], loggedIn: false)
            let timeline = Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(60 * 60)))
            completion(timeline)
            return
        }

        fetchWidgetData(token: token) { comps in
            let now = Date()
            let entry = CRTEntry(date: now, comps: comps, loggedIn: true)
            let refreshDate = nextRefreshDate(comps: comps, now: now)
            let timeline = Timeline(entries: [entry], policy: .after(refreshDate))
            completion(timeline)
        }
    }

    private func readToken() -> String? {
        UserDefaults(suiteName: CRTShared.appGroupSuite)?.string(forKey: CRTShared.tokenKey)
    }

    private func fetchWidgetData(token: String, completion: @escaping ([WidgetComp]) -> Void) {
        var request = URLRequest(url: CRTShared.apiURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let http = response as? HTTPURLResponse,
                  http.statusCode == 200 else {
                completion([])
                return
            }

            do {
                let decoded = try JSONDecoder().decode(WidgetResponse.self, from: data)
                completion(decoded.comps)
            } catch {
                completion([])
            }
        }.resume()
    }

    private func nextRefreshDate(comps: [WidgetComp], now: Date) -> Date {
        let maxInterval: TimeInterval = 60 * 60

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let deadlines: [Date] = comps.compactMap { comp in
            guard let dl = comp.deadline else { return nil }
            return iso.date(from: dl)
        }

        let nextDeadline = deadlines.filter { $0 > now }.min()
        if let next = nextDeadline {
            let deadlinePlus = next.addingTimeInterval(60)
            return min(deadlinePlus, now.addingTimeInterval(maxInterval))
        }

        return now.addingTimeInterval(maxInterval)
    }
}
