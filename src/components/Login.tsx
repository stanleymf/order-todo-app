import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "../contexts/AuthContext"
import { register } from "../services/api"

export function Login() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [tenantDomain, setTenantDomain] = useState("")
  const [tenantName, setTenantName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/orders")
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isRegistering) {
        // Registration
        const result = await register({
          email,
          password,
          name,
          tenantDomain,
          tenantName,
        })

        if (result.success) {
          // Auto-login after successful registration
          const loginResult = await login({
            email,
            password,
            tenantDomain,
          })

          if (loginResult.success) {
            navigate("/orders")
          } else {
            setError("Registration successful but login failed. Please try logging in.")
          }
        } else {
          setError(result.error || "Registration failed")
        }
      } else {
        // Login
        const result = await login({
          email,
          password,
          tenantDomain: tenantDomain || undefined,
        })

        if (result.success) {
          navigate("/orders")
        } else {
          setError("Login failed. Please check your credentials.")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const clearError = () => {
    setError(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-green-700">Florist Dashboard</CardTitle>
          <CardDescription>
            {isRegistering ? "Create your account" : "Sign in to manage your daily orders"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required={isRegistering}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="tenantDomain">Tenant Domain {!isRegistering && "(Optional)"}</Label>
              <Input
                id="tenantDomain"
                type="text"
                value={tenantDomain}
                onChange={(e) => setTenantDomain(e.target.value)}
                placeholder="e.g., my-florist"
                required={isRegistering}
              />
            </div>
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="tenantName">Business Name (Optional)</Label>
                <Input
                  id="tenantName"
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g., My Florist Shop"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading
                ? isRegistering
                  ? "Creating Account..."
                  : "Signing in..."
                : isRegistering
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => {
                setIsRegistering(!isRegistering)
                clearError()
                setEmail("")
                setPassword("")
                setName("")
                setTenantDomain("")
                setTenantName("")
              }}
              className="text-sm"
            >
              {isRegistering
                ? "Already have an account? Sign in"
                : "Don't have an account? Register"}
            </Button>
          </div>

          {!isRegistering && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">Demo Credentials:</p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>
                  <strong>Tenant:</strong> test-florist
                </p>
                <p>
                  <strong>Admin:</strong> admin@test-florist.com
                </p>
                <p>
                  <strong>Password:</strong> password
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
