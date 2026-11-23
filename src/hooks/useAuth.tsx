import { createContext, useContext, useState, type ReactNode } from 'react'

const SESSION_KEY = 'scanguard-session'

// This is a UI access gate, not a real authentication system: there is no
// backend user/session model, so the "password" is a shared client-side
// value and the "session" is just a storage flag. It exists to give
// the dashboard the login -> authenticating -> app flow the design calls
// for. Treat it as a lock on the door, not a security boundary — anyone who
// can read the frontend bundle can read the password.
const ACCESS_PASSWORD = import.meta.env.VITE_ACCESS_PASSWORD || 'scanguard'

interface AuthContextValue {
  isAuthenticated: boolean
  login: (password: string) => boolean
  completeAuthentication: (remember: boolean) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function hasStoredSession() {
  return localStorage.getItem(SESSION_KEY) === 'true' || sessionStorage.getItem(SESSION_KEY) === 'true'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(hasStoredSession)

  const login = (password: string) => {
    return password === ACCESS_PASSWORD
  }

  // "Remember me" decides which storage holds the session flag: localStorage
  // survives closing the browser, sessionStorage clears when the tab/browser
  // closes. Both are read on startup so either one keeps the user signed in.
  const completeAuthentication = (remember: boolean) => {
    if (remember) {
      localStorage.setItem(SESSION_KEY, 'true')
    } else {
      sessionStorage.setItem(SESSION_KEY, 'true')
    }
    setIsAuthenticated(true)
  }

  const logout = () => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, completeAuthentication, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
