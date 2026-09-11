export type FillItemDescriptionMainResult = {
  ok: boolean;
  description: boolean;
  reason: string;
};

/**
 * Runs in the listing page MAIN world so eBay React sees the same DOM
 * events as a real click. Do not close over module scope — Chrome
 * serializes this function into the page.
 */
export async function fillItemDescriptionInPage(
  html: string,
): Promise<FillItemDescriptionMainResult> {
  const log = (step: string, detail?: unknown): void => {
    if (detail === undefined) {
      console.log(`[SellSimilar][description] ${step}`);
      return;
    }
    console.log(`[SellSimilar][description] ${step}`, detail);
  };

  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const waitUntil = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (predicate()) return true;
      await delay(150);
    }
    return predicate();
  };

  const normalize = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

  const compactText = (value: string): string =>
    normalize(value.replace(/<[^>]+>/g, " ")).replace(/[^a-z0-9]/gi, "").toLowerCase();

  const isShown = (el: HTMLElement): boolean => {
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const wanted = String(html || "").trim();
  if (!wanted) {
    return { ok: false, description: false, reason: "No description" };
  }

  const matches = (current: string): boolean => {
    if (!current) return false;
    const sample = wanted.slice(0, 120);
    if (sample && current.includes(sample)) return true;
    const a = compactText(current);
    const b = compactText(wanted);
    if (a && b && (a === b || a.includes(b.slice(0, 80)) || b.includes(a.slice(0, 80)))) {
      return true;
    }
    const img = wanted.match(/src=["']([^"']+)["']/i)?.[1];
    return Boolean(img && current.includes(img));
  };

  const setNativeValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    const prototype = Object.getPrototypeOf(input) as HTMLInputElement | HTMLTextAreaElement;
    const descriptor =
      Object.getOwnPropertyDescriptor(prototype, "value") ??
      Object.getOwnPropertyDescriptor(
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      );
    descriptor?.set?.call(input, value);
    if (input.value !== value) {
      input.value = value;
    }
    input.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertFromPaste",
        data: value,
      }),
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  };

  const isConditionSection = (el: HTMLElement): boolean =>
    /summary__condition|condition-description/i.test(`${el.className} ${el.getAttribute("inflow") ?? ""}`);

  const descriptionSection = (): HTMLElement | null => {
    const byClass = document.querySelector(".summary__description, .smry.summary__description");
    if (byClass instanceof HTMLElement && !isConditionSection(byClass)) return byClass;

    const byInflow = document.querySelector(
      '[inflow="description"], [inflow*="itemDescription"]',
    );
    if (byInflow instanceof HTMLElement && !isConditionSection(byInflow)) return byInflow;

    for (const heading of document.querySelectorAll("h2, h3, .summary__header-label, .textual-display")) {
      const text = normalize(heading.textContent ?? "");
      if (!/^description$/i.test(text)) continue;
      const section = heading.closest(".smry, .summary__description, section, [class*='summary']");
      if (section instanceof HTMLElement && !isConditionSection(section)) return section;
    }

    for (const node of document.querySelectorAll("label, span, button")) {
      if (!(node instanceof HTMLElement)) continue;
      if (!/show html code/i.test(normalize(node.textContent ?? ""))) continue;
      const section = node.closest(".smry, .summary__description, section, [class*='summary']");
      if (section instanceof HTMLElement && !isConditionSection(section)) return section;
    }
    return null;
  };

  const htmlCheckbox = (section: HTMLElement): HTMLInputElement | HTMLElement | null => {
    for (const node of section.querySelectorAll("input[type='checkbox']")) {
      if (!(node instanceof HTMLInputElement) || !isShown(node)) continue;
      const labelled = [
        node.getAttribute("aria-label") ?? "",
        node.closest("label")?.textContent ?? "",
        node.id ? document.querySelector(`label[for="${node.id}"]`)?.textContent ?? "" : "",
        node.parentElement?.textContent ?? "",
      ].join(" ");
      if (/show html code/i.test(normalize(labelled))) return node;
    }
    for (const node of section.querySelectorAll("label, span, button, [role='checkbox']")) {
      if (!(node instanceof HTMLElement) || !isShown(node)) continue;
      if (!/show html code/i.test(normalize(node.textContent ?? ""))) continue;
      return node;
    }
    return null;
  };

  const htmlTextarea = (section: HTMLElement): HTMLTextAreaElement | null => {
    const named = section.querySelector(
      'textarea[name="description"], textarea[name*="description" i], textarea[aria-label*="HTML" i]',
    );
    if (named instanceof HTMLTextAreaElement && isShown(named)) return named;
    const areas = [...section.querySelectorAll("textarea")].filter(
      (node): node is HTMLTextAreaElement => node instanceof HTMLTextAreaElement && isShown(node),
    );
    return areas.sort((left, right) => right.offsetHeight - left.offsetHeight)[0] ?? null;
  };

  const htmlModeOn = (section: HTMLElement): boolean => {
    const box = htmlCheckbox(section);
    if (box instanceof HTMLInputElement) return box.checked;
    if (box?.getAttribute("aria-checked") === "true") return true;
    if (box?.getAttribute("aria-checked") === "false") return false;
    return false;
  };

  const enableHtmlMode = (section: HTMLElement): void => {
    if (htmlModeOn(section)) return;
    const toggle = htmlCheckbox(section);
    if (!toggle) return;
    toggle.scrollIntoView({ block: "center", inline: "nearest" });
    if (toggle instanceof HTMLInputElement && !toggle.checked) {
      toggle.click();
      return;
    }
    toggle.click();
  };

  const disableHtmlMode = (section: HTMLElement): void => {
    const box = htmlCheckbox(section);
    if (box instanceof HTMLInputElement) {
      if (box.checked) box.click();
      return;
    }
    if (box && (htmlModeOn(section) || htmlTextarea(section))) {
      box.click();
    }
  };

  const editable = (section: HTMLElement): HTMLElement | null => {
    const node = section.querySelector('[contenteditable="true"]');
    if (node instanceof HTMLElement && isShown(node)) return node;
    const frame = section.querySelector("iframe");
    const body = frame instanceof HTMLIFrameElement ? frame.contentDocument?.body : null;
    if (body instanceof HTMLElement && body.isContentEditable) return body;
    return null;
  };

  const applyToEditable = (editor: HTMLElement): boolean => {
    editor.focus();
    try {
      document.execCommand("selectAll", false);
      document.execCommand("insertHTML", false, wanted);
    } catch {
      editor.innerHTML = wanted;
    }
    if (!matches(editor.innerHTML)) {
      editor.innerHTML = wanted;
    }
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    return matches(editor.innerHTML);
  };

  try {
    const section = descriptionSection();
    if (!section) {
      log("section not found");
      return { ok: false, description: false, reason: "Description editor not found" };
    }

    section.scrollIntoView({ block: "center", inline: "nearest" });
    await delay(200);
    editable(section)?.click();
    await delay(150);

    enableHtmlMode(section);
    await waitUntil(() => Boolean(htmlTextarea(section)), 2000);

    const textarea = htmlTextarea(section);
    if (textarea) {
      textarea.focus();
      setNativeValue(textarea, wanted);
      textarea.blur();
      await delay(150);
      const ok = matches(textarea.value);
      log("html textarea", { ok, length: textarea.value.length });
      if (ok) {
        disableHtmlMode(section);
        await waitUntil(() => !htmlModeOn(section) && Boolean(editable(section)), 2000);
        if (htmlModeOn(section)) {
          disableHtmlMode(section);
          await delay(250);
        }
        log("html mode off", { htmlMode: htmlModeOn(section) });
      }
      return { ok, description: ok, reason: ok ? "updated" : "Description did not stick" };
    }

    const editor = editable(section);
    if (editor) {
      const ok = applyToEditable(editor);
      log("contenteditable", { ok, length: editor.innerHTML.length });
      return { ok, description: ok, reason: ok ? "updated" : "Description did not stick" };
    }

    log("no editor control");
    return { ok: false, description: false, reason: "Description field not found" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log("MAIN-world error", reason);
    return { ok: false, description: false, reason };
  }
}
