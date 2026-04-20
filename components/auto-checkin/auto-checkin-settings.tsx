'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, MapPin, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AutoCheckinSettings {
  auto_checkin_enabled: boolean
  auto_login_enabled: boolean
}

export function AutoCheckinSettings() {
  const [settings, setSettings] = useState<AutoCheckinSettings>({
    auto_checkin_enabled: true,
    auto_login_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/user/auto-checkin-settings')
        if (response.ok) {
          const data = await response.json()
          setSettings({
            auto_checkin_enabled: data.auto_checkin_enabled ?? true,
            auto_login_enabled: data.auto_login_enabled ?? true,
          })
        } else {
          console.error('[v0] Failed to fetch auto-checkin settings:', response.statusText)
        }
      } catch (err) {
        console.error('[v0] Error fetching settings:', err)
        setError('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleToggleAutoCheckin = useCallback(async (enabled: boolean) => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/user/auto-checkin-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auto_checkin_enabled: enabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update setting')
      }

      setSettings((prev) => ({
        ...prev,
        auto_checkin_enabled: enabled,
      }))
      setSuccess(enabled ? 'Auto-checkin enabled' : 'Auto-checkin disabled')
      setLastSaved(new Date())
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update setting'
      console.error('[v0] Error updating auto-checkin:', message)
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [])

  const handleToggleAutoLogin = useCallback(async (enabled: boolean) => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/user/auto-checkin-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auto_login_enabled: enabled,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update setting')
      }

      setSettings((prev) => ({
        ...prev,
        auto_login_enabled: enabled,
      }))
      setSuccess(enabled ? 'Auto-login enabled' : 'Auto-login disabled')
      setLastSaved(new Date())
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update setting'
      console.error('[v0] Error updating auto-login:', message)
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Geofence Settings
          </CardTitle>
          <CardDescription className="text-sm">
            Control automatic login and check-in when you enter registered locations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading settings...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Auto-Checkin Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-muted">
                <div className="flex-1 space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Auto-Check-in
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically check in when you enter a registered location. No manual check-in needed.
                  </p>
                  {settings.auto_checkin_enabled && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Active - You will be automatically checked in</span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={settings.auto_checkin_enabled}
                  onCheckedChange={handleToggleAutoCheckin}
                  disabled={saving || loading}
                  className="mt-1"
                />
              </div>

              {/* Auto-Login Toggle */}
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-muted">
                <div className="flex-1 space-y-2">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Auto-Login
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log in when you enter a registered location. Keep your session active throughout the day.
                  </p>
                  {settings.auto_login_enabled && (
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Active - You will be automatically logged in</span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={settings.auto_login_enabled}
                  onCheckedChange={handleToggleAutoLogin}
                  disabled={saving || loading}
                  className="mt-1"
                />
              </div>

              {/* Info Box */}
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>Privacy Notice:</strong> Auto-check-in and auto-login use your device&apos;s location data. Location data is only used when you&apos;re within a registered location radius and is never stored or shared.
                </AlertDescription>
              </Alert>

              {lastSaved && (
                <p className="text-xs text-muted-foreground text-right">
                  Last saved {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* How It Works Section */}
      <Card className="border-0 shadow-sm bg-muted/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <div>
              <p className="text-sm font-medium">Enable Geofence Monitoring</p>
              <p className="text-xs text-muted-foreground">
                Your device continuously monitors your location (every 5 seconds)
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <div>
              <p className="text-sm font-medium">Enter Location Boundary</p>
              <p className="text-xs text-muted-foreground">
                When you enter a registered location radius, the system detects this
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <div>
              <p className="text-sm font-medium">Automatic Actions</p>
              <p className="text-xs text-muted-foreground">
                System automatically logs you in and checks you in (if enabled)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
