"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Layers, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

export function MapViewer() {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [coordinates, setCoordinates] = useState({ lat: 40.7128, lng: -74.006 })

  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => {
      setMapLoaded(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const handleLocationClick = (lat: number, lng: number, name: string) => {
    setCoordinates({ lat, lng })
  }

  return (
    <div className="space-y-6">
      {/* Quick Locations */}
      <div className="grid md:grid-cols-4 gap-4">
        <Button
          variant="outline"
          className="justify-start bg-transparent"
          onClick={() => handleLocationClick(40.7128, -74.006, "New York")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          New York
        </Button>
        <Button
          variant="outline"
          className="justify-start bg-transparent"
          onClick={() => handleLocationClick(51.5074, -0.1278, "London")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          London
        </Button>
        <Button
          variant="outline"
          className="justify-start bg-transparent"
          onClick={() => handleLocationClick(37.7749, -122.4194, "San Francisco")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          San Francisco
        </Button>
        <Button
          variant="outline"
          className="justify-start bg-transparent"
          onClick={() => handleLocationClick(48.8566, 2.3522, "Paris")}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Paris
        </Button>
      </div>

      {/* Map Container */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Interactive Map
              </CardTitle>
              <CardDescription>View and interact with your map tiles in real-time</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <Button size="sm" variant="outline" className="bg-white shadow-md">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="bg-white shadow-md">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="bg-white shadow-md">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Map Placeholder */}
            <div
              ref={mapRef}
              className="w-full h-[500px] bg-gradient-to-br from-blue-100 to-green-100 rounded-lg flex items-center justify-center relative overflow-hidden"
            >
              {!mapLoaded ? (
                <div className="text-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading map...</p>
                </div>
              ) : (
                <div className="absolute inset-0">
                  {/* Simulated Map Grid */}
                  <div className="grid grid-cols-8 grid-rows-6 w-full h-full opacity-20">
                    {[...Array(48)].map((_, i) => (
                      <div
                        key={i}
                        className="border border-gray-300 bg-gradient-to-br from-green-200 to-blue-200"
                      ></div>
                    ))}
                  </div>

                  {/* Center Marker */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>

                  {/* Sample Locations */}
                  <div className="absolute top-1/4 right-1/4 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full border border-white"></div>
                  </div>
                  <div className="absolute bottom-1/4 left-1/4 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 bg-green-500 rounded-full border border-white"></div>
                  </div>

                  {/* Overlay Info */}
                  <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md">
                    <div className="text-sm font-medium">Current View</div>
                    <div className="text-xs text-gray-600">Lat: {coordinates.lat.toFixed(6)}</div>
                    <div className="text-xs text-gray-600">Lng: {coordinates.lng.toFixed(6)}</div>
                    <div className="text-xs text-gray-600 mt-1">Zoom: 12 | Tiles: 1,234</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map Info */}
          <div className="mt-4 grid md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-lg">15</div>
              <div className="text-sm text-gray-600">Zoom Level</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-lg">1,234</div>
              <div className="text-sm text-gray-600">Tiles Loaded</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-lg">2.4 MB</div>
              <div className="text-sm text-gray-600">Cache Size</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
