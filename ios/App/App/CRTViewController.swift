import UIKit
import Capacitor

class CRTViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge.registerPluginInstance(WidgetBridgePlugin())
    }
}
