import { StatusPill, type StatusTone } from "@/components/status-pill";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  SIGNATURE_STATUS,
  SIGNATURE_STATUS_LABELS,
  type ContractStatus,
  type SignatureStatus,
} from "@/lib/domain/enums";

const CONTRACT_TONES: Record<ContractStatus, StatusTone> = {
  [CONTRACT_STATUS.DRAFT]: "neutral",
  [CONTRACT_STATUS.SENT]: "info",
  [CONTRACT_STATUS.SIGNED]: "success",
  [CONTRACT_STATUS.COMPLETED]: "success-muted",
  [CONTRACT_STATUS.RENEWED]: "neutral",
  [CONTRACT_STATUS.CANCELLED]: "destructive",
};

export function ContractStatusBadge({ status }: { status: string }) {
  const key = status as ContractStatus;

  return (
    <StatusPill tone={CONTRACT_TONES[key] ?? "neutral"}>
      {CONTRACT_STATUS_LABELS[key] ?? status}
    </StatusPill>
  );
}

// Pendiente de firma usa warning, como el token de «por caducar». Visto es
// info, firmado es success y revocado es destructive: el audit no fija estos
// cuatro, así que siguen la misma semántica que el contrato.
const SIGNATURE_TONES: Record<SignatureStatus, StatusTone> = {
  [SIGNATURE_STATUS.PENDING]: "warning",
  [SIGNATURE_STATUS.VIEWED]: "info",
  [SIGNATURE_STATUS.SIGNED]: "success",
  [SIGNATURE_STATUS.REVOKED]: "destructive",
};

export function SignatureStatusBadge({ status }: { status: string }) {
  const key = status as SignatureStatus;

  return (
    <StatusPill tone={SIGNATURE_TONES[key] ?? "neutral"}>
      {SIGNATURE_STATUS_LABELS[key] ?? status}
    </StatusPill>
  );
}
