export type WellnessTopic = "Bienestar" | "Salud" | "Nutrición";

export type WellnessTip = {
  topic: WellnessTopic;
  title: string;
  body: string;
};

const tips: WellnessTip[] = [
  {
    topic: "Bienestar",
    title: "Diez minutos al aire",
    body: "Camina después de comer. Baja el estrés del día y no compite con tu entrenamiento.",
  },
  {
    topic: "Bienestar",
    title: "Estira al terminar",
    body: "Dos minutos de cadera, pecho y pantorrilla al cerrar la sesión. No esperes a que ya duela.",
  },
  {
    topic: "Bienestar",
    title: "El locker primero",
    body: "Deja el teléfono los primeros veinte minutos. El entreno rinde más sin interrupciones.",
  },
  {
    topic: "Salud",
    title: "El músculo se repara de noche",
    body: "Apunta a siete horas de sueño. Una sesión fuerte con poca noche no se recupera en la máquina.",
  },
  {
    topic: "Salud",
    title: "Pinchazo no es fatiga",
    body: "La quemazón muscular puede seguir. Un pinchazo en articulación es para parar y bajar la carga.",
  },
  {
    topic: "Salud",
    title: "Avisa a las articulaciones",
    body: "Cinco minutos de movilidad antes de cargar peso. Rodillas, hombros y cadera entran mejor calientes.",
  },
  {
    topic: "Nutrición",
    title: "Proteína antes de entrenar",
    body: "Huevo, yogur o frijoles. Sostienen la energía mejor que llegar solo con azúcar.",
  },
  {
    topic: "Nutrición",
    title: "Agua en la puerta",
    body: "Un vaso al llegar y otro al salir. No dejes toda la hidratación para la clase.",
  },
  {
    topic: "Nutrición",
    title: "El plato en tres partes",
    body: "Mitad verdura, un cuarto de proteína y un cuarto de carbohidrato. Sirve en el almuerzo de hoy.",
  },
];

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

export function tipsForToday(date = new Date()): WellnessTip[] {
  const day = dayOfYear(date);
  const topics: WellnessTopic[] = ["Bienestar", "Salud", "Nutrición"];
  return topics.map((topic) => {
    const group = tips.filter((tip) => tip.topic === topic);
    return group[day % group.length];
  });
}
