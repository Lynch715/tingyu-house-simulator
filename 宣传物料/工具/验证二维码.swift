import AppKit
import Foundation
import Vision

guard CommandLine.arguments.count == 2 else {
    fputs("用法：swift 验证二维码.swift <图片>\n", stderr)
    exit(2)
}

let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path),
      let data = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: data),
      let cgImage = bitmap.cgImage else {
    fatalError("无法读取图片")
}

let request = VNDetectBarcodesRequest()
request.symbologies = [.qr]
let handler = VNImageRequestHandler(cgImage: cgImage, orientation: .up)
try handler.perform([request])
let payloads = (request.results ?? []).compactMap { $0.payloadStringValue }
if payloads.isEmpty {
    fputs("QR_NOT_FOUND \(path)\n", stderr)
    exit(9)
}
for payload in payloads { print("QR_DECODED \(payload)") }
