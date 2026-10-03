import UIKit
import WebKit
import Network

final class WKNavigationDelegateProxy: NSObject, WKNavigationDelegate {
    weak var original: WKNavigationDelegate?
    var onNavigationError: ((Error) -> Void)?
    var onNavigationSuccess: (() -> Void)?

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        onNavigationError?(error)
        original?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        onNavigationError?(error)
        original?.webView?(webView, didFail: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onNavigationSuccess?()
        original?.webView?(webView, didFinish: navigation)
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        original?.webView?(webView, didStartProvisionalNavigation: navigation)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        original?.webView?(webView, didCommit: navigation)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        return original?.responds(to: aSelector) ?? false
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let orig = original, orig.responds(to: aSelector) { return orig }
        return super.forwardingTarget(for: aSelector)
    }
}

final class OfflineManager: NSObject {
    private static let bgColor = UIColor(red: 0.043, green: 0.055, blue: 0.075, alpha: 1)

    private static let networkErrorCodes: Set<Int> = [
        NSURLErrorNotConnectedToInternet,
        NSURLErrorNetworkConnectionLost,
        NSURLErrorTimedOut,
        NSURLErrorCannotFindHost,
        NSURLErrorCannotConnectToHost,
        NSURLErrorDNSLookupFailed,
        NSURLErrorDataNotAllowed,
    ]

    private weak var viewController: UIViewController?
    private weak var webView: WKWebView?
    private let monitor = NWPathMonitor()
    private var isConnected = true
    private var hasSuccessfulLoad = false

    private var overlayView: UIView?
    private var bannerView: UIView?
    private var bannerTopConstraint: NSLayoutConstraint?

    init(viewController: UIViewController, webView: WKWebView) {
        self.viewController = viewController
        self.webView = webView
        super.init()
        startMonitoring()
    }

    deinit { monitor.cancel() }

    // MARK: - Network monitor

