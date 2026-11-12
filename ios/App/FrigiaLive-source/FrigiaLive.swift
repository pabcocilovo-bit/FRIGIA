// L'Activité en direct de la recette en cours : écran verrouillé et Dynamic Island.
// Copiée dans la cible « FrigiaLive » par scripts/live-activity.sh (voir MOBILE.md).
// Mise à jour par l'app (ios/App/App/LiveCooking.swift). Le compte à rebours avance tout seul.
import ActivityKit
import SwiftUI
import WidgetKit

/// Doit rester identique à celle de LiveCooking.swift (même nom, mêmes champs).
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

private let green = Color(red: 45 / 255, green: 94 / 255, blue: 69 / 255)
private let mint = Color(red: 159 / 255, green: 204 / 255, blue: 164 / 255)
private let cream = Color(red: 243 / 255, green: 240 / 255, blue: 231 / 255)

private func mmss(_ s: Int) -> String { String(format: "%02d:%02d", s / 60, s % 60) }

/// Le minuteur : compte à rebours en marche, temps restant en pause
struct TimerText: View {
    let state: CookingAttributes.ContentState
    var body: some View {
        if let end = state.timerEnd, end > Date() {
            Text(timerInterval: Date()...end, countsDown: true)
                .monospacedDigit()
        } else if let left = state.pausedLeft {
            Text(mmss(left)).monospacedDigit()
        } else if state.timerEnd != nil {
            Text("Prêt !")
        }
    }
}

struct LockScreenView: View {
    let context: ActivityViewContext<CookingAttributes>
    var body: some View {
        let s = context.state
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "frying.pan.fill").foregroundColor(mint)
                Text(context.attributes.title).font(.headline).foregroundColor(cream).lineLimit(1)
                Spacer()
                Text("Étape \(s.step)/\(s.steps)").font(.subheadline.weight(.semibold)).foregroundColor(mint)
            }
            if !s.stepText.isEmpty {
                Text(s.stepText).font(.subheadline).foregroundColor(cream.opacity(0.9)).lineLimit(2)
            }
            if s.timerLabel != nil {
                HStack {
                    Image(systemName: "timer").foregroundColor(mint)
                    Text(s.timerLabel ?? "").font(.subheadline).foregroundColor(cream).lineLimit(1)
                    Spacer()
                    TimerText(state: s).font(.title3.weight(.bold)).foregroundColor(cream)
                }
                if let start = s.timerStart, let end = s.timerEnd, end > Date() {
                    ProgressView(timerInterval: start...end, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
                        .tint(mint)
                }
            }
            // Barre des étapes, comme le suivi d'une commande
            HStack(spacing: 4) {
                ForEach(1...max(1, s.steps), id: \.self) { i in
                    Capsule().fill(i <= s.step ? mint : cream.opacity(0.25)).frame(height: 4)
                }
            }
        }
        .padding(16)
    }
}

struct FrigiaLiveWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookingAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(green)
                .activitySystemActionForegroundColor(cream)
                .widgetURL(URL(string: "fr.frigia.app://cuisine"))
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Étape \(s.step)/\(s.steps)", systemImage: "frying.pan.fill").font(.caption).foregroundColor(mint)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TimerText(state: s).font(.title3.weight(.bold)).frame(maxWidth: 90, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.attributes.title).font(.headline).lineLimit(1)
                        if !s.stepText.isEmpty { Text(s.stepText).font(.caption).foregroundColor(.secondary).lineLimit(2) }
                    }
                }
            } compactLeading: {
                Image(systemName: s.timerLabel != nil ? "timer" : "frying.pan.fill").foregroundColor(mint)
            } compactTrailing: {
                if s.timerLabel != nil { TimerText(state: s).frame(maxWidth: 52).font(.caption.weight(.semibold)) }
                else { Text("\(s.step)/\(s.steps)").font(.caption.weight(.semibold)) }
            } minimal: {
                Image(systemName: s.timerLabel != nil ? "timer" : "frying.pan.fill").foregroundColor(mint)
            }
            .widgetURL(URL(string: "fr.frigia.app://cuisine"))
            .keylineTint(mint)
        }
    }
}

@main
struct FrigiaLiveBundle: WidgetBundle {
    var body: some Widget { FrigiaLiveWidget() }
}
