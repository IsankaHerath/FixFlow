"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { WorkspaceData } from "@/server/services/queries";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { mutate } from "./forms";
import { money } from "@/lib/utils";
export function BookingForm({
  data,
  appointmentId,
}: {
  data: WorkspaceData;
  appointmentId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [centerId, setCenterId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [day, setDay] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string; label: string }[]>([]);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [key, setKey] = useState("");
  const router = useRouter();
  const previous = data.appointments.find(a=>a.id===appointmentId);
  const workshopReschedule = !!previous && previous.customerId !== data.user.id;
  const center = data.centers.find((c) => c.id === centerId);
  const service = center?.services.find((s) => s.id === serviceId);
  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setKey(crypto.randomUUID());
          setOpen(true);
        }}
      >
        {appointmentId ? "Reschedule" : "+ Book a service"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={
          appointmentId
            ? "Reschedule your service"
            : "Let’s book your next service"
        }
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              await mutate(
                `/api/appointments${appointmentId ? `/${appointmentId}` : ""}`,
                {
                  vehicleId: String(form.get("vehicleId")),
                  centerId,
                  serviceId,
                  startsAt: slot,
                  description: String(form.get("description")),
                  requestKey: key,
                },
              );
              toast.success(
                "Appointment requested. Your center will confirm it.",
              );
              setOpen(false);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Booking failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Your vehicle
            <select aria-label="Your vehicle" name="vehicleId" required defaultValue={previous?.vehicleId ?? ""}>
              <option value="" disabled>
                Select a vehicle
              </option>
              {(workshopReschedule && previous ? [previous.vehicle] : data.vehicles)
                .filter((v) => !v.archived && (workshopReschedule || v.ownerId === data.user.id))
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registration} — {v.make} {v.model}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            Service center
            <select
              aria-label="Service center"
              required
              value={centerId}
              onChange={(e) => {
                setCenterId(e.target.value);
                setServiceId("");
                setSlots([]);
                setSlot("");
                setLoaded(false);
              }}
            >
              <option value="">Choose a center</option>
              {data.centers.filter(c=>!workshopReschedule || c.id===previous?.centerId).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.district}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Service
            <select
              aria-label="Service"
              required
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setSlot("");
                setLoaded(false);
              }}
            >
              <option value="">Choose a service</option>
              {center?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — from {money(s.startingPrice)}
                </option>
              ))}
            </select>
          </label>
          {service && (
            <small className="muted">
              Allow {service.duration} minutes. Starting prices are indicative;
              you approve the final estimate.
            </small>
          )}
          <label className="field">
            Preferred date
            <input
              type="date"
              required
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setSlot("");
                setLoaded(false);
              }}
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!centerId || !serviceId || !day || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch(
                  `/api/appointments/availability?centerId=${centerId}&serviceId=${serviceId}&date=${day}`,
                );
                const json = await response.json();
                if (!response.ok) throw new Error(json.error);
                setSlots(json.data);
                setLoaded(true);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not load slots.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Check available times
          </Button>
          {loaded && (
            <div>
              <p className="code-note">
                Times shown in {center?.timezone}. Availability is checked again
                when you submit.
              </p>
              <div className="slot-grid">
                {slots.map((s) => (
                  <button
                    type="button"
                    className={`slot ${slot === s.startsAt ? "selected" : ""}`}
                    key={s.startsAt}
                    onClick={() => setSlot(s.startsAt)}
                    aria-pressed={slot === s.startsAt}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {!slots.length && (
                <p className="notice">
                  No available slots on this date. Please try another day.
                </p>
              )}
            </div>
          )}
          <label className="field">
            What does your vehicle need?
            <textarea
              name="description"
              minLength={5}
              maxLength={2000}
              required
              placeholder="Tell the workshop about your service needs or symptoms…"
            />
          </label>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <Button disabled={!slot || busy} type="submit">
            {busy ? "Please wait…" : "Request appointment"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
