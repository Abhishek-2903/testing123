"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, MapPin, Settings, Zap, Database, Gauge, CheckCircle, AlertCircle } from "lucide-react"

interface ProgressData {
  total_tiles: number
  downloaded_tiles: number
  current_zoom: number
  status: string
  error?: string
  progress_percent: number
  tiles_per_second: number
  estimated_remaining_time: number
  elapsed_time: number
  output_file?: string
  display_name?: string
  file_size_bytes?: number
}

export default function MBTilesDownloader() {
  const [lat, setLat] = useState<string>("")
  const [lon, setLon] = useState<string>("")
  const [filename, setFilename] = useState<string>("")
  const [areaSize, setAreaSize] = useState<string>("0.005")
  const [customBuffer, setCustomBuffer] = useState<string>("0.005")
  const [minZoom, setMinZoom] = useState<number>(10)
  const [maxZoom, setMaxZoom] = useState<number>(16)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [status, setStatus] = useState<string>("")
  const [statusType, setStatusType] = useState<"success" | "error" | "info">("info")
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  // Quick preset locations
  const presetLocations = [
    { name: "New York City", lat: "40.7831", lon: "-74.0059", icon: "🗽" },
    { name: "London", lat: "51.5074", lon: "-0.1278", icon: "🏰" },
    { name: "Tokyo", lat: "35.6762", lon: "139.6503", icon: "🗼" },
    { name: "Delhi", lat: "28.6139", lon: "77.2090", icon: "🕌" },
    { name: "Sydney", lat: "-33.8688", lon: "151.2093", icon: "🏛️" },
    { name: "Paris", lat: "48.8566", lon: "2.3522", icon: "🗼" },
  ]

  const updateAreaInfo = () => {
    const buffer = areaSize === "custom" ? Number.parseFloat(customBuffer) : Number.parseFloat(areaSize)
    const areaSizeKm = Math.round(buffer * 111)
    const zoomLevels = maxZoom - minZoom + 1

    let totalTiles = 0
    for (let z = minZoom; z <= maxZoom; z++) {
      const tilesPerSide = Math.ceil((buffer * Math.pow(2, z) * 111) / 0.15)
      totalTiles += tilesPerSide * tilesPerSide
    }

    return {
      areaSizeKm,
      zoomLevels,
      totalTiles,
      estimatedSize: Math.round((totalTiles * 15) / 1024),
    }
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  const pollProgress = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/progress/${sessionId}`)
      const progressData = await response.json()

      if (response.ok) {
        setProgress(progressData)

        if (progressData.status === "completed") {
          clearInterval(progressInterval.current!)
          setIsLoading(false)

          let message = `✅ MBTiles created successfully!\n`
          message += `📁 File: ${progressData.display_name || "output.mbtiles"}\n`
          message += `📏 Size: ${(progressData.file_size_bytes / 1024 / 1024).toFixed(2)} MB\n`
          message += `📊 Total Tiles: ${progressData.total_tiles}\n`
          message += `⏱️ Total Time: ${formatTime(progressData.elapsed_time)}`

          setStatus(message)
          setStatusType("success")
        } else if (progressData.status === "error") {
          clearInterval(progressInterval.current!)
          setIsLoading(false)
          setStatus(`❌ Download failed: ${progressData.error}`)
          setStatusType("error")
        }
      }
    } catch (error) {
      console.error("Progress polling failed:", error)
    }
  }

  const checkSetup = async () => {
    setIsLoading(true)
    setStatus("Checking system setup...")
    setStatusType("info")

    try {
      const response = await fetch("/api/check_qgis")
      const data = await response.json()

      if (response.ok) {
        let message = `✅ System Status: ${data.qgis_status}\n\n`
        message += `🛠️ Available Methods:\n`
        message += `• Manual tile download (recommended)\n`
        message += `\n📡 Ready to download satellite imagery!`

        setStatus(message)
        setStatusType("success")
      } else {
        setStatus(`❌ Error: ${data.error}`)
        setStatusType("error")
      }
    } catch (error) {
      setStatus(`❌ Network Error: ${error}`)
      setStatusType("error")
    }

    setIsLoading(false)
  }

  const downloadMBTiles = async () => {
    const latNum = Number.parseFloat(lat)
    const lonNum = Number.parseFloat(lon)
    const buffer = areaSize === "custom" ? Number.parseFloat(customBuffer) : Number.parseFloat(areaSize)

    // Validation
    if (isNaN(latNum) || isNaN(lonNum) || isNaN(buffer)) {
      setStatus("❌ Please enter valid coordinates and area size.")
      setStatusType("error")
      return
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      setStatus("❌ Coordinates must be within valid ranges.")
      setStatusType("error")
      return
    }

    if (minZoom > maxZoom) {
      setStatus("❌ Minimum zoom must be less than or equal to maximum zoom.")
      setStatusType("error")
      return
    }

    setIsLoading(true)
    setStatus("🚀 Starting satellite tile download...")
    setStatusType("info")
    setProgress(null)

    try {
      const response = await fetch("/api/download_mbtiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: latNum,
          lon: lonNum,
          buffer,
          min_zoom: minZoom,
          max_zoom: maxZoom,
          filename: filename.trim(),
        }),
      })

      const data = await response.json()

      if (response.ok && data.session_id) {
        setSessionId(data.session_id)
        setStatus("📡 Download started! Tracking progress...")
        setStatusType("info")

        // Start polling for progress
        progressInterval.current = setInterval(() => {
          pollProgress(data.session_id)
        }, 1500)

        // Initial progress check
        setTimeout(() => pollProgress(data.session_id), 500)
      } else {
        setIsLoading(false)
        setStatus(`❌ Failed to start download: ${data.error || "Unknown error"}`)
        setStatusType("error")
      }
    } catch (error) {
      setIsLoading(false)
      setStatus(`❌ Network Error: ${error}`)
      setStatusType("error")
    }
  }

  const downloadFile = () => {
    if (progress?.output_file) {
      const filename = progress.output_file.split("/").pop() || "output.mbtiles"
      const link = document.createElement("a")
      link.href = `/api/download_file/${filename}`
      link.download = progress.display_name || filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const setPresetLocation = (preset: (typeof presetLocations)[0]) => {
    setLat(preset.lat)
    setLon(preset.lon)
  }

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  const estimates = updateAreaInfo()

  return (
    <div className="space-y-6">
      {/* Quick Preset Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Quick Location Presets
          </CardTitle>
          <CardDescription>Click on a location to quickly set coordinates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {presetLocations.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                className="h-auto p-3 flex flex-col items-center gap-2 bg-transparent"
                onClick={() => setPresetLocation(preset)}
              >
                <span className="text-2xl">{preset.icon}</span>
                <span className="text-xs font-medium">{preset.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Settings
          </CardTitle>
          <CardDescription>Enter the coordinates and area size for your satellite imagery download</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lat">📍 Latitude</Label>
              <Input
                id="lat"
                type="number"
                step="any"
                placeholder="e.g., 28.6139"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Range: -90 to 90</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lon">📍 Longitude</Label>
              <Input
                id="lon"
                type="number"
                step="any"
                placeholder="e.g., 77.209"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Range: -180 to 180</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filename">📁 File Name (optional)</Label>
            <Input
              id="filename"
              type="text"
              placeholder="e.g., delhi_satellite_map"
              maxLength={50}
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for auto-generated name. Only letters, numbers, hyphens, and underscores allowed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>🗺️ Area Size</Label>
              <Select value={areaSize} onValueChange={setAreaSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.001">Very Small (~200m × 200m)</SelectItem>
                  <SelectItem value="0.005">Small (~1km × 1km)</SelectItem>
                  <SelectItem value="0.01">Medium (~2km × 2km)</SelectItem>
                  <SelectItem value="0.02">Large (~4km × 4km)</SelectItem>
                  <SelectItem value="0.05">Very Large (~10km × 10km)</SelectItem>
                  <SelectItem value="custom">Custom Buffer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {areaSize === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-buffer">📐 Custom Buffer (degrees)</Label>
                <Input
                  id="custom-buffer"
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="0.1"
                  value={customBuffer}
                  onChange={(e) => setCustomBuffer(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">0.001 ≈ 100m, 0.01 ≈ 1km</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Zoom Level Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Zoom Level Configuration
          </CardTitle>
          <CardDescription>Configure the detail level of your satellite imagery</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>🔍 Minimum Zoom Level: {minZoom}</Label>
              <input
                type="range"
                min="1"
                max="18"
                value={minZoom}
                onChange={(e) => setMinZoom(Number.parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label>🔍 Maximum Zoom Level: {maxZoom}</Label>
              <input
                type="range"
                min="1"
                max="21"
                value={maxZoom}
                onChange={(e) => setMaxZoom(Number.parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              <strong>📊 Download Estimate</strong>
              <br />
              <strong>Area:</strong> ~{estimates.areaSizeKm}km × {estimates.areaSizeKm}km
              <br />
              <strong>Zoom Range:</strong> {minZoom}-{maxZoom} ({estimates.zoomLevels} levels)
              <br />
              <strong>Estimated Tiles:</strong> ~{estimates.totalTiles.toLocaleString()} tiles
              <br />
              <strong>Estimated Size:</strong> ~{estimates.estimatedSize} MB
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertDescription>
              <strong>💡 Zoom Level Guide</strong>
              <br />
              <strong>1-8:</strong> Country/Region level
              <br />
              <strong>9-12:</strong> City level
              <br />
              <strong>13-16:</strong> Street/Building level (recommended)
              <br />
              <strong>17-21:</strong> Very detailed (large file sizes)
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={checkSetup} disabled={isLoading} variant="outline" className="flex-1 bg-transparent">
          <Zap className="mr-2 h-4 w-4" />🔧 Check Setup
        </Button>
        <Button onClick={downloadMBTiles} disabled={isLoading} className="flex-1">
          <Download className="mr-2 h-4 w-4" />🚀 Download MBTiles
        </Button>
      </div>

      {/* Progress Display */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Download Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progress.progress_percent} className="w-full" />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{progress.progress_percent}%</div>
                <div className="text-sm text-muted-foreground">Progress</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {progress.downloaded_tiles} / {progress.total_tiles}
                </div>
                <div className="text-sm text-muted-foreground">Tiles Downloaded</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{progress.current_zoom}</div>
                <div className="text-sm text-muted-foreground">Current Zoom</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{progress.tiles_per_second}</div>
                <div className="text-sm text-muted-foreground">Tiles/sec</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {progress.estimated_remaining_time > 0
                    ? formatTime(progress.estimated_remaining_time)
                    : "Calculating..."}
                </div>
                <div className="text-sm text-muted-foreground">Time Remaining</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{formatTime(progress.elapsed_time)}</div>
                <div className="text-sm text-muted-foreground">Elapsed Time</div>
              </div>
            </div>

            {progress.status === "completed" && progress.output_file && (
              <Button onClick={downloadFile} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />📥 Download {progress.display_name || "MBTiles File"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Display */}
      {status && (
        <Alert
          className={
            statusType === "error"
              ? "border-red-500 bg-red-50"
              : statusType === "success"
                ? "border-green-500 bg-green-50"
                : "border-blue-500 bg-blue-50"
          }
        >
          {statusType === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : statusType === "success" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          <AlertDescription>
            <pre className="whitespace-pre-wrap font-sans">{status}</pre>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
