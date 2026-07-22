// Реестр шаблонов — единственная точка, куда добавляется новый шаблон.
import type { TemplateDef } from "./types";
import { vsAnnounce } from "./templates/vs-announce";
import { matchDay } from "./templates/match-day";

export const TEMPLATES: TemplateDef[] = [vsAnnounce, matchDay];

export const getTemplate = (id: string): TemplateDef | undefined => TEMPLATES.find((t) => t.id === id);
