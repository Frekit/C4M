export type AuthProvider = "auth0" | "local";

export type AuthMode = "auth0" | "local";

export type AppUser = {
  sub: string;
  name: string;
  email: string;
  picture?: string | null;
  nickname?: string | null;
  provider: AuthProvider;
};
