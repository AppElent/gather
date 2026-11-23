// SPIKE (APP-652, do not merge). Throwaway quality: proves the handoff, the
// Keychain, direct Convex HTTP and Canvas barcodes, nothing more.

import Security
import SwiftUI
import WatchConnectivity

@main
struct GatherWatchApp: App {
  @StateObject private var model = WatchModel()

  var body: some Scene {
    WindowGroup {
      ContentView().environmentObject(model)
    }
  }
}

// MARK: - Keychain

enum DeviceKeyStore {
  private static let service = "com.appelent.gather.watch"
  private static let account = "deviceKey"

  struct Credentials: Codable { let key: String; let siteUrl: String }

  static func save(_ credentials: Credentials) -> OSStatus {
    let data = try! JSONEncoder().encode(credentials)
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
    var add = query
    add[kSecValueData as String] = data
    add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(add as CFDictionary, nil)
  }

  static func load() -> Credentials? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
      let data = item as? Data
    else { return nil }
    return try? JSONDecoder().decode(Credentials.self, from: data)
  }
}

// MARK: - API

struct GroceryRow: Codable, Identifiable {
  let id: String
  let name: String
  let amount: String?
  let checked: Bool
}

struct LinearCode: Codable {
  /// Bar and space widths in modules, starting with a bar (bwip-js `sbs`).
  let sbs: [Double]
  /// Per bar: height and bottom, in bwip-js units (guards are taller).
  let bhs: [Double]
  let bbs: [Double]
  /// Quiet zone in modules, left and right.
  let quietLeft: Double
  let quietRight: Double
}

struct MatrixCode: Codable {
  let size: Int
  /// Row-major, 1 = dark module (bwip-js `pixs`).
  let pixs: [UInt8]
  let quiet: Int
}

struct Barcodes: Codable {
  let ean13: LinearCode
  let ean13Text: String
  let qr: MatrixCode
  let qrText: String
}

@MainActor
final class WatchModel: NSObject, ObservableObject {
  @Published var status = "Waiting for the phone…"
  @Published var rows: [GroceryRow] = []
  @Published var barcodes: Barcodes?
  @Published var keyPreview: String?

  override init() {
    super.init()
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
    if let stored = DeviceKeyStore.load() {
      keyPreview = String(stored.key.prefix(10)) + "…"
      status = "Key from Keychain"
      Task { await refresh(stored) }
    }
  }

  func receive(_ context: [String: Any]) {
    guard let key = context["deviceKey"] as? String,
      let siteUrl = context["siteUrl"] as? String
    else { return }
    let credentials = DeviceKeyStore.Credentials(key: key, siteUrl: siteUrl)
    let saved = DeviceKeyStore.save(credentials)
    keyPreview = String(key.prefix(10)) + "…"
    status = saved == errSecSuccess ? "Key received, saved" : "Keychain error \(saved)"
    print("[watch-spike] received key, keychain status \(saved)")
    Task { await refresh(credentials) }
  }

  func refresh(_ credentials: DeviceKeyStore.Credentials) async {
    do {
      rows = try await get("groceries", credentials, as: [String: [GroceryRow]].self)["rows"] ?? []
      barcodes = try await get("barcodes", credentials, as: Barcodes.self)
      status = "\(rows.count) rows from Convex"
      print("[watch-spike] fetched \(rows.count) rows")
    } catch {
      status = "Error: \(error.localizedDescription)"
      print("[watch-spike] fetch failed \(error)")
    }
  }

  private func get<T: Decodable>(
    _ path: String, _ credentials: DeviceKeyStore.Credentials, as: T.Type
  ) async throws -> T {
    var request = URLRequest(url: URL(string: "\(credentials.siteUrl)/watch/v1/spike/\(path)")!)
    request.setValue("Bearer \(credentials.key)", forHTTPHeaderField: "Authorization")
    let (data, response) = try await URLSession.shared.data(for: request)
    let code = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 else {
      throw NSError(domain: "watch-spike", code: code, userInfo: [NSLocalizedDescriptionKey: "HTTP \(code)"])
    }
    return try JSONDecoder().decode(T.self, from: data)
  }
}

