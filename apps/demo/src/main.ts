/**
 * Demo entrypoint. Wires the "Run Demo" button to the scenario runner
 * and renders each step into the timeline with a fade-in animation.
 */

import { runScenario, type Step } from "./scenario";

const runBtn = document.getElementById("runBtn") as HTMLButtonElement;
const timeline = document.getElementById("timeline") as HTMLDivElement;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function renderStep(step: Step): HTMLElement {
  const el = document.createElement("div");
  el.className = "step";

  const h3 = document.createElement("h3");
  h3.textContent = step.title;
  el.appendChild(h3);

  const detail = document.createElement("div");
  detail.className = "detail";
  detail.textContent = step.detail;
  if (step.badge === "valid" || step.badge === "invalid") {
    const badge = document.createElement("span");
    badge.className = `badge badge-${step.badge}`;
    badge.textContent = step.badge === "valid" ? "VALID" : "INVALID";
    detail.appendChild(document.createElement("br"));
    detail.appendChild(badge);
  }
  el.appendChild(detail);

  if (step.credential) {
    const pre = document.createElement("div");
    pre.className = "credential";
    pre.textContent = step.credential;
    el.appendChild(pre);
  }

  return el;
}

async function animate(): Promise<void> {
  runBtn.disabled = true;
  timeline.innerHTML = "";

  const { steps } = runScenario();
  for (const step of steps) {
    const el = renderStep(step);
    timeline.appendChild(el);
    // Trigger the CSS transition on the next frame
    requestAnimationFrame(() => el.classList.add("visible"));
    await delay(650);
  }

  runBtn.disabled = false;
}

runBtn.addEventListener("click", animate);
