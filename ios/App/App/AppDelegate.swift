import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        if url.scheme == "clubrugbytipping", let compId = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "comp" })?.value {
            if let vc = window?.rootViewController as? CAPBridgeViewController,
               let webView = vc.bridge?.webView {
                let origin: String
                if let currentURL = webView.url,
                   let comps = URLComponents(url: currentURL, resolvingAgainstBaseURL: false),
                   let host = comps.host, !host.isEmpty {
                    origin = "\(comps.scheme ?? "https")://\(host)\(comps.port.map { ":\($0)" } ?? "")"
                } else {
                    origin = Self.capacitorServerOrigin()
                }
                let navUrl = "\(origin)/api/hub/switch?comp=\(compId)"
                NSLog("[CRT] Deep link: webView.url=%@, resolved origin=%@, navigating to %@",
                      webView.url?.absoluteString ?? "nil", origin, navUrl)
                webView.load(URLRequest(url: URL(string: navUrl)!))
            }
            return true
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    private static func capacitorServerOrigin() -> String {
        guard let path = Bundle.main.path(forResource: "capacitor.config", ofType: "json"),
              let data = FileManager.default.contents(atPath: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let server = json["server"] as? [String: Any],
              let urlString = server["url"] as? String,
              let comps = URLComponents(string: urlString),
              let host = comps.host else {
            return "https://clubrugbytipping.com"
        }
        return "\(comps.scheme ?? "https")://\(host)\(comps.port.map { ":\($0)" } ?? "")"
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
