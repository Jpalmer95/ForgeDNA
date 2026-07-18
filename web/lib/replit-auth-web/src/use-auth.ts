import { useState } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: () => {},
    logout: () => {},
  };
}
