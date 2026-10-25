/**
 * Reserve native scrollbar gutters and fade thumbs as content starts overflowing.
 * Observe scroll regions and their content, rather than polling each frame.
 */
export function installScrollbarBehavior(): () => void {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:-1000px;width:100px;height:100px;overflow:scroll;scrollbar-gutter:stable;scrollbar-width:thin;visibility:hidden";
  document.body.append(probe);
  const nativeGutter = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  const regions = new Set<HTMLElement>();
  const observed = new Set<Element>();
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resize = new ResizeObserver(schedule);
  function update() {
    frame = 0;
    const current = new Set<HTMLElement>();
    for (const node of document.querySelectorAll<HTMLElement>("*")) {
      const style = getComputedStyle(node);
      if (
        ["auto", "scroll"].includes(style.overflowY) ||
        ["auto", "scroll"].includes(style.overflowX)
      )
        current.add(node);
    }
    const nextObserved = new Set<Element>();
    for (const node of regions) {
      if (!current.has(node)) {
        delete node.dataset.scrollRegion;
        delete node.dataset.scrollOverflow;
      }
    }
    regions.clear();
    for (const node of current) {
      regions.add(node);
      node.dataset.scrollRegion = "";
      nextObserved.add(node);
      for (const child of node.children) nextObserved.add(child);
    }
    for (const node of observed) {
      if (!nextObserved.has(node)) {
        resize.unobserve(node);
        observed.delete(node);
      }
    }
    for (const node of nextObserved) {
      if (!observed.has(node)) {
        resize.observe(node);
        observed.add(node);
      }
    }
    // Read after assigning gutters so measurements include their reserved space.
    for (const node of regions) {
      const style = getComputedStyle(node);
      const gutter = Math.max(0, node.offsetWidth - node.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth));
      node.style.setProperty("--scroll-gutter-width", (gutter || nativeGutter) + "px");
      node.toggleAttribute(
        "data-scroll-overflow",
        node.scrollHeight > node.clientHeight + 1 ||
          node.scrollWidth > node.clientWidth + 1,
      );
    }
  }
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.addEventListener("resize", schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame);
    mutations.disconnect();
    resize.disconnect();
    window.removeEventListener("resize", schedule);
    for (const node of regions) {
      delete node.dataset.scrollRegion;
      delete node.dataset.scrollOverflow;
    }
  };
}
