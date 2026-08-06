// Реестр шаблонов — единственная точка, куда добавляется новый шаблон.
import type { TemplateDef } from "./types";
import { vsAnnounce } from "./templates/vs-announce";
import { matchDay } from "./templates/match-day";
import { postgameBoard } from "./templates/postgame-board";

export const TEMPLATES: TemplateDef[] = [vsAnnounce, matchDay, postgameBoard];

export const getTemplate = (id: string): TemplateDef | undefined => TEMPLATES.find((t) => t.id === id);
