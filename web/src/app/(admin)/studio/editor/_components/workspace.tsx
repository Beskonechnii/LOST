"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import { EditorCanvas } from "@/studio/editor/EditorCanvas";
import { Inspector } from "@/studio/editor/Inspector";
import { LibraryPanel } from "@/studio/editor/LibraryPanel";
import { Toolbar } from "@/studio/editor/Toolbar";
import { LayersPanel } from "@/studio/editor/LayersPanel";
import { fontFaceCss, type FontDef } from "@/studio/editor/fonts";
import type { TeamGroup } from "@/studio/editor/LibraryPanel";
import { makeElement, newId, scaleDoc, type DesignDoc, type Element, type ElementType } from "@/studio/editor/model";

// Воркспейс редактора: всё состояние документа в useState, три панели вокруг холста.
// Экспорт снимает тот же натуральный узел, что рисует превью (modern-screenshot, transform: none) —
// «что вижу — то и скачал», как в studio/wizard.tsx.

export function Workspace({
  id,
  initialTitle,
  initialDoc,
  fonts,
  teams,
}: {
  id: number;
  initialTitle: string;
  initialDoc: DesignDoc;
  fonts: FontDef[];
  teams: TeamGroup[];
}) {
  const [doc, setDoc] = useState<DesignDoc>(initialDoc);
  const [title, setTitle] = useState(initialTitle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(40);
  const [constrain, setConstrain] = useState(true);
  const node = useRef<HTMLDivElement>(null);

  const selected = doc.elements.find((e) => e.id === selectedId) ?? null;

  const patchEl = useCallback(
    (elId: string, patch: Partial<Element>) =>
      setDoc((d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === elId ? ({ ...e, ...patch } as Element) : e)),
      })),
    [],
  );

  const removeEl = useCallback((elId: string) => {
    setDoc((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== elId) }));
    setSelectedId((cur) => (cur === elId ? null : cur));
  }, []);

  const addEl = useCallback((type: ElementType, extra?: Partial<Element>) => {
    // id генерим заранее и выделяем вне updater — setState внутри setDoc-updater не срабатывает
    const id = newId();
    setDoc((d) => ({ ...d, elements: [...d.elements, makeElement(type, d, { ...extra, id } as Partial<Element>)] }));
    setSelectedId(id);
  }, []);

  const order = useCallback(
    (elId: string, dir: "front" | "back" | "up" | "down") =>
      setDoc((d) => {
        const i = d.elements.findIndex((e) => e.id === elId);
        if (i < 0) return d;
        const arr = [...d.elements];
        const [el] = arr.splice(i, 1);
        const j = dir === "front" ? arr.length : dir === "back" ? 0 : dir === "up" ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
        arr.splice(j, 0, el);
        return { ...d, elements: arr };
      }),
    [],
  );

  // Клавиши: стрелки двигают выделенный (×10 с Shift), Delete удаляет, [ ] меняют слой.
  // Не перехватываем, когда фокус в поле ввода — иначе не наберёшь текст в инспекторе.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") patchEl(selectedId, { x: selected!.x - step });
      else if (e.key === "ArrowRight") patchEl(selectedId, { x: selected!.x + step });
      else if (e.key === "ArrowUp") patchEl(selectedId, { y: selected!.y - step });
      else if (e.key === "ArrowDown") patchEl(selectedId, { y: selected!.y + step });
      else if (e.key === "Delete" || e.key === "Backspace") removeEl(selectedId);
      // по коду клавиши, а не символу: на неанглийской раскладке e.key даёт «х»/«ъ», а не [ ]
      else if (e.code === "BracketRight") order(selectedId, "up");
      else if (e.code === "BracketLeft") order(selectedId, "down");
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selected, patchEl, removeEl, order]);

  async function exportPng() {
    if (!node.current) return;
    setBusy(true);
    try {
      const url = await domToPng(node.current, {
        width: doc.w,
        height: doc.h,
        style: { transform: "none" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "design").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setSaved(null);
    const res = await fetch(`/api/studio/designs/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, doc }),
    });
    setSaved(res.ok ? "Сохранено" : "Не удалось сохранить");
  }

  return (
    <div className="space-y-4">
      {/* @font-face для пользовательских шрифтов — виден и превью, и PNG-снимку (modern-screenshot инлайнит) */}
      <style dangerouslySetInnerHTML={{ __html: fontFaceCss(fonts) }} />

      <Toolbar
        title={title}
        onTitle={setTitle}
        w={doc.w}
        h={doc.h}
        background={doc.background}
        onFormat={(w, h) => setDoc((d) => scaleDoc(d, w, h))}
        onBackground={(background) => setDoc((d) => ({ ...d, background }))}
        onExport={() => void exportPng()}
        onSave={() => void save()}
        busy={busy}
        saved={saved}
        showGrid={showGrid}
        gridSize={gridSize}
        onGrid={(show, size) => {
          setShowGrid(show);
          setGridSize(size);
        }}
        constrain={constrain}
        onConstrain={setConstrain}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-hairline bg-surface-1/40 p-3">
            <LibraryPanel
              teams={teams}
              onAdd={(type) => addEl(type)}
              onAddImage={(src, w, h) => {
                // сохраняем пропорции материала: вписываем в ~40% ширины холста
                const target = Math.round(doc.w * 0.4);
                const ratio = w && h ? h / w : 1;
                addEl("image", { src, w: target, h: Math.round(target * ratio) });
              }}
            />
          </div>
          <div className="rounded-lg border border-hairline bg-surface-1/40 p-3">
            <LayersPanel
              elements={doc.elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToggleHidden={(elId, hidden) => patchEl(elId, { hidden })}
              onRemove={removeEl}
              onOrder={order}
              onRename={(elId, name) => patchEl(elId, { name })}
            />
          </div>
        </div>

        <div className="h-[60vh] min-h-[320px] lg:h-[calc(100vh-13rem)]">
          <EditorCanvas
            doc={doc}
            nodeRef={node}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={patchEl}
            showGrid={showGrid}
            gridSize={gridSize}
            constrain={constrain}
          />
        </div>

        <div className="rounded-lg border border-hairline bg-surface-1/40 p-3">
          <Inspector
            el={selected}
            fonts={fonts}
            onChange={(patch) => selectedId && patchEl(selectedId, patch)}
            onRemove={() => selectedId && removeEl(selectedId)}
            onOrder={(dir) => selectedId && order(selectedId, dir)}
          />
        </div>
      </div>
    </div>
  );
}
