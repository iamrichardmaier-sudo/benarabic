import { DrillMode } from "../engine/types";

interface ModeToggleProps {
  mode: DrillMode;
  onChange: (mode: DrillMode) => void;
}

const MODES: { key: DrillMode; label: string }[] = [
  { key: "study", label: "Study" },
  { key: "flashcard", label: "Flashcard" },
  { key: "multipleChoice", label: "Quiz" },
  { key: "typeIn", label: "Type" },
];

const ModeToggle = ({ mode, onChange }: ModeToggleProps) => {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
            mode === m.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
};

export default ModeToggle;
