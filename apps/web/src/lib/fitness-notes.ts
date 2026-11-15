export type FitnessNotes = {
  weightKg?: string;
  heightCm?: string;
  injuries?: string;
  illnesses?: string;
  otherNotes?: string;
};

const labels = [
  ["Peso:", "weightKg"],
  ["Tamaño:", "heightCm"],
  ["Lesiones:", "injuries"],
  ["Enfermedades:", "illnesses"],
  ["Otras notas:", "otherNotes"],
] as const;

export function fitnessNotesText(notes: FitnessNotes) {
  const lines = [
    notes.weightKg ? `Peso: ${notes.weightKg} kg` : "",
    notes.heightCm ? `Tamaño: ${notes.heightCm} cm` : "",
    notes.injuries ? `Lesiones: ${notes.injuries}` : "",
    notes.illnesses ? `Enfermedades: ${notes.illnesses}` : "",
    notes.otherNotes ? `Otras notas: ${notes.otherNotes}` : "",
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

export function readFitnessNotes(value: string | null | undefined): FitnessNotes {
  const notes: FitnessNotes = {};
  if (!value) return notes;
  const extra: string[] = [];
  for (const line of value.split("\n")) {
    const match = labels.find(([label]) => line.startsWith(label));
    if (!match) {
      if (line.trim()) extra.push(line);
      continue;
    }
    notes[match[1]] = line.slice(match[0].length).trim().replace(/ (kg|cm)$/, "");
  }
  if (extra.length > 0) notes.otherNotes = [notes.otherNotes, extra.join("\n")].filter(Boolean).join("\n");
  return notes;
}
