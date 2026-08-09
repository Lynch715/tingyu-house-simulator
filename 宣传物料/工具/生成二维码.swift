import AppKit
import CoreImage
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("用法：swift 生成二维码.swift <网址> <输出PNG>\n", stderr)
    exit(2)
}

let payload = CommandLine.arguments[1]
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let data = payload.data(using: .utf8),
      let filter = CIFilter(name: "CIQRCodeGenerator") else {
    fatalError("无法创建二维码滤镜")
}

filter.setValue(data, forKey: "inputMessage")
filter.setValue("H", forKey: "inputCorrectionLevel")
guard let raw = filter.outputImage else { fatalError("二维码生成失败") }

let modules = Int(raw.extent.width)
let scale = 12
let quiet = 4 * scale
let qrSize = modules * scale
let canvasSize = qrSize + quiet * 2
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let bitmap = CGContext(data: nil, width: canvasSize, height: canvasSize,
                             bitsPerComponent: 8, bytesPerRow: canvasSize * 4,
                             space: colorSpace,
                             bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("无法创建画布")
}

bitmap.setFillColor(NSColor.white.cgColor)
bitmap.fill(CGRect(x: 0, y: 0, width: canvasSize, height: canvasSize))
let scaled = raw.transformed(by: CGAffineTransform(scaleX: CGFloat(scale), y: CGFloat(scale)))
let ciContext = CIContext(options: [.useSoftwareRenderer: true])
guard let qrImage = ciContext.createCGImage(scaled, from: scaled.extent) else {
    fatalError("二维码渲染失败")
}
bitmap.interpolationQuality = .none
bitmap.draw(qrImage, in: CGRect(x: quiet, y: quiet, width: qrSize, height: qrSize))
guard let outputImage = bitmap.makeImage() else { fatalError("二维码导出失败") }

let rep = NSBitmapImageRep(cgImage: outputImage)
guard let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("PNG 编码失败")
}
try png.write(to: outputURL)
print("QR_OK \(payload) \(canvasSize)x\(canvasSize) \(outputURL.path)")
