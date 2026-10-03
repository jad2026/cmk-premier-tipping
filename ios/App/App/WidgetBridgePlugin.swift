import Foundation
import Capacitor
import WidgetKit

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reloadTimelines", returnType: CAPPluginReturnPromise),
    ]

    private let suiteName = "group.com.clubrugbytipping.app"
    private let tokenKey = "widgetToken"

    @objc func saveToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Missing token")
            return
        }
        let defaults = UserDefaults(suiteName: suiteName)
        defaults?.set(token, forKey: tokenKey)
        call.resolve()
    }

    @objc func getToken(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: suiteName)
        let token = defaults?.string(forKey: tokenKey)
        call.resolve(["token": token as Any])
    }

    @objc func clearToken(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: suiteName)
        defaults?.removeObject(forKey: tokenKey)
        call.resolve()
    }

    @objc func reloadTimelines(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
