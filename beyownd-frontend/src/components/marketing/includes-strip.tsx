import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Calendar03Icon,
  Certificate01Icon,
  CheckListIcon,
  MentoringIcon,
  QrCode01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";

/*
 * Where monday.com shows a logo wall, we show what every internship includes.
 * We have no partner logos to show yet, and inventing them would break trust.
 */
const items: { label: string; icon: IconSvgElement }[] = [
  { label: "Real batch dates", icon: Calendar03Icon },
  { label: "Quiz per module", icon: CheckListIcon },
  { label: "Mentor-reviewed project", icon: MentoringIcon },
  { label: "Offer + completion letters", icon: Certificate01Icon },
  { label: "QR verification", icon: QrCode01Icon },
  { label: "Learn on your phone", icon: SmartPhone01Icon },
];

export function IncludesStrip() {
  return (
    <section aria-label="What every internship includes" className="border-y border-line py-10">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[15px] text-ink-soft">Every Beyownd internship includes</p>
        <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((it) => (
            <li key={it.label} className="group flex items-center justify-center gap-2.5 text-[14.5px] text-ink">
              <HugeiconsIcon
                icon={it.icon}
                size={22}
                strokeWidth={1.5}
                aria-hidden
                className="shrink-0 text-ink-soft transition-[color,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:text-brand"
              />
              <span className="text-center lg:text-left">{it.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
