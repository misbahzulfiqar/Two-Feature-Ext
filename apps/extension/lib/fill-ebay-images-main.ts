export type ListingPhotoPayload = {
  name: string;
  type: string;
  base64: string;
};

export type ApplyListingPhotosResult = {
  added: number;
};

/**
 * Puts listing photos into eBay's editor from the page's own JavaScript world.
 * Do not close over module scope — Chrome serializes this function into the page.
 */
export async function applyListingPhotosInPage(
  payloads: ListingPhotoPayload[],
): Promise<ApplyListingPhotosResult> {
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const clean = (value: string): string => value.replace(/\s+/g, " ").trim();

  const fileFromPayload = (payload: ListingPhotoPayload): File => {
    const binary = atob(payload.base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], payload.name, { type: payload.type || "image/jpeg" });
  };

  const collect = (root: ParentNode): Element[] => {
    const found: Element[] = [];
    const visit = (node: ParentNode): void => {
      const children = node.querySelectorAll("*");
      for (const child of children) {
        found.push(child);
        if (child.shadowRoot) {
          visit(child.shadowRoot);
        }
      }
    };
    visit(root);
    return found;
  };

  const ownText = (element: Element): string => {
    const chunks: string[] = [];
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        chunks.push(node.textContent ?? "");
      }
    }
    const direct = clean(chunks.join(" "));
    if (direct) {
      return direct;
    }
    return clean(element.textContent ?? "");
  };

  const elements = collect(document);

  const photoCounter = (): number | undefined => {
    for (const element of collect(document)) {
      const text = ownText(element);
      const match = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
      if (!match) {
        continue;
      }
      const max = Number(match[2]);
      if (max >= 12 && max <= 40) {
        return Number(match[1]);
      }
    }
    return undefined;
  };

  const thumbnailCount = (section: ParentNode): number =>
    [...section.querySelectorAll("img")].filter((image) => {
      const src = image.getAttribute("src") ?? "";
      return src.startsWith("blob:") || src.startsWith("data:image") || /ebayimg|uploaded/i.test(src);
    }).length;

  const dropLabel = elements.find((element) => /^drag and drop files$/i.test(ownText(element)));
  const uploadButton = elements.find((element) =>
    /^upload from computer$/i.test(ownText(element)),
  );
  const anchor = dropLabel ?? uploadButton;

  const sectionFrom = (start: Element | undefined): ParentNode => {
    let node: Element | null = start ?? null;
    for (let depth = 0; node && depth < 10; depth += 1) {
      if (node.querySelector("input[type='file']")) {
        return node;
      }
      const parent: Element | null = node.parentElement;
      const rootNode = node.getRootNode();
      const host = rootNode instanceof ShadowRoot ? rootNode.host : null;
      node = parent ?? host;
    }
    return document.body;
  };

  const section = sectionFrom(anchor);
  const before = photoCounter() ?? thumbnailCount(section);

  const inputs = [
    ...section.querySelectorAll("input[type='file']"),
    ...collect(document).filter(
      (element): element is HTMLInputElement =>
        element instanceof HTMLInputElement && element.type === "file",
    ),
  ].filter((input, index, all): input is HTMLInputElement => {
    if (!(input instanceof HTMLInputElement) || input.disabled) {
      return false;
    }
    const accept = input.accept.toLowerCase();
    if (accept && !accept.includes("image") && !accept.includes("jpg") && !accept.includes("png")) {
      return false;
    }
    return all.indexOf(input) === index;
  });

  if (inputs.length === 0 && !anchor) {
    return { added: 0 };
  }

  const files = payloads.map(fileFromPayload).filter((file) => file.size >= 32);
  if (files.length === 0) {
    return { added: 0 };
  }

  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }

  const assignFiles = (input: HTMLInputElement): void => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    descriptor?.set?.call(input, transfer.files);
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  };

  const reactCall = (element: Element, names: string[], event: Event): void => {
    const propsKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
    const props = propsKey ? (element as unknown as Record<string, Record<string, unknown>>)[propsKey] : undefined;
    if (props) {
      for (const name of names) {
        const handler = props[name];
        if (typeof handler === "function") {
          handler(event);
        }
      }
    }
    const fiberKey = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey
      ? (element as unknown as Record<string, { return?: unknown; memoizedProps?: Record<string, unknown> }>)[fiberKey]
      : undefined;
    for (let depth = 0; fiber && depth < 8; depth += 1) {
      const memo = fiber.memoizedProps;
      if (memo) {
        for (const name of names) {
          const handler = memo[name];
          if (typeof handler === "function") {
            handler(event);
          }
        }
      }
      fiber = fiber.return as typeof fiber;
    }
  };

  const readCount = (): number => photoCounter() ?? thumbnailCount(section);

  const waitForIncrease = async (): Promise<number> => {
    const started = Date.now();
    let latest = before;
    while (Date.now() - started < 4000) {
      await delay(400);
      latest = readCount();
      if (latest > before) {
        return latest;
      }
    }
    return latest;
  };

  const targetInput = inputs[0];
  if (targetInput) {
    assignFiles(targetInput);
    const change = new Event("change", { bubbles: true, composed: true });
    Object.defineProperty(change, "target", { value: targetInput });
    reactCall(targetInput, ["onInput", "onChange"], change);
  }

  let after = targetInput ? await waitForIncrease() : before;
  const zone =
    (anchor instanceof HTMLElement ? anchor : undefined) ??
    (section instanceof HTMLElement ? section : undefined);
  if (after <= before && zone) {
    for (const type of ["dragenter", "dragover", "drop"] as const) {
      const event = new DragEvent(type, { bubbles: true, cancelable: true, composed: true });
      Object.defineProperty(event, "dataTransfer", { value: transfer });
      zone.dispatchEvent(event);
      const handler =
        type === "dragenter" ? "onDragEnter" : type === "dragover" ? "onDragOver" : "onDrop";
      reactCall(zone, [handler], event);
    }
    after = await waitForIncrease();
  }

  return { added: Math.max(0, after - before) };
}
