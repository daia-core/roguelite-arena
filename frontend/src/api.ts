// API client for backend communication

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    username: string;
  };
}

interface SaveResponse {
  message: string;
  saveId?: number;
}

interface LoadSaveResponse {
  save: {
    wave: number;
    xp: number;
    level: number;
    gold: number;
    health: number;
    items: string[];
    updated_at: string;
  } | null;
}

interface StatsResponse {
  stats: {
    highest_wave: number;
    total_runs: number;
    total_kills: number;
  };
}

export class API {
  private static getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  private static setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  private static clearToken(): void {
    localStorage.removeItem('auth_token');
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  static async register(email: string, password: string, username: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username })
    });

    this.setToken(response.token);
    return response;
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    this.setToken(response.token);
    return response;
  }

  static logout(): void {
    this.clearToken();
  }

  static isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  static async saveGame(data: {
    wave: number;
    xp: number;
    level: number;
    gold: number;
    health: number;
    items: string[];
  }): Promise<SaveResponse> {
    return this.request<SaveResponse>('/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async loadGame(): Promise<LoadSaveResponse> {
    return this.request<LoadSaveResponse>('/save');
  }

  static async deleteGame(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/save', {
      method: 'DELETE'
    });
  }

  static async getStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('/stats');
  }

  static async updateStats(wave: number, kills: number): Promise<StatsResponse> {
    return this.request<StatsResponse>('/stats', {
      method: 'POST',
      body: JSON.stringify({ wave, kills })
    });
  }
}
