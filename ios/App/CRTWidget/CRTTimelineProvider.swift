import WidgetKit
import Foundation
import UIKit

struct CRTEntry: TimelineEntry {
    let date: Date
    let displays: [CompDisplay]
    let loggedIn: Bool
}

struct CRTTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> CRTEntry {
        CRTEntry(date: .now, displays: [], loggedIn: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (CRTEntry) -> Void) {
        completion(CRTEntry(date: .now, displays: [], loggedIn: true))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CRTEntry>) -> Void) {
        guard let token = readToken() else {
            let entry = CRTEntry(date: .now, displays: [], loggedIn: false)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(3600))))
            return
        }

        fetchWidgetData(token: token) { comps in
            downloadLogos(for: comps) { displays in
                let now = Date()
                let entry = CRTEntry(date: now, displays: displays, loggedIn: true)
                let refresh = nextRefreshDate(comps: comps, now: now)
                completion(Timeline(entries: [entry], policy: .after(refresh)))
            }
        }
    }

    private func readToken() -> String? {
        UserDefaults(suiteName: CRTShared.appGroupSuite)?.string(forKey: CRTShared.tokenKey)
    }

    private func fetchWidgetData(token: String, completion: @escaping ([WidgetComp]) -> Void) {
        var request = URLRequest(url: CRTShared.apiURL)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        URLSession.shared.dataTask(with: request) { data, response, _ in
            guard let data = data,
                  let http = response as? HTTPURLResponse,
                  http.statusCode == 200 else {
                completion([])
                return
            }
            do {
                completion(try JSONDecoder().decode(WidgetResponse.self, from: data).comps)
            } catch {
                completion([])
            }
        }.resume()
    }

    // MARK: - Logo cache

    private func logosCacheDir() -> URL {
        let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: CRTShared.appGroupSuite
        )!
        let dir = container.appendingPathComponent("logos")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func cacheFile(for urlString: String) -> URL {
        var hash: UInt64 = 5381
        for byte in urlString.utf8 {
            hash = ((hash &<< 5) &+ hash) &+ UInt64(byte)
        }
        return logosCacheDir().appendingPathComponent(String(format: "%016llx.png", hash))
    }

    private func loadLogo(from urlString: String, completion: @escaping (UIImage?) -> Void) {
        let cached = cacheFile(for: urlString)
        if let data = try? Data(contentsOf: cached), let image = UIImage(data: data) {
            NSLog("[CRT-Widget] Logo cache hit: %@", urlString)
            completion(image)
            return
        }
        guard let url = URL(string: urlString) else {
            NSLog("[CRT-Widget] Logo URL invalid: %@", urlString)
            completion(nil)
            return
        }
        NSLog("[CRT-Widget] Logo downloading: %@", urlString)
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                NSLog("[CRT-Widget] Logo download error: %@", error.localizedDescription)
                completion(nil)
                return
            }
            let http = response as? HTTPURLResponse
            NSLog("[CRT-Widget] Logo response: status=%d, bytes=%d, type=%@",
                  http?.statusCode ?? 0,
                  data?.count ?? 0,
                  http?.value(forHTTPHeaderField: "Content-Type") ?? "unknown")
            guard let data = data, let image = UIImage(data: data) else {
                NSLog("[CRT-Widget] Logo UIImage init failed for %@", urlString)
                completion(nil)
                return
            }
            let cacheDir = self.logosCacheDir()
            NSLog("[CRT-Widget] Logo cache dir: %@", cacheDir.path)
            do {
                try image.pngData()?.write(to: cached, options: .atomic)
                NSLog("[CRT-Widget] Logo cached to: %@", cached.path)
            } catch {
                NSLog("[CRT-Widget] Logo cache write error: %@", error.localizedDescription)
            }
            completion(image)
        }.resume()
    }

    private func downloadLogos(for comps: [WidgetComp], completion: @escaping ([CompDisplay]) -> Void) {
        guard !comps.isEmpty else { completion([]); return }

        let group = DispatchGroup()
        let lock = NSLock()
        var results: [Int: CompDisplay] = [:]

        for (i, comp) in comps.enumerated() {
            guard let logoUrl = comp.logoUrl, !logoUrl.isEmpty else {
                lock.lock()
                results[i] = CompDisplay(comp: comp, logoImage: nil)
                lock.unlock()
                continue
            }
            group.enter()
            loadLogo(from: logoUrl) { image in
                lock.lock()
                results[i] = CompDisplay(comp: comp, logoImage: image)
                lock.unlock()
                group.leave()
            }
        }

        group.notify(queue: .main) {
            let ordered = (0..<comps.count).map {
                results[$0] ?? CompDisplay(comp: comps[$0], logoImage: nil)
            }
            completion(ordered)
        }
    }

    // MARK: - Refresh

    private func nextRefreshDate(comps: [WidgetComp], now: Date) -> Date {
        let maxInterval: TimeInterval = 3600
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let deadlines: [Date] = comps.compactMap { comp in
            guard let dl = comp.deadline else { return nil }
            return iso.date(from: dl)
        }

        if let next = deadlines.filter({ $0 > now }).min() {
            return min(next.addingTimeInterval(60), now.addingTimeInterval(maxInterval))
        }
        return now.addingTimeInterval(maxInterval)
    }
}
