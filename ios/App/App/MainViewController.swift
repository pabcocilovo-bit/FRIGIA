// Branche les plugins propres à Frigia (LiveCooking.swift). Utilisé par Main.storyboard.
import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(LiveCookingPlugin())
    }
}
