const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

interface ApiResponse<T> {
  status: string;
  data?: T;
  message?: string;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token");
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "An error occurred");
    }

    return data.data as T;
  }

  // Auth
  async register(email: string, password: string) {
    return this.request<{ user: any; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ user: any; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe() {
    return this.request<{ user: any }>("/auth/me");
  }

  // OAuth Credentials
  async createOAuthCredential(data: {
    credentialName: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    return this.request<{ credential: any }>("/oauth/credentials", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getOAuthCredentials() {
    return this.request<{ credentials: any[] }>("/oauth/credentials");
  }

  async deleteOAuthCredential(id: string) {
    return this.request<void>(`/oauth/credentials/${id}`, {
      method: "DELETE",
    });
  }

  async getOAuthAuthUrl(credentialId: string) {
    return this.request<{ authUrl: string }>(
      `/oauth/credentials/${credentialId}/auth-url`
    );
  }

  async handleOAuthCallback(code: string, credentialId: string) {
    return this.request<{ account: any }>("/oauth/callback", {
      method: "POST",
      body: JSON.stringify({ code, credentialId }),
    });
  }

  async getGmailAccounts() {
    return this.request<{ accounts: any[] }>("/oauth/accounts");
  }

  // Gmail
  async syncGmailAccount(accountId: string) {
    return this.request<{ message: string }>(`/gmail/accounts/${accountId}/sync`, {
      method: "POST",
    });
  }

  // Subscriptions
  async getSubscriptions() {
    return this.request<{ subscriptions: any[] }>("/subscriptions");
  }

  async getSubscriptionStats() {
    return this.request<{ stats: any }>("/subscriptions/stats");
  }

  async createSubscription(data: any) {
    return this.request<{ subscription: any }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSubscription(id: string, data: any) {
    return this.request<{ subscription: any }>(`/subscriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteSubscription(id: string) {
    return this.request<void>(`/subscriptions/${id}`, {
      method: "DELETE",
    });
  }

  async getCategories() {
    return this.request<{ categories: any[] }>("/subscriptions/categories");
  }

  async createCategory(name: string, color: string, icon: string) {
    return this.request<{ category: any }>("/subscriptions/categories", {
      method: "POST",
      body: JSON.stringify({ name, color, icon }),
    });
  }
}

export const api = new ApiService();
export default api;
