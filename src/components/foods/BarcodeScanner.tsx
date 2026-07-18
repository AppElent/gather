import { useEffect, useRef, useState } from 'react'
import { readBarcodes } from 'zxing-wasm/reader'
import { inputClass } from '../nutrition/nutrientInputs'

interface Props {
  onDetected: (barcode: string) => void
}

const ZXING_FORMATS = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E'] as const
// The native BarcodeDetector API uses lowercase snake_case format names —
// a different naming convention from zxing-wasm's for the same symbologies,
// so this list is intentionally separate rather than shared.
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

interface NativeBarcodeDetector {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

export function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [manualEntry, setManualEntry] = useState('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  // Read via a ref inside the scan loop below instead of depending on
  // `onDetected` directly — an inline arrow function passed by the caller
  // gets a new identity every render, which would otherwise tear down and
  // restart the camera stream on every unrelated re-render (e.g. typing in
  // a sibling search box) while scanning is active.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  useEffect(() => {
    if (!scanning) return
    let stream: MediaStream | undefined
    let stopped = false
    let intervalId: ReturnType<typeof setInterval> | undefined

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch {
        setCameraError(
          'Camera access was denied or unavailable — enter the barcode number instead.',
        )
        setScanning(false)
        return
      }
      if (stopped || !videoRef.current) {
        stream?.getTracks().forEach((t) => {
          t.stop()
        })
        return
      }
      videoRef.current.srcObject = stream
      try {
        await videoRef.current.play()
      } catch {
        // Some browsers reject autoplay despite `muted`; the video element
        // still renders the stream once the user interacts with the page.
      }

      const hasNativeDetector = 'BarcodeDetector' in window
      const nativeDetector: NativeBarcodeDetector | null = hasNativeDetector
        ? new (
            window as unknown as {
              BarcodeDetector: new (opts: {
                formats: string[]
              }) => NativeBarcodeDetector
            }
          ).BarcodeDetector({ formats: NATIVE_FORMATS })
        : null

      intervalId = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video.videoWidth === 0) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx2d = canvas.getContext('2d')
        if (!ctx2d) return
        ctx2d.drawImage(video, 0, 0)

        if (nativeDetector) {
          try {
            const results = await nativeDetector.detect(canvas)
            if (stopped) return
            if (results[0]?.rawValue) onDetectedRef.current(results[0].rawValue)
          } catch {
            // Ignore per-frame detection failures; the interval tries again.
          }
          return
        }
        const imageData = ctx2d.getImageData(0, 0, canvas.width, canvas.height)
        try {
          const results = await readBarcodes(imageData, {
            formats: [...ZXING_FORMATS],
            tryHarder: true,
          })
          if (stopped) return
          if (results[0]?.text) onDetectedRef.current(results[0].text)
        } catch {
          // Ignore per-frame detection failures; the interval tries again.
        }
      }, 500)
    }
    start()

    return () => {
      stopped = true
      if (intervalId) clearInterval(intervalId)
      stream?.getTracks().forEach((t) => {
        t.stop()
      })
    }
  }, [scanning])

  return (
    <div className="grid gap-3">
      {!cameraError && (
        <div>
          <button
            type="button"
            onClick={() => setScanning((s) => !s)}
            className="rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm"
          >
            {scanning ? 'Stop camera' : 'Scan barcode'}
          </button>
          {scanning && (
            <div className="relative mt-2 max-w-sm">
              <video
                ref={videoRef}
                className="w-full rounded-[var(--app-radius)]"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}
        </div>
      )}
      {cameraError && <p className="text-sm text-red-800">{cameraError}</p>}
      <label className="block max-w-xs text-sm">
        <span className="mb-1 block font-medium">
          Or enter the barcode number
        </span>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            className={inputClass}
            value={manualEntry}
            onChange={(e) => setManualEntry(e.target.value.replace(/\D/g, ''))}
            placeholder="8710398160005"
          />
          <button
            type="button"
            disabled={manualEntry.length < 8}
            className="whitespace-nowrap rounded-[var(--app-radius)] border border-[var(--app-border)] px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onDetected(manualEntry)}
          >
            Look up
          </button>
        </div>
      </label>
    </div>
  )
}
