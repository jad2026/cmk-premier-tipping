import UIKit
import Capacitor

class CRTViewController: CAPBridgeViewController {
    private var offlineManager: OfflineManager?
    private var delegateProxy: WKNavigationDelegateProxy?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        setupOfflineHandling()
    }

    private func setupOfflineHandling() {
        guard let webView = bridge?.webView else { return }

        let manager = OfflineManager(viewController: self, webView: webView)
        offlineManager = manager

        let proxy = WKNavigationDelegateProxy()
        proxy.original = webView.navigationDelegate
        proxy.onNavigationError = { [weak manager] error in
            manager?.handleNavigationError(error)
        }
        proxy.onNavigationSuccess = { [weak manager] in
            manager?.handleNavigationSuccess()
        }
        webView.navigationDelegate = proxy
        delegateProxy = proxy
    }
}
