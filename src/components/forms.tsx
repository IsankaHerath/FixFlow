"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
export async function mutate(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method !== "DELETE" ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Request failed.");
  return json.data;
}
export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number | boolean;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  help?: string;
};
export function ActionForm({
  title,
  endpoint,
  fields,
  extra,
  method = "POST",
  trigger = title,
  transform,
}: {
  title: string;
  endpoint: string;
  fields: Field[];
  extra?: Record<string, unknown>;
  method?: string;
  trigger?: string;
  transform?: (data: Record<string, unknown>) => Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={title}>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            const data: Record<string, unknown> = { ...extra };
            for (const f of fields)
              data[f.name] =
                f.type === "number"
                  ? form.get(f.name) === ""
                    ? null
                    : Number(form.get(f.name))
                  : f.type === "checkbox"
                    ? form.get(f.name) === "on"
                    : String(form.get(f.name) ?? "");
            try {
              await mutate(
                endpoint,
                transform ? transform(data) : data,
                method,
              );
              toast.success("Saved successfully");
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            {fields.map((f) => (
              <label
                className={`field ${f.type === "textarea" ? "full" : ""}`}
                key={f.name}
              >
                {f.label}
                {f.options ? (
                  <select
                    aria-label={f.label}
                    name={f.name}
                    defaultValue={String(f.value ?? "")}
                    required={f.required !== false}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    defaultValue={String(f.value ?? "")}
                    required={f.required !== false}
                    maxLength={5000}
                  />
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    name={f.name}
                    defaultChecked={!!f.value}
                  />
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? "text"}
                    defaultValue={String(f.value ?? "")}
                    required={f.required !== false}
                    min={f.min}
                    max={f.max}
                    maxLength={f.type === "password" ? 128 : 2000}
                  />
                )}
                {f.help && <small className="muted">{f.help}</small>}
              </label>
            ))}
          </div>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export function ActionButton({
  endpoint,
  body,
  children,
  method = "POST",
  confirm = false,
}: {
  endpoint: string;
  body?: unknown;
  children: React.ReactNode;
  method?: string;
  confirm?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const run = async () => {
    setBusy(true);
    try {
      await mutate(endpoint, body ?? {}, method);
      toast.success("Updated successfully");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {children}
      </Button>
      {confirm && (
        <Dialog open={open} onOpenChange={setOpen} title="Confirm this change">
          <p>
            This action updates the saved record. Please confirm you want to
            continue.
          </p>
          <div className="inline-actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Keep current record
            </Button>
            <Button disabled={busy} onClick={run}>
              Confirm change
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
