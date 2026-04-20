"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, MapPin, Clock, UserCheck } from "lucide-react"

export function ActiveLocationsCard() {
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchLocations = async (lat?: number, lng?: number) => {
      try {
        setLoading(true)
        const query = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ""
        const res = await fetch(`/api/locations/active${query}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load')
        if (mounted) setLocations(json.locations || [])
      } catch (err: any) {
        console.error('ActiveLocationsCard error', err)
        if (mounted) setError(err.message || 'Error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const tryWithGeolocation = async () => {
      // Try to get browser geolocation (short timeout), then call API with coords
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const getPos = () =>
          new Promise<GeolocationPosition>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Geolocation timeout')), 5000)
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timer)
                resolve(pos)
              },
              (err) => {
                clearTimeout(timer)
                reject(err)
              },
              { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 },
            )
          })

        try {
          const pos = await getPos()
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude
          await fetchLocations(lat, lng)
          return
        } catch (e) {
          // Geolocation failed or denied; fall back to server-side assigned location
          console.warn('ActiveLocationsCard: geolocation unavailable, falling back', e)
        }
      }

      // Fallback: call API without coords (server will try assigned_location)
      await fetchLocations()
    }

    tryWithGeolocation()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base sm:text-lg">Active Locations</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Live check-in/out stats</CardDescription>
          </div>
          <MapPin className="h-4 sm:h-5 w-4 sm:w-5 text-primary flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading locations…</span>
          </div>
        ) : error ? (
          <div className="text-sm text-muted-foreground">Error: {error}</div>
        ) : locations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No active locations</div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {locations.map((loc) => (
              <div key={loc.id} className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-3 p-2 sm:p-3 rounded-md hover:bg-muted/5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm sm:text-base truncate">{loc.name}</span>
                    {loc.location_code && <Badge className="text-xs">{loc.location_code}</Badge>}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                    {loc.address || "No address"}
                  </div>
                </div>

                <div className="text-right text-xs sm:text-sm w-full sm:w-auto">
                  <div className="flex items-center gap-2 sm:gap-3 justify-start sm:justify-end">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{loc.today?.currently_checked_in ?? 0}</span>
                      <span className="text-muted-foreground text-xs">In</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{loc.today?.check_in_count ?? 0}</span>
                      <span className="text-muted-foreground text-xs">Ins</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{loc.today?.check_out_count ?? 0}</span>
                      <span className="text-muted-foreground text-xs">Outs</span>
                    </div>
                  </div>
                  <div className="mt-1 text-muted-foreground text-xs space-y-0.5">
                    {loc.today?.last_check_in_time && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">In: {new Date(loc.today.last_check_in_time).toLocaleTimeString()}</span>
                      </div>
                    )}
                    {loc.today?.last_check_out_time && (
                      <div className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Out: {new Date(loc.today.last_check_out_time).toLocaleTimeString()}</span>
                      </div>
                    )}
                    {loc.distance_meters != null && (
                      <div className="text-xs">Dist: {loc.distance_meters}m</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ActiveLocationsCard
