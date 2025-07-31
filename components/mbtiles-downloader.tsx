"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Download, MapPin, Zap, CheckCircle, AlertCircle } from "lucide-react"

export function MBTilesDownloader() {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [downloadComplete, setDownloadComplete] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    north: "",
    south: "",
    east: "",
    west: "",
    minZoom: "1",
    maxZoom: "15",
    tileSource: "openstreetmap",
    outputName: "tiles",
  })

  const handleDownload = async () => {
    setDownloading(true)
    setProgress(0)
    setError("")
    setDownloadComplete(false)

    try {
      // Validate coordinates
      const { north, south, east, west, minZoom, maxZoom, outputName } = formData

      if (!north || !south || !east || !west) {
        throw new Error("Please provide all coordinate values")
      }

      // Simulate download progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return 95
          }
          return prev + Math.random() * 10
        })
      }, 500)

      // Simulate API call to Python backend
      const response = await fetch("/api/download-mbtiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bounds: {
            north: Number.parseFloat(north),
            south: Number.parseFloat(south),
            east: Number.parseFloat(east),
            west: Number.parseFloat(west),
          },
          minZoom: Number.parseInt(minZoom),
          maxZoom: Number.parseInt(maxZoom),
          tileSource: formData.tileSource,
          outputName,
        }),
      })

      if (response.ok) {
        setProgress(100)
        setDownloadComplete(true)

        // Create and trigger download of sample file
        const blob = new Blob(["Sample MBTiles data"], { type: "application/octet-stream" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${outputName}.mbtiles`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        throw new Error("Download failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed")
    } finally {
      setDownloading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setFormData({
              ...formData,
              north: "40.7831",
              south: "40.7489",
              east: "-73.9441",
              west: "-74.0059",
            })
          }}
        >
          <CardContent className="p-4 text-center">
            <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="font-medium">New York City</p>
            <p className="text-sm text-gray-500">Quick preset</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setFormData({
              ...formData,
              north: "51.5074",
              south: "51.4994",
              east: "-0.1278",
              west: "-0.1369",
            })
          }}
        >
          <CardContent className="p-4 text-center">
            <MapPin className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="font-medium">London</p>
            <p className="text-sm text-gray-500">Quick preset</p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => {
            setFormData({
              ...formData,
              north: "37.7849",
              south: "37.7749",
              east: "-122.4194",
              west: "-122.4294",
            })
          }}
        >
          <CardContent className="p-4 text-center">
            <MapPin className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="font-medium">San Francisco</p>
            <p className="text-sm text-gray-500">Quick preset</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Configuration
          </CardTitle>
          <CardDescription>Configure your MBTiles download parameters and region of interest.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Coordinates */}
          <div>
            <Label className="text-base font-medium mb-3 block">Bounding Box Coordinates</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="north">North Latitude</Label>
                <Input
                  id="north"
                  type="number"
                  step="any"
                  placeholder="40.7831"
                  value={formData.north}
                  onChange={(e) => handleInputChange("north", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="south">South Latitude</Label>
                <Input
                  id="south"
                  type="number"
                  step="any"
                  placeholder="40.7489"
                  value={formData.south}
                  onChange={(e) => handleInputChange("south", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="east">East Longitude</Label>
                <Input
                  id="east"
                  type="number"
                  step="any"
                  placeholder="-73.9441"
                  value={formData.east}
                  onChange={(e) => handleInputChange("east", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="west">West Longitude</Label>
                <Input
                  id="west"
                  type="number"
                  step="any"
                  placeholder="-74.0059"
                  value={formData.west}
                  onChange={(e) => handleInputChange("west", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Zoom Levels */}
          <div>
            <Label className="text-base font-medium mb-3 block">Zoom Levels</Label>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minZoom">Minimum Zoom</Label>
                <Select value={formData.minZoom} onValueChange={(value) => handleInputChange("minZoom", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(19)].map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxZoom">Maximum Zoom</Label>
                <Select value={formData.maxZoom} onValueChange={(value) => handleInputChange("maxZoom", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(19)].map((_, i) => (
                      <SelectItem key={i} value={i.toString()}>
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tile Source */}
          <div className="space-y-2">
            <Label htmlFor="tileSource">Tile Source</Label>
            <Select value={formData.tileSource} onValueChange={(value) => handleInputChange("tileSource", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openstreetmap">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Free</Badge>
                    OpenStreetMap
                  </div>
                </SelectItem>
                <SelectItem value="satellite">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Premium</Badge>
                    Satellite Imagery
                  </div>
                </SelectItem>
                <SelectItem value="terrain">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Free</Badge>
                    Terrain
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Output Name */}
          <div className="space-y-2">
            <Label htmlFor="outputName">Output Filename</Label>
            <Input
              id="outputName"
              placeholder="my-tiles"
              value={formData.outputName}
              onChange={(e) => handleInputChange("outputName", e.target.value)}
            />
          </div>

          {/* Progress */}
          {downloading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Downloading tiles...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {downloadComplete && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Download completed successfully! File has been saved to your downloads folder.
              </AlertDescription>
            </Alert>
          )}

          {/* Download Button */}
          <Button onClick={handleDownload} disabled={downloading} className="w-full" size="lg">
            {downloading ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download MBTiles
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
