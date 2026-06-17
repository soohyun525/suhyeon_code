import type { SajuChart, Pillar } from './calculator';

// A lean, UI-ready view of a chart (no internal types leaked to the client).
export function serializeChart(chart: SajuChart) {
  const pillar = (p: Pillar | null) =>
    p
      ? {
          stem: { han: p.stem.han, rom: p.stem.rom, element: p.stem.element, yin: p.stem.yin },
          branch: {
            han: p.branch.han,
            rom: p.branch.rom,
            element: p.branch.element,
            animal: p.branch.animal,
          },
          tenGod: p.tenGod,
          branchTenGod: p.branchTenGod,
          hidden: p.hidden,
          stage: p.stage,
        }
      : null;
  return {
    sajuYear: chart.sajuYear,
    zodiacAnimal: chart.zodiacAnimal,
    hasHour: chart.hasHour,
    dayMaster: {
      han: chart.dayMaster.han,
      rom: chart.dayMaster.rom,
      element: chart.dayMaster.element,
      yin: chart.dayMaster.yin,
    },
    elementCounts: chart.elementCounts,
    dominantElement: chart.dominantElement,
    lackingElements: chart.lackingElements,
    pillars: {
      year: pillar(chart.pillars.year),
      month: pillar(chart.pillars.month),
      day: pillar(chart.pillars.day),
      hour: pillar(chart.pillars.hour),
    },
    daeun: chart.daeun,
    saeun: chart.saeun,
    currentSaeun: chart.currentSaeun,
    sinsal: chart.sinsal,
  };
}
