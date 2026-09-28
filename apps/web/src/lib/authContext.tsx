'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getNonce, verifySignature, getAuthToken, clearAuthToken } from './api';

import { isAdminWallet } from '@mercadopleis/types';
import { isUserRejection } from './web3Errors';

interface AuthUser {
  id: string;
  walletAddress: string;
  username: string;
  displayName: string;
  role: string;
  bio?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: () => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isAdmin: false,
  isLoading: false,
  signIn: async () => false,
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchUserProfile = async (authToken: string, currentAddress?: string | null) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (
          !currentAddress ||
          data.user?.walletAddress?.toLowerCase() === currentAddress.toLowerCase()
        ) {
          setUser(data.user);
          setToken(authToken);
          return;
        }
      }
      clearAuthToken(currentAddress);
      setToken(null);
      setUser(null);
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
      setToken(null);
      setUser(null);
    }
  };

  // Sync session on mount and whenever active wallet address or connection state changes
  useEffect(() => {
    if (!isConnected || !address) {
      setToken(null);
      setUser(null);
      return;
    }

    const savedToken = getAuthToken(address);
    if (savedToken) {
      fetchUserProfile(savedToken, address);
    } else {
      setToken(null);
      setUser(null);
    }
  }, [address, isConnected]);

  const signIn = async (): Promise<boolean> => {
    if (!address || !isConnected) return false;

    try {
      setIsLoading(true);
      // 1. Get challenge nonce from backend
      const nonce = await getNonce(address);

      // 2. Prepare EIP-4361 SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const statement = 'Iniciar sesión en mercadopleis con tu wallet criptográfica.';
      const issuedAt = new Date().toISOString();

      const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n${statement}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chainId || 84532}\nNonce: ${nonce}\nIssued At: ${issuedAt}`;

      // 3. Request wallet cryptographic signature
      const signature = await signMessageAsync({ message });

      // 4. Verify signature on backend
      const result = await verifySignature(address, signature, message);
      if (result.token && result.user) {
        setToken(result.token);
        setUser(result.user);
        return true;
      }
      return false;
    } catch (error: any) {
      if (isUserRejection(error)) {
        console.info('[SIWE] Firma cancelada por el usuario en su wallet.');
      } else {
        console.error('SIWE login error:', error);
      }
      return false;
    } finally {

      setIsLoading(false);
    }
  };

  const signOut = () => {
    clearAuthToken(address);
    setToken(null);
    setUser(null);
  };

  const isAdmin = (user?.role === 'ADMIN') || (!!address && isAdminWallet(address));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isAdmin,
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
