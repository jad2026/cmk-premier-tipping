import Foundation

struct WidgetResponse: Codable {
    let comps: [WidgetComp]
}

struct WidgetComp: Codable {
    let id: String
    let name: String
    let accentColor: String
    let logoUrl: String?
    let roundLabel: String?
    let deadline: String?
    let tipsComplete: Bool
    let picked: Int
    let total: Int
    let rank: Int?
    let totalPlayers: Int?
    let siteUrl: String
}