    private func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.connectivityChanged(connected: path.status == .satisfied)
            }
        }
        monitor.start(queue: DispatchQueue.global(qos: .utility))
    }

    private func connectivityChanged(connected: Bool) {
        let wasConnected = isConnected
        isConnected = connected
        if connected && !wasConnected {
            if overlayView != nil { reloadWebView() }
            hideBanner()
        } else if !connected && wasConnected && hasSuccessfulLoad {
            showBanner()
        }
    }

    // MARK: - Navigation callbacks

    func handleNavigationError(_ error: Error) {
        let e = error as NSError
        guard e.domain == NSURLErrorDomain, Self.networkErrorCodes.contains(e.code) else { return }
        if hasSuccessfulLoad {
            showBanner()
        } else {
            showOverlay()
        }
    }

    func handleNavigationSuccess() {
        hasSuccessfulLoad = true
        hideOverlay()
        hideBanner()
    }

    // MARK: - Reload

    private func reloadWebView() {
        guard let webView = webView else { return }
        if webView.url != nil {
            webView.reload()
        } else if let url = Self.capacitorServerURL() {
            webView.load(URLRequest(url: url))
        }
    }

    private static func capacitorServerURL() -> URL? {
        guard let path = Bundle.main.path(forResource: "capacitor.config", ofType: "json"),
              let data = FileManager.default.contents(atPath: path),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let server = json["server"] as? [String: Any],
              let urlString = server["url"] as? String else {
            return URL(string: "https://clubrugbytipping.com")
        }
        return URL(string: urlString)
    }

    // MARK: - Full-screen overlay

    private func showOverlay() {
        guard overlayView == nil, let vc = viewController else { return }

        let overlay = UIView()
        overlay.backgroundColor = Self.bgColor
        overlay.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView(image: UIImage(systemName: "wifi.slash", withConfiguration: UIImage.SymbolConfiguration(pointSize: 44, weight: .light)))
        icon.tintColor = UIColor.white.withAlphaComponent(0.45)
        icon.translatesAutoresizingMaskIntoConstraints = false

        let title = UILabel()
        title.text = "You're offline"
        title.font = .systemFont(ofSize: 22, weight: .bold)
        title.textColor = .white

        let subtitle = UILabel()
        subtitle.text = "Check your connection and try again."
        subtitle.font = .systemFont(ofSize: 15)
        subtitle.textColor = UIColor.white.withAlphaComponent(0.55)
        subtitle.textAlignment = .center
        subtitle.numberOfLines = 0

        let button = UIButton(type: .system)
        button.setTitle("Try Again", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.setTitleColor(Self.bgColor, for: .normal)
        button.backgroundColor = .white
        button.layer.cornerRadius = 14
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        NSLayoutConstraint.activate([
            button.heightAnchor.constraint(equalToConstant: 48),
            button.widthAnchor.constraint(equalToConstant: 160),
        ])

        let stack = UIStackView(arrangedSubviews: [icon, title, subtitle, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.setCustomSpacing(24, after: subtitle)
        stack.translatesAutoresizingMaskIntoConstraints = false

        overlay.addSubview(stack)
        vc.view.addSubview(overlay)

        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: vc.view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: vc.view.bottomAnchor),
            overlay.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor),
            stack.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            subtitle.widthAnchor.constraint(lessThanOrEqualToConstant: 260),
        ])

        overlayView = overlay
        overlay.alpha = 0
        UIView.animate(withDuration: 0.3) { overlay.alpha = 1 }
    }

    private func hideOverlay() {
        guard let overlay = overlayView else { return }
        UIView.animate(withDuration: 0.25, animations: { overlay.alpha = 0 }) { _ in
            overlay.removeFromSuperview()
        }
        overlayView = nil
    }

    @objc private func retryTapped() {
        reloadWebView()
    }

    // MARK: - Banner

    private func showBanner() {
        guard bannerView == nil, let vc = viewController else { return }

        let banner = UIView()
        banner.backgroundColor = UIColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 0.96)
        banner.translatesAutoresizingMaskIntoConstraints = false
        banner.layer.cornerRadius = 18

        let icon = UIImageView(image: UIImage(systemName: "wifi.slash", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold)))
        icon.tintColor = UIColor.white.withAlphaComponent(0.65)
        icon.translatesAutoresizingMaskIntoConstraints = false

        let label = UILabel()
        label.text = "No connection"
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        label.textColor = .white

        let hStack = UIStackView(arrangedSubviews: [icon, label])
        hStack.axis = .horizontal
        hStack.spacing = 6
        hStack.alignment = .center
        hStack.translatesAutoresizingMaskIntoConstraints = false

        banner.addSubview(hStack)
        vc.view.addSubview(banner)

        let top = banner.topAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.topAnchor, constant: -50)

        NSLayoutConstraint.activate([
            top,
            banner.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
            hStack.topAnchor.constraint(equalTo: banner.topAnchor, constant: 8),
            hStack.bottomAnchor.constraint(equalTo: banner.bottomAnchor, constant: -8),
            hStack.leadingAnchor.constraint(equalTo: banner.leadingAnchor, constant: 16),
            hStack.trailingAnchor.constraint(equalTo: banner.trailingAnchor, constant: -16),
        ])

        bannerView = banner
        bannerTopConstraint = top

        vc.view.layoutIfNeeded()
        top.constant = 4
        UIView.animate(withDuration: 0.4, delay: 0, usingSpringWithDamping: 0.75, initialSpringVelocity: 0, options: [], animations: {
            vc.view.layoutIfNeeded()
        })
    }

    private func hideBanner() {
        guard let banner = bannerView, let vc = viewController else { return }
        bannerTopConstraint?.constant = -50
        UIView.animate(withDuration: 0.25, animations: {
            vc.view.layoutIfNeeded()
        }) { _ in
            banner.removeFromSuperview()
        }
        bannerView = nil
        bannerTopConstraint = nil
    }
}
