import Foundation

enum CRTShared {
    static let appGroupSuite = "group.com.clubrugbytipping.app"
    static let tokenKey = "widgetToken"
    #if DEBUG
    static let apiURL = URL(string: "http://localhost:3000/api/widget")!
    #else
    static let apiURL = URL(string: "https://clubrugbytipping.com/api/widget")!
    #endif
    static let urlScheme = "clubrugbytipping"
}
