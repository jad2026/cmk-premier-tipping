import Foundation
import UIKit

struct WidgetResponse: Codable {
    let comps: [WidgetComp]
}

struct WidgetComp: Codable {
    let id: String
    let name: String
    let shortLabel: String?
    let accentColor: String
    let surfaceColor: String?
    let logoUrl: String?
    let roundLabel: String?
    let deadline: String?
    let comingSoon: Bool
    let tipsComplete: Bool
    let picked: Int
    let total: Int
    let rank: Int?
    let totalPlayers: Int?
    let siteUrl: String
}

struct CompDisplay {
    let comp: WidgetComp
    let logoImage: UIImage?
}
