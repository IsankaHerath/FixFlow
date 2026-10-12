import { atomic, notify } from "./shared";
import { reminderState } from "../rules";

export async function dispatchReminder(id: string) {
  return atomic(async (tx) => {
    const reminder = await tx.maintenanceReminder.findUnique({
      where: { id },
      include: { vehicle: true },
    });
    if (
      !reminder ||
      reminder.dismissed ||
      reminder.notified ||
      reminderState(
        reminder.dueMileage,
        reminder.vehicle.mileage,
        reminder.dueDate,
      ) === "SCHEDULED"
    )
      return false;
    const claimed = await tx.maintenanceReminder.updateMany({
      where: { id, notified: false, dismissed: false },
      data: { notified: true },
    });
    if (!claimed.count) return false;
    await notify(
      tx,
      reminder.vehicle.ownerId,
      "Maintenance reminder",
      `${reminder.vehicle.registration}: ${reminder.title}`,
      "/dashboard/maintenance",
    );
    return true;
  });
}
