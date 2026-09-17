"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { DELIVERABLE_STATUS } from "@/lib/domain/enums";

import { updateDeliverable, type DeliverableActionResult } from "./actions";

export type DeliverableSnapshot = {
  id: string;
  status: string;
  campaignId: string | null;
  contentDate: string | null;
  postUrl: string | null;
};

function readForm(form: HTMLFormElement): DeliverableSnapshot {
  const data = new FormData(form);
  return {
    id: String(data.get("deliverableId") ?? ""),
    status: String(data.get("status") ?? ""),
    campaignId: String(data.get("campaignId") ?? "") || null,
    contentDate: String(data.get("contentDate") ?? "") || null,
    postUrl: String(data.get("postUrl") ?? "") || null,
  };
}

function isDirty(form: HTMLFormElement, item: DeliverableSnapshot) {
  const current = readForm(form);
  return (
    current.status !== item.status ||
    current.campaignId !== item.campaignId ||
    current.contentDate !== (item.contentDate || null) ||
    current.postUrl !== (item.postUrl || null)
  );
}

function publishBlockReason(form: HTMLFormElement) {
  const current = readForm(form);

  if (!current.postUrl) {
    return "Para marcarlo como publicado hay que poner antes el enlace del contenido.";
  }

  try {
    const url = new URL(current.postUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "El enlace del contenido no es válido.";
    }
  } catch {
    return "El enlace del contenido no es válido.";
  }

  if (!current.contentDate) {
    return "Para marcarlo como publicado hay que poner antes la fecha.";
  }

  return null;
}

export function useDeliverableAutosave(item: DeliverableSnapshot, canEdit: boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<number>(0);
  const queuedRef = useRef(false);
  const confirmingPublish = useRef(false);
  const pendingRef = useRef(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    DeliverableActionResult | null,
    FormData
  >(updateDeliverable, null);

  pendingRef.current = pending;

  function clearTimer() {
    window.clearTimeout(timerRef.current);
  }

  function submitNow() {
    const form = formRef.current;
    if (!form || !canEdit) return;
    if (!isDirty(form, item)) return;
    const data = new FormData(form);
    startTransition(() => {
      formAction(data);
    });
  }

  function scheduleSave() {
    if (!canEdit) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (pendingRef.current) {
        queuedRef.current = true;
        return;
      }
      submitNow();
    }, 400);
  }

  function flushSave() {
    if (!canEdit) return;
    clearTimer();
    if (pendingRef.current) {
      queuedRef.current = true;
      return;
    }
    submitNow();
  }

  useEffect(() => {
    return () => clearTimer();
  }, []);

  useEffect(() => {
    if (pending || !queuedRef.current) return;
    queuedRef.current = false;
    submitNow();
  }, [pending]);

  useEffect(() => {
    if (!state || state.ok || !confirmingPublish.current) return;
    confirmingPublish.current = false;
    restoreStatus();
  }, [state]);

  function restoreStatus() {
    const select = formRef.current?.elements.namedItem("status");
    if (select instanceof HTMLSelectElement) {
      select.value = item.status;
    }
  }

  function onFieldChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    if (!canEdit) return;
    const { name, value } = event.target;
    setClientError(null);

    if (name === "postUrl") return;

    if (
      name === "status" &&
      value === DELIVERABLE_STATUS.PUBLISHED &&
      item.status !== DELIVERABLE_STATUS.PUBLISHED
    ) {
      clearTimer();
      const form = formRef.current;
      const blocked = form
        ? publishBlockReason(form)
        : "No se puede marcar como publicado.";
      if (blocked) {
        restoreStatus();
        setClientError(blocked);
        return;
      }
      setPublishOpen(true);
      return;
    }

    scheduleSave();
  }

  function onUrlBlur() {
    flushSave();
  }

  function confirmPublish() {
    const form = formRef.current;
    if (!form) return;

    const blocked = publishBlockReason(form);
    if (blocked) {
      restoreStatus();
      setPublishOpen(false);
      setClientError(blocked);
      return;
    }

    confirmingPublish.current = true;
    clearTimer();
    const select = form.elements.namedItem("status");
    if (select instanceof HTMLSelectElement) {
      select.value = DELIVERABLE_STATUS.PUBLISHED;
    }
    setPublishOpen(false);
    if (pendingRef.current) {
      queuedRef.current = true;
      return;
    }
    const data = new FormData(form);
    startTransition(() => {
      formAction(data);
    });
  }

  function cancelPublish() {
    setPublishOpen(false);
    if (confirmingPublish.current) {
      confirmingPublish.current = false;
      return;
    }
    restoreStatus();
  }

  return {
    formRef,
    formAction,
    pending,
    state,
    clientError,
    publishOpen,
    onFieldChange,
    onUrlBlur,
    confirmPublish,
    cancelPublish,
  };
}
