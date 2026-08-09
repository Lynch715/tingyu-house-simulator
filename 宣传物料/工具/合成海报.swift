import AppKit
import Foundation

guard CommandLine.arguments.count == 4 else {
    fputs("用法：swift 合成海报.swift <底图PNG> <二维码PNG> <输出PNG>\n", stderr)
    exit(2)
}

let basePath = CommandLine.arguments[1]
let qrPath = CommandLine.arguments[2]
let outPath = CommandLine.arguments[3]
guard let base = NSImage(contentsOfFile: basePath),
      let qr = NSImage(contentsOfFile: qrPath) else {
    fatalError("无法读取底图或二维码")
}

let width = 1024
let height = 1536
guard let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height,
                                 bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
                                 isPlanar: false, colorSpaceName: .deviceRGB,
                                 bytesPerRow: 0, bitsPerPixel: 0) else {
    fatalError("无法创建海报画布")
}
rep.size = NSSize(width: width, height: height)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

base.draw(in: NSRect(x: 0, y: 0, width: width, height: height),
          from: .zero, operation: .copy, fraction: 1)

let topGradient = NSGradient(colors: [
    NSColor(calibratedWhite: 0.02, alpha: 0.90),
    NSColor(calibratedWhite: 0.02, alpha: 0.48),
    NSColor(calibratedWhite: 0.02, alpha: 0.00)
])!
topGradient.draw(in: NSRect(x: 0, y: 1125, width: width, height: 411), angle: 90)

let titleShadow = NSShadow()
titleShadow.shadowColor = NSColor.black.withAlphaComponent(0.9)
titleShadow.shadowBlurRadius = 8
titleShadow.shadowOffset = NSSize(width: 3, height: -4)

func drawText(_ text: String, rect: NSRect, font: NSFont, color: NSColor,
              alignment: NSTextAlignment = .left, kern: CGFloat = 0) {
    let style = NSMutableParagraphStyle()
    style.alignment = alignment
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .paragraphStyle: style,
        .kern: kern,
        .shadow: titleShadow
    ]
    text.draw(in: rect, withAttributes: attrs)
}

let titleFont = NSFont(name: "STSongti-SC-Black", size: 104) ?? .boldSystemFont(ofSize: 104)
let subtitleFont = NSFont(name: "PingFangSC-Semibold", size: 34) ?? .boldSystemFont(ofSize: 34)
let labelFont = NSFont(name: "PingFangSC-Medium", size: 23) ?? .systemFont(ofSize: 23, weight: .medium)
let smallFont = NSFont(name: "PingFangSC-Regular", size: 18) ?? .systemFont(ofSize: 18)

drawText("开个青楼", rect: NSRect(x: 66, y: 1330, width: 800, height: 130),
         font: titleFont, color: NSColor(calibratedRed: 0.96, green: 0.84, blue: 0.54, alpha: 1), kern: 7)
drawText("今晚点灯，谁来听雨？", rect: NSRect(x: 72, y: 1265, width: 700, height: 55),
         font: subtitleFont, color: .white, kern: 2)
drawText("古代艺馆经营模拟 · 浏览器打开即玩", rect: NSRect(x: 74, y: 1215, width: 720, height: 40),
         font: labelFont, color: NSColor(calibratedRed: 0.77, green: 0.85, blue: 0.82, alpha: 1), kern: 1)

let card = NSRect(x: 630, y: 48, width: 350, height: 438)
NSColor(calibratedRed: 0.08, green: 0.07, blue: 0.06, alpha: 0.96).setFill()
NSBezierPath(roundedRect: card, xRadius: 12, yRadius: 12).fill()
NSColor(calibratedRed: 0.82, green: 0.64, blue: 0.30, alpha: 1).setStroke()
let border = NSBezierPath(roundedRect: card.insetBy(dx: 7, dy: 7), xRadius: 8, yRadius: 8)
border.lineWidth = 3
border.stroke()

drawText("扫码即玩", rect: NSRect(x: 650, y: 416, width: 310, height: 46),
         font: subtitleFont, color: NSColor(calibratedRed: 0.96, green: 0.84, blue: 0.54, alpha: 1), alignment: .center, kern: 2)

let targetQR = floor(qr.size.width / 2)
let qrRect = NSRect(x: card.midX - targetQR / 2, y: 105, width: targetQR, height: targetQR)
NSGraphicsContext.current?.imageInterpolation = .none
qr.draw(in: qrRect, from: .zero, operation: .copy, fraction: 1)

drawText("免安装 · 手机电脑都能玩", rect: NSRect(x: 646, y: 66, width: 318, height: 32),
         font: smallFont, color: NSColor.white, alignment: .center, kern: 0.5)

NSGraphicsContext.restoreGraphicsState()
guard let png = rep.representation(using: .png, properties: [:]) else { fatalError("海报 PNG 编码失败") }
try png.write(to: URL(fileURLWithPath: outPath))
print("POSTER_OK \(width)x\(height) \(outPath)")