extension WatchModel: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?
  ) {
    let context = session.receivedApplicationContext
    Task { @MainActor in
      if !context.isEmpty { self.receive(context) }
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
    Task { @MainActor in self.receive(context) }
  }
}

// MARK: - Views

struct ContentView: View {
  @EnvironmentObject var model: WatchModel
  /// `-page list|ean|qr` on launch, so a screenshot can open on one page.
  @State private var page: String =
    UserDefaults.standard.string(forKey: "page") ?? "list"

  var body: some View {
    TabView(selection: $page) {
      GroceryList().tag("list")
      LinearBarcodePage().tag("ean")
      MatrixBarcodePage().tag("qr")
    }
    .tabViewStyle(.verticalPage)
  }
}

struct GroceryList: View {
  @EnvironmentObject var model: WatchModel

  var body: some View {
    NavigationStack {
      List {
        ForEach(model.rows) { row in
          HStack {
            Image(systemName: row.checked ? "checkmark.circle.fill" : "circle")
              .foregroundStyle(row.checked ? .green : .secondary)
            VStack(alignment: .leading) {
              Text(row.name).strikethrough(row.checked)
              if let amount = row.amount {
                Text(amount).font(.footnote).foregroundStyle(.secondary)
              }
            }
          }
        }
        Section {
          Text(model.status).font(.footnote).foregroundStyle(.secondary)
        }
      }
      .navigationTitle("Groceries")
    }
  }
}

struct LinearBarcodePage: View {
  @EnvironmentObject var model: WatchModel

  var body: some View {
    VStack(spacing: 6) {
      if let code = model.barcodes {
        LinearBarcode(code: code.ean13)
          .frame(maxWidth: .infinity)
          .frame(height: 90)
          .background(.white)
          .clipShape(RoundedRectangle(cornerRadius: 6))
        Text(code.ean13Text).font(.system(.footnote, design: .monospaced))
      } else {
        Text(model.status).font(.footnote)
      }
    }
    .padding(.horizontal, 4)
    .navigationTitle("EAN-13")
  }
}

struct MatrixBarcodePage: View {
  @EnvironmentObject var model: WatchModel

  var body: some View {
    VStack(spacing: 6) {
      if let code = model.barcodes {
        MatrixBarcode(code: code.qr)
          .aspectRatio(1, contentMode: .fit)
          .background(.white)
          .clipShape(RoundedRectangle(cornerRadius: 6))
        Text(code.qrText).font(.system(.footnote, design: .monospaced)).lineLimit(1)
      } else {
        Text(model.status).font(.footnote)
      }
    }
    .padding(.horizontal, 8)
  }
}

/// Bars from bwip-js `sbs`/`bhs`/`bbs`, black on white, with the quiet zone.
struct LinearBarcode: View {
  let code: LinearCode

  var body: some View {
    Canvas { context, size in
      context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.white))
      let modules = code.quietLeft + code.sbs.reduce(0, +) + code.quietRight
      let unit = size.width / modules
      let top = zip(code.bhs, code.bbs).map { $0 + $1 }.max() ?? 1
      let inset = size.height * 0.08
      let height = size.height - inset * 2
      var x = code.quietLeft * unit
      for (index, width) in code.sbs.enumerated() {
        if index % 2 == 0, index / 2 < code.bhs.count {
          let bar = index / 2
          let barTop = top - (code.bhs[bar] + code.bbs[bar])
          let rect = CGRect(
            x: x, y: inset + height * barTop / top,
            width: width * unit, height: height * code.bhs[bar] / top)
          context.fill(Path(rect), with: .color(.black))
        }
        x += width * unit
      }
    }
  }
}

/// Modules from bwip-js `pixs`, black on white, with the quiet zone.
struct MatrixBarcode: View {
  let code: MatrixCode

  var body: some View {
    Canvas { context, size in
      context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(.white))
      let total = Double(code.size + code.quiet * 2)
      let unit = min(size.width, size.height) / total
      var path = Path()
      for row in 0..<code.size {
        for column in 0..<code.size where code.pixs[row * code.size + column] == 1 {
          path.addRect(CGRect(
            x: (Double(column + code.quiet)) * unit, y: (Double(row + code.quiet)) * unit,
            width: unit, height: unit))
        }
      }
      context.fill(path, with: .color(.black))
    }
  }
}
