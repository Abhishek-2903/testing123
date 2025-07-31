"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Settings, Zap, CheckCircle, AlertCircle, Clock, Activity, Satellite, Globe } from "lucide-react"

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

export default function MBTilesExporter() {
  // Form state
  const [lat, setLat] = useState("")
  const [lon, setLon] = useState("")
  const [filename, setFilename] = useState("")
  const [areaSize, setAreaSize] = useState("0.005")
  const [customBuffer, setCustomBuffer] = useState("0.005")
  const [minZoom, setMinZoom] = useState(10)
  const [maxZoom, setMaxZoom] = useState(16)

  // Progress state
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  const [status, setStatus] = useState<{ message: string; type: string } | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>("checking")

  // Refs
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const startTime = useRef<Date | null>(null)

  // Utility functions
  const sanitizeFilename = (filename: string) => {
    if (!filename || filename.trim() === "") return ""
    return filename
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 50)
  }

  const generateAutoFilename = (lat: number, lon: number, minZoom: number, maxZoom: number) => {
    const latStr = lat.toFixed(4).replace(".", "_").replace("-", "S")
    const lonStr = lon.toFixed(4).replace(".", "_").replace("-", "W")
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    return `satellite_${latStr}_${lonStr}_z${minZoom}-${maxZoom}_${timestamp}`
  }

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
  }

  // Area calculation
  const updateAreaInfo = () => {
    const buffer = areaSize === "custom" ? Number.parseFloat(customBuffer) : Number.parseFloat(areaSize)
    const areaSizeKm = Math.round(buffer * 111)
    const zoomLevels = maxZoom - minZoom + 1

    let totalTiles = 0
    for (let z = minZoom; z <= maxZoom; z++) {
      const tilesPerSide = Math.ceil((buffer * Math.pow(2, z) * 111) / 0.15)
      totalTiles += tilesPerSide * tilesPerSide
    }

    const estimatedSize = Math.round((totalTiles * 15) / 1024)
    const downloadTime = Math.round(totalTiles * 0.1)

    return {
      areaSizeKm,
      zoomLevels,
      totalTiles,
      estimatedSize,
      downloadTime,
    }
  }

  const estimates = updateAreaInfo()

  // Progress polling
  const pollProgress = async (sessionId: string) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/progress/${sessionId}`)
      const data = await response.json()

      if (response.ok) {
        setProgressData(data)

        if (data.status === "completed") {
          clearInterval(progressInterval.current!)
          setLoading(false)

          const message = `✅ MBTiles created successfully!<br/>📁 File: ${data.display_name || "output.mbtiles"}<br/>📏 Size: ${(data.file_size_bytes / 1024 / 1024).toFixed(2)} MB<br/>📊 Total Tiles: ${data.total_tiles}<br/>⏱️ Total Time: ${formatTime(data.elapsed_time)}`

          setStatus({ message, type: "success" })
        } else if (data.status === "error") {
          clearInterval(progressInterval.current!)
          setLoading(false)
          setStatus({ message: `❌ Download failed: ${data.error}`, type: "error" })
        }
      }
    } catch (error) {
      console.error("Progress polling failed:", error)
    }
  }

  // Check connection
  const checkConnection = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/health")
      if (response.ok) {
        setConnectionStatus("connected")
      } else {
        setConnectionStatus("error")
      }
    } catch (error) {
      setConnectionStatus("error")
    }
  }

  // Check QGIS setup
  const checkQGIS = async () => {
    setLoading(true)
    setStatus({ message: "Checking system setup...", type: "info" })

    try {
      const response = await fetch("http://127.0.0.1:5000/check_qgis")
      const data = await response.json()

      if (response.ok) {
        let message = `✅ System Status: ${data.qgis_status}<br/><br/>🛠️ Available Methods:<br/>• Manual tile download (recommended)<br/>`
        if (data.tile_algorithms && data.tile_algorithms.length > 0) {
          message += `• QGIS tile generation (${data.tile_algorithms.length} algorithms)<br/>`
        }
        message += `<br/>📡 Ready to download satellite imagery!`

        setStatus({ message, type: "success" })
      } else {
        setStatus({ message: `❌ Error: ${data.error}`, type: "error" })
      }
    } catch (error) {
      setStatus({ message: `❌ Network Error: ${error}`, type: "error" })
    }

    setLoading(false)
  }

  // Download MBTiles
  const downloadMBTiles = async () => {
    const latNum = Number.parseFloat(lat)
    const lonNum = Number.parseFloat(lon)
    const buffer = areaSize === "custom" ? Number.parseFloat(customBuffer) : Number.parseFloat(areaSize)

    // Validation
    if (isNaN(latNum) || isNaN(lonNum) || isNaN(buffer)) {
      setStatus({ message: "❌ Please enter valid coordinates and area size.", type: "error" })
      return
    }

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      setStatus({ message: "❌ Coordinates must be within valid ranges.", type: "error" })
      return
    }

    if (minZoom > maxZoom) {
      setStatus({ message: "❌ Minimum zoom must be less than or equal to maximum zoom.", type: "error" })
      return
    }

    const sanitizedFilename = sanitizeFilename(filename)
    const finalFilename = sanitizedFilename || generateAutoFilename(latNum, lonNum, minZoom, maxZoom)

    setLoading(true)
    setProgressData(null)
    setStatus({ message: "🚀 Starting satellite tile download...", type: "info" })
    startTime.current = new Date()

    try {
      const response = await fetch("http://127.0.0.1:5000/download_mbtiles", {
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
          filename: finalFilename,
        }),
      })

      const data = await response.json()

      if (response.ok && data.session_id) {
        setCurrentSessionId(data.session_id)
        setStatus({ message: "📡 Download started! Tracking progress...", type: "info" })

        // Start polling for progress
        progressInterval.current = setInterval(() => {
          pollProgress(data.session_id)
        }, 1500)

        // Initial progress check
        setTimeout(() => pollProgress(data.session_id), 500)
      } else {
        setLoading(false)
        setStatus({ message: `❌ Failed to start download: ${data.error || "Unknown error"}`, type: "error" })
      }
    } catch (error) {
      setLoading(false)
      setStatus({ message: `❌ Network Error: ${error}`, type: "error" })
    }
  }

  // Effects
  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setTimeout(checkQGIS, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Satellite className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Shoonya Innovation</h1>
                <p className="text-sm text-gray-600">Advanced MBTiles Satellite Exporter</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={connectionStatus === "connected" ? "default" : "destructive"}>
                <Activity className="h-3 w-3 mr-1" />
                {connectionStatus === "connected" ? "Online" : "Offline"}
              </Badge>
              <Badge variant="secondary">v2.0.1</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              🛰️ Advanced MBTiles Satellite Exporter
            </CardTitle>
            <CardDescription>
              Download high-quality satellite imagery tiles for any location with real-time progress tracking
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Coordinates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">📍 Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="any"
                  placeholder="e.g., 28.6139"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">Range: -90 to 90</p>
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
                  required
                />
                <p className="text-xs text-gray-500">Range: -180 to 180</p>
              </div>
            </div>

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="filename">📁 File Name (optional)</Label>
              <Input
                id="filename"
                placeholder="e.g., delhi_satellite_map"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                maxLength={50}
              />
              <p className="text-xs text-gray-500">
                Leave empty for auto-generated name. Only letters, numbers, hyphens, and underscores allowed.
              </p>
            </div>

            {/* Area Size */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area-size">🗺️ Area Size</Label>
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
                  <p className="text-xs text-gray-500">0.001 ≈ 100m, 0.01 ≈ 1km</p>
                </div>
              )}
            </div>

            {/* Zoom Levels */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-zoom">🔍 Minimum Zoom Level: {minZoom}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    id="min-zoom"
                    min="1"
                    max="18"
                    value={minZoom}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value)
                      setMinZoom(value)
                      if (value > maxZoom) setMaxZoom(value)
                    }}
                    className="flex-1"
                  />
                  <div className="min-w-[60px] text-center font-bold text-green-600 bg-green-50 px-3 py-1 rounded border border-green-200">
                    {minZoom}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-zoom">🔍 Maximum Zoom Level: {maxZoom}</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    id="max-zoom"
                    min="1"
                    max="21"
                    value={maxZoom}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value)
                      setMaxZoom(value)
                      if (value < minZoom) setMinZoom(value)
                    }}
                    className="flex-1"
                  />
                  <div className="min-w-[60px] text-center font-bold text-green-600 bg-green-50 px-3 py-1 rounded border border-green-200">
                    {maxZoom}
                  </div>
                </div>
              </div>
            </div>

            {/* Estimates */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p>
                    <strong>📊 Download Estimate</strong>
                  </p>
                  <p>
                    <strong>Area:</strong> ~{estimates.areaSizeKm}km × {estimates.areaSizeKm}km
                  </p>
                  <p>
                    <strong>Zoom Range:</strong> {minZoom}-{maxZoom} ({estimates.zoomLevels} levels)
                  </p>
                  <p>
                    <strong>Estimated Tiles:</strong> ~{estimates.totalTiles.toLocaleString()} tiles
                  </p>
                  <p>
                    <strong>Estimated Size:</strong> ~{estimates.estimatedSize} MB
                  </p>
                  <p>
                    <strong>Download Time:</strong> ~
                    {estimates.downloadTime < 60
                      ? `${estimates.downloadTime} seconds`
                      : `${Math.round(estimates.downloadTime / 60)} minutes`}
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <div className="space-y-1">
                  <p>
                    <strong>💡 Zoom Level Guide</strong>
                  </p>
                  <p>
                    <strong>1-8:</strong> Country/Region level
                  </p>
                  <p>
                    <strong>9-12:</strong> City level
                  </p>
                  <p>
                    <strong>13-16:</strong> Street/Building level (recommended)
                  </p>
                  <p>
                    <strong>17-21:</strong> Very detailed (large file sizes)
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Buttons */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={checkQGIS} disabled={loading} className="flex-1 bg-transparent">
                <Settings className="h-4 w-4 mr-2" />🔧 Check Setup
              </Button>
              <Button onClick={downloadMBTiles} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />🚀 Download MBTiles
                  </>
                )}
              </Button>
            </div>

            {/* Progress Section */}
            {loading && progressData && (
              <div className="space-y-4">
                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Downloading tiles...</span>
                    <span>{Math.round(progressData.progress_percent)}%</span>
                  </div>
                  <Progress value={progressData.progress_percent} className="w-full" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{progressData.progress_percent}%</div>
                      <div className="text-xs text-gray-600">Progress</div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {progressData.downloaded_tiles} / {progressData.total_tiles}
                      </div>
                      <div className="text-xs text-gray-600">Tiles Downloaded</div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{progressData.current_zoom}</div>
                      <div className="text-xs text-gray-600">Current Zoom</div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {progressData.tiles_per_second}
                        <span
                          className={`inline-block w-2 h-2 rounded-full ml-1 ${
                            progressData.tiles_per_second > 5
                              ? "speed-fast"
                              : progressData.tiles_per_second > 2
                                ? "speed-medium"
                                : "speed-slow"
                          }`}
                        ></span>
                      </div>
                      <div className="text-xs text-gray-600">tiles/sec</div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {progressData.estimated_remaining_time > 0
                          ? formatTime(progressData.estimated_remaining_time)
                          : "Calculating..."}
                      </div>
                      <div className="text-xs text-gray-600">Time Remaining</div>
                    </div>
                  </Card>

                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{formatTime(progressData.elapsed_time)}</div>
                      <div className="text-xs text-gray-600">Elapsed Time</div>
                    </div>
                  </Card>
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <div className="space-y-1">
                      <p>
                        <strong>📊 Download Statistics</strong>
                      </p>
                      <p>
                        <strong>Session ID:</strong> {currentSessionId}
                      </p>
                      <p>
                        <strong>Start Time:</strong> {startTime.current?.toLocaleTimeString()}
                      </p>
                      <p>
                        <strong>Method:</strong> Manual tile download
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Status Messages */}
            {status && (
              <Alert variant={status.type === "error" ? "destructive" : "default"}>
                {status.type === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : status.type === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div dangerouslySetInnerHTML={{ __html: status.message }} />
                  {status.type === "success" && progressData?.output_file && (
                    <div className="mt-3">
                      <Button asChild>
                        <a
                          href={`http://127.0.0.1:5000/download_file/${progressData.output_file}`}
                          download={progressData.display_name}
                          className="inline-flex items-center"
                        >
                          <Download className="h-4 w-4 mr-2" />📥 Download {progressData.display_name || "MBTiles File"}
                        </a>
                      </Button>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {connectionStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Backend connection lost. Please check if the Python app is running on http://127.0.0.1:5000
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
