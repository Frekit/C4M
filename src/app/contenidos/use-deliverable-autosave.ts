"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { DELIVERABLE_STATUS } from "@/lib/domain/enums";

import { updateDeliverable, type DeliverableActionResult } from "./actions";

export type DeliverableSnapshot = {
  id: string;
  status: string;
  campaignId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  postUrl: string | null;
};

function readForm(form: HTMLFormElement): DeliverableSnapshot {
  const data = new FormData(form);
  return {
    id: String(data.get("deliverableId") ?? ""),
    status: String(data.get("status") ?? ""),
    campaignId: String(data.get("campaignId") ?? "") || null,
    scheduledFor: String(data.get("scheduledFor") ?? "") || null,
    publishedAt: String(data.get("publishedAt") ?? "") || null,
    postUrl: String(data.get("postUrl") ?? "") || null,
  };
}

function isDirty(form: HTMLFormElement, item: DeliverableSnapshot) {
  const current = readForm(form);
  return (
    current.status !== item.status ||
    current.campaignId !== item.campaignId ||
    current.scheduledFor !== (item.scheduledFor || null) ||
    current.publishedAt !== (item.publishedAt || null) ||
    current.postUrl !== (item.postUrl || null)
  );
}

export function useDeliverableAutosave(item: DeliverableSnapshot, canEdit: boolean) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<number>(0);
  const queuedRef = useRef(false);
  const confirmingPublish = useRef(false);
  const pendingRef = useRef(false);
  const [publishOpen, setPublishOpen] = useState(false);
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
    formAction(new FormData(form));
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

    if (name === "postUrl") return;

    if (
      name === "status" &&
      value === DELIVERABLE_STATUS.PUBLISHED &&
      item.status !== DELIVERABLE_STATUS.PUBLISHED
    ) {
      clearTimer();
      setPublishOpen(true);
      return;
    }

    scheduleSave();
  }

  function onUrlBlur() {
    flushSave();
  }

  function confirmPublish() {
    confirmingPublish.current = true;
    clearTimer();
    const form = formRef.current;
    const select = form?.elements.namedItem("status");
    if (select instanceof HTMLSelectElement) {
      select.value = DELIVERABLE_STATUS.PUBLISHED;
    }
    setPublishOpen(false);
    if (pendingRef.current) {
      queuedRef.current = true;
      return;
    }
    if (!form) return;
    formAction(new FormData(form));
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
    publishOpen,
    onFieldChange,
    onUrlBlur,
    confirmPublish,
    cancelPublish,
  };
}
