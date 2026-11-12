// Activité en direct de la recette en cours (écran verrouillé, Dynamic Island).
// Appelée par src/app/scan/cookingNative.ts. L'affichage est dans ios/App/FrigiaLive/FrigiaLive.swift.
import Foundation
import Capacitor
#if canImport(ActivityKit)
import ActivityKit
#endif

#if canImport(ActivityKit)
/// Doit rester identique à celle de FrigiaLive.swift (même nom, mêmes champs).
@available(iOS 16.1, *)
struct CookingAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var step: Int
        var steps: Int
        var stepText: String
        var timerLabel: String?
        var timerStart: Date?
        var timerEnd: Date?
        var pausedLeft: Int?
    }
    var title: String
}
#endif

@objc(LiveCookingPlugin)
public class LiveCookingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveCookingPlugin"
    public let jsName = "LiveCooking"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    @objc func update(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { call.resolve(); return }
        let title = call.getString("title") ?? "Frigia"
        let date = { (key: String) -> Date? in call.getDouble(key).map { Date(timeIntervalSince1970: $0 / 1000) } }
        let state = CookingAttributes.ContentState(
            step: call.getInt("step") ?? 1,
            steps: call.getInt("steps") ?? 1,
            stepText: call.getString("stepText") ?? "",
            timerLabel: call.getString("timerLabel"),
            timerStart: date("timerStart"),
            timerEnd: date("timerEnd"),
            pausedLeft: call.getInt("pausedLeft")
        )
        // Fin prévue : la fin du minuteur, sinon dans une heure (l'activité disparaît d'elle-même ensuite)
        let content = ActivityContent(state: state, staleDate: state.timerEnd ?? Date().addingTimeInterval(3600))
        Task {
            let current = Activity<CookingAttributes>.activities
            if let activity = current.first(where: { $0.attributes.title == title }) {
                await activity.update(content)
            } else {
                for old in current { await old.end(nil, dismissalPolicy: .immediate) }
                _ = try? Activity.request(attributes: CookingAttributes(title: title), content: content, pushType: nil)
            }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }

    @objc func end(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        guard #available(iOS 16.2, *) else { call.resolve(); return }
        Task {
            for activity in Activity<CookingAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
            call.resolve()
        }
        #else
        call.resolve()
        #endif
    }
}
