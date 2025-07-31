"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, LogOut, User, Settings, Activity } from "lucide-react"
import { MBTilesDownloader } from "@/components/mbtiles-downloader"
import { MapViewer } from "@/components/map-viewer"

export default function Dashboard() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const auth = localStorage.getItem("authenticated")
    if (auth === "true") {
      setAuthenticated(true)
    } else {
      router.push("/")
    }
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("authenticated")
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-purple-600 rounded-lg animate-pulse mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Shoonya Innovation</h1>
                  <p className="text-sm text-gray-500">MBTiles Dashboard</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <Activity className="h-3 w-3 mr-1" />
                Online
              </Badge>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <User className="h-4 w-4 mr-2" />
                Profile
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🛰️ Shoonya Innovation MBTiles Exporter</h1>
          <p className="text-xl text-gray-600">Advanced satellite imagery download and processing platform</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <MBTilesDownloader />
          </div>

          <div className="space-y-6">
            <MapViewer />
          </div>
        </div>
      </div>
    </div>
  )
}
