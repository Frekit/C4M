import type { Role } from "@/lib/domain/enums";

export type AuthProvider = "auth0" | "local";

export type AuthMode = "auth0" | "local";

// Quién dice ser el visitante, según Auth0 o la cookie local.
export type SessionIdentity = {
  sub: string;
  email: string;
  name: string;
  picture?: string | null;
  provider: AuthProvider;
};

// Quién es en la aplicación: existe en la tabla User porque fue invitado.
export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  provider: AuthProvider;
  picture?: string | null;
};

export type AccessState =
  | { kind: "anonymous" }
  | { kind: "not_invited"; identity: SessionIdentity }
  | { kind: "disabled"; identity: SessionIdentity }
  | { kind: "active"; user: AppUser };
