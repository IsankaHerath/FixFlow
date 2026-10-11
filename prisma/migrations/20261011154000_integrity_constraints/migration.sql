-- Defense-in-depth constraints supplement validation in the service layer.
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_mileage_nonnegative" CHECK (mileage >= 0);
ALTER TABLE "ServiceCenter" ADD CONSTRAINT "ServiceCenter_capacity_positive" CHECK (capacity > 0), ADD CONSTRAINT "ServiceCenter_hours_valid" CHECK ("openHour" >= 0 AND "closeHour" <= 24 AND "closeHour" > "openHour");
ALTER TABLE "Service" ADD CONSTRAINT "Service_duration_valid" CHECK (duration >= 30 AND duration <= 480 AND duration % 30 = 0), ADD CONSTRAINT "Service_price_nonnegative" CHECK ("startingPrice" >= 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_interval_valid" CHECK ("endsAt" > "startsAt");
ALTER TABLE "InventoryPart" ADD CONSTRAINT "InventoryPart_nonnegative" CHECK (quantity >= 0 AND cost >= 0 AND price >= 0 AND "reorderLevel" >= 0);
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_totals_valid" CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND tax >= 0 AND total = subtotal - discount + tax AND "taxBps" BETWEEN 0 AND 10000);
ALTER TABLE "EstimateItem" ADD CONSTRAINT "EstimateItem_positive_quantity" CHECK (quantity > 0 AND "unitPrice" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_nonnegative_total" CHECK (total >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK (amount > 0);
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_positive_quantity" CHECK (quantity > 0);
ALTER TABLE "LaborEntry" ADD CONSTRAINT "LaborEntry_positive_minutes" CHECK (minutes > 0);
