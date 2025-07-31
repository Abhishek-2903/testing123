"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Settings, Zap, CheckCircle, AlertCircle, Clock, Activity, Satellite, Globe, Wifi, WifiOff } from "lucide-react"

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
  // Use environment variable or default to current domain
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  
  // Form state
  const [lat, setLat] = useState("28.6139")
  const [lon, setLon] = useState("77.209")
  const [filename, setFilename] = useState("")
  const [areaSize, setAreaSize] = useState("0.005")
  const [customBuffer, setCustomBuffer] = useState("0.005")
  const [minZoom, setMinZoom] = useState(10)
  const [maxZoom, setMaxZoom] = useState(16)
  const [tileSource, setTileSource] = useState("satellite")

  // App state
  const [loading, setLoading] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [progressData, setProgressData] = useState<ProgressData | null>(null)
  
  type StatusType = { message: string; type: "info" | "success" | "error" } | null
  const [status, setStatus] = useState<StatusType>(null)
  const [connectionStatus, setConnectionStatus] = useState("checking")
  const [tileSources, setTileSources] = useState<string[]>([])
  const [downloadResult, setDownloadResult] = useState(null)

  // Utility functions
  const sanitizeFilename = (filename: string) => {
    return filename
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "")
      .substring(0, 50)
  }

  const generateAutoFilename = (lat: number, lon: number, minZoom: number, maxZoom: number): string => {
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
    const buffer = areaSize === "custom" ? parseFloat(customBuffer) : parseFloat(areaSize)
    const areaSizeKm = Math.round(buffer * 111)
    const zoomLevels = maxZoom - minZoom + 1

    let totalTiles = 0
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      const tilesPerSide = Math.ceil((buffer * 2) * Math.pow(2, zoom))
      totalTiles += tilesPerSide * tilesPerSide
    }

    // Limit estimation for serverless
    const limitedTiles = Math.min(totalTiles, 50)
    const estimatedSize = Math.round((limitedTiles * 15) / 1024)

    return {
      areaSizeKm,
      zoomLevels,
      totalTiles: limitedTiles,
      estimatedSize,
      isLimited: totalTiles > 50
    }
  }

  const estimates = updateAreaInfo()

  // Check connection
  const checkConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`)
      if (response.ok) {
        setConnectionStatus("connected")
        return true
      } else {
        setConnectionStatus("error")
        return false
      }
    } catch (error) {
      setConnectionStatus("error")
      return false
    }
  }

  // Load tile sources
  const loadTileSources = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tile-sources`)
      if (response.ok) {
        const data = await response.json()
        setTileSources(data.sources || [])
      }
    } catch (error) {
      console.error("Failed to load tile sources:", error)
      setTileSources(['satellite', 'openstreetmap', 'terrain'])
    }
  }

  // Check system status
  const checkSystem = async () => {
    setLoading(true)
    setStatus({ message: "Checking system setup...", type: "info" })

    try {
      const isConnected = await checkConnection()
      if (isConnected) {
        await loadTileSources()
        setStatus({ 
          message: "✅ System ready! Note: Serverless deployment limits downloads to ~50 tiles for demo purposes.", 
          type: "success" 
        })
      } else {
        setStatus({ 
          message: "❌ Unable to connect to backend services. Please try again.", 
          type: "error" 
        })
      }
    } catch (error) {
      setStatus({ message: `❌ Error: ${error instanceof Error ? error.message : String(error)}`, type: "error" })
    }

    setLoading(false)
  }

  // Download MBTiles
  const downloadMBTiles = async () => {
    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)
    const buffer = areaSize === "custom" ? parseFloat(customBuffer) : parseFloat(areaSize)

    // Validation
    if (isNaN(latNum) || isNaN(lonNum) || isNaN(buffer)) {
      setStatus({ message: "❌ Please enter valid numbers for coordinates and buffer", type: "error" })
      return
    }

    if (latNum < -90 || latNum > 90) {
      setStatus({ message: "❌ Latitude must be between -90 and 90", type: "error" })
      return
    }

    if (lonNum < -180 || lonNum > 180) {
      setStatus({ message: "❌ Longitude must be between -180 and 180", type: "error" })
      return
    }

    setLoading(true)
    setDownloadResult(null)
    setStatus({ message: "🚀 Starting tile download...", type: "info" })

    try {
      const response = await fetch(`${API_BASE}/api/download-mbtiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bounds: {
            north: latNum + buffer,
            south: latNum - buffer,
            east: lonNum + buffer,
            west: lonNum - buffer
          },
          minZoom,
          maxZoom,
          tileSource,
          outputName: sanitizeFilename(filename) || generateAutoFilename(latNum, lonNum, minZoom, maxZoom)
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setDownloadResult(data)
        setStatus({ 
          message: `✅ Download completed! Generated ${data.downloaded_tiles} tiles (${(data.file_size / 1024).toFixed(2)} KB)`, 
          type: "success" 
        })
      } else {
        setStatus({ message: `❌ Download failed: ${data.error || "Unknown error"}`, type: "error" })
      }
    } catch (error) {
      setStatus({ message: `❌ Network Error: ${error instanceof Error ? error.message : String(error)}`, type: "error" })
    }

    setLoading(false)
  }

  // Effects
  useEffect(() => {
    checkSystem()
    loadTileSources()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                <Satellite className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Shoonya Innovation</h1>
                <p className="text-sm text-gray-600">MBTiles Exporter - Vercel Edition</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={connectionStatus === "connected" ? "default" : "destructive"}>
                {connectionStatus === "connected" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                {connectionStatus === "connected" ? "Online" : "Offline"}
              </Badge>
              <Badge variant="secondary">Serverless</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-6 w-6" />
              🛰️ MBTiles Map Exporter
            </CardTitle>
            <CardDescription>
              Generate offline map tiles for any location (limited to 50 tiles in serverless demo)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Coordinates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lat">🌍 Latitude</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  placeholder="e.g., 28.6139"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
                <p className="text-xs text-gray-500">Range: -90 to 90</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lon">🌍 Longitude</Label>
                <Input
                  id="lon"
                  type="number"
                  step="0.0001"
                  placeholder="e.g., 77.209"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
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

            {/* Tile Source */}
            <div className="space-y-2">
              <Label htmlFor="tile-source">🗺️ Map Type</Label>
              <Select value={tileSource} onValueChange={setTileSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="satellite">Satellite Imagery</SelectItem>
                  <SelectItem value="openstreetmap">OpenStreetMap</SelectItem>
                  <SelectItem value="terrain">Terrain Map</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Area Size */}
            <div className="space-y-2">
              <Label htmlFor="area-size">📏 Area Size</Label>
              <Select value={areaSize} onValueChange={setAreaSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.001">Very Small (~200m × 200m)</SelectItem>
                  <SelectItem value="0.005">Small (~1km × 1km)</SelectItem>
                  <SelectItem value="0.01">Medium (~2km × 2km)</SelectItem>
                  <SelectItem value="custom">Custom Buffer</SelectItem>
                </SelectContent>
              </Select>

              {areaSize === "custom" && (
                <div className="mt-2">
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="0.01"
                    value={customBuffer}
                    onChange={(e) => setCustomBuffer(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter custom buffer in decimal degrees</p>
                </div>
              )}
            </div>

            {/* Zoom Levels */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-zoom">🔍 Min Zoom: {minZoom}</Label>
                <input
                  type="range"
                  id="min-zoom"
                  min="1"
                  max="16"
                  value={minZoom}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    setMinZoom(value)
                    if (value > maxZoom) setMaxZoom(value)
                  }}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-zoom">🔍 Max Zoom: {maxZoom}</Label>
                <input
                  type="range"
                  id="max-zoom"
                  min="1"
                  max="16"
                  value={maxZoom}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    setMaxZoom(value)
                    if (value < minZoom) setMinZoom(value)
                  }}
                  className="w-full"
                />
              </div>
            </div>

            {/* Estimates */}
            <Alert className={estimates.isLimited ? "border-yellow-200 bg-yellow-50" : "border-blue-200 bg-blue-50"}>
              <AlertCircle className={`h-4 w-4 ${estimates.isLimited ? "text-yellow-600" : "text-blue-600"}`} />
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>📊 Download Estimate</strong></p>
                  <p><strong>Area:</strong> ~{estimates.areaSizeKm}km × {estimates.areaSizeKm}km</p>
                  <p><strong>Tiles:</strong> {estimates.totalTiles} tiles {estimates.isLimited ? "(limited for demo)" : ""}</p>
                  <p><strong>Size:</strong> ~{estimates.estimatedSize} KB</p>
                  {estimates.isLimited && (
                    <p className="text-yellow-700 font-medium mt-2">
                      ⚠️ Large areas are limited to 50 tiles in this serverless demo
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Buttons */}
            <div className="flex gap-4">
              <Button variant="outline" onClick={checkSystem} disabled={loading} className="flex-1">
                <Settings className="h-4 w-4 mr-2" />
                Check System
              </Button>
              <Button onClick={downloadMBTiles} disabled={loading || connectionStatus !== "connected"} className="flex-1">
                {loading ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate MBTiles
                  </>
                )}
              </Button>
            </div>

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
                  {status.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Connection Error */}
            {connectionStatus === "error" && (
              <Alert variant="destructive">
                <WifiOff className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ Backend connection failed. Please check deployment status.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
