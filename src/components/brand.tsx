import Link from "next/link";
import { Wrench } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">
        <Wrench size={21} strokeWidth={2.5} />
      </span>
      fix<span>flow</span>
    </Link>
  );
}
