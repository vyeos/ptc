import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getSetting } from "./queries";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem("ptc_auth") === "true"
  );

  useEffect(() => {
    if (isAuthenticated) {
      sessionStorage.setItem("ptc_auth", "true");
    } else {
      sessionStorage.removeItem("ptc_auth");
    }
  }, [isAuthenticated]);

  const login = async (email: string, password: string) => {
    const storedEmail = await getSetting("auth_email");
    const storedPassword = await getSetting("auth_password");
    if (email === storedEmail && password === storedPassword) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
