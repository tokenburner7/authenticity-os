/**
 * Brand Portal — main entry
 *
 * Lets brands paste a creator's credential JSON and verify:
 * 1. Signature validity
 * 2. AI assistance level (content provenance)
 * 3. EU AI Act Article 50 compliance status
 */

import {
  verifyCredentialSignature,
  createReputationStore,
  verifyCredential,
  generateLabel,
  checkCompliance,
  type SignedCredential,
} from "@auth/protocol";

const verifyBtn = document.getElementById("verifyBtn")!;
const textarea = document.getElementById("credential") as HTMLTextAreaElement;
const resultCard = document.getElementById("resultCard")!;
const resultDiv = document.getElementById("result")!;

verifyBtn.addEventListener("click", () => {
  const text = textarea.value.trim();
  if (!text) {
    resultCard.style.display = "block";
    resultDiv.innerHTML = '<span class="badge badge-invalid">Please paste a credential</span>';
    return;
  }

  try {
    const credential = JSON.parse(text) as SignedCredential;

    // 1. Signature verification
    const sigValid = verifyCredentialSignature(credential);

    // 2. Reputation check (in-memory, no prior data)
    const repStore = createReputationStore();
    const verification = verifyCredential(credential, repStore);

    // 3. Compliance check
    const compliance = checkCompliance(credential);
    const label = generateLabel(credential);

    // Render results
    const statusBadge = sigValid
      ? '<span class="badge badge-valid">✓ Signature Valid</span>'
      : '<span class="badge badge-invalid">✗ Signature Invalid</span>';

    const complianceBadge = compliance.compliant
      ? '<span class="badge badge-valid">Article 50 Compliant</span>'
      : '<span class="badge badge-invalid">Non-Compliant</span>';

    const aiLabel = label.requiresDisclosure
      ? `<span class="badge badge-pending">${label.label}</span>`
      : `<span class="badge badge-valid">${label.label}</span>`;

    resultDiv.innerHTML = `
      <div style="margin-bottom:16px;">
        ${statusBadge} ${complianceBadge} ${aiLabel}
      </div>
      <div class="stat">
        <div class="stat-label">AI Assistance</div>
        <div class="stat-value">${label.aiAssistance}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Content Hash</div>
        <div class="stat-value" style="font-family:monospace;font-size:11px;word-break:break-all;max-width:200px;">${credential.payload.subject.contentHash?.slice(0, 24) ?? 'N/A'}...</div>
      </div>
      <div class="stat">
        <div class="stat-label">Issuer</div>
        <div class="stat-value" style="font-family:monospace;font-size:11px;word-break:break-all;max-width:200px;">${credential.signer.slice(0, 24)}...</div>
      </div>
      <div class="stat">
        <div class="stat-label">Issued</div>
        <div class="stat-value" style="font-size:13px;">${new Date(credential.payload.issuedAt).toLocaleString()}</div>
      </div>
      ${compliance.violations.length > 0 ? `
        <div style="margin-top:16px;">
          <div class="stat-label">Violations</div>
          <ul style="font-size:13px;color:#f87171;margin-top:8px;padding-left:20px;">
            ${compliance.violations.map((v: string) => `<li>${v}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    `;

    resultCard.style.display = "block";
  } catch (err) {
    resultCard.style.display = "block";
    resultDiv.innerHTML = `<span class="badge badge-invalid">Error: ${(err as Error).message}</span>`;
  }
});